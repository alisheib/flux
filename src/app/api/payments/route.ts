import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { logAudit } from "@/lib/audit";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

const VALID_PAYMENT_METHODS = ["mpesa", "tigo", "airtel", "bank", "cash", "card"];

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(auth.role, "accountant")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pagination = parsePagination(request);
    const { searchParams } = request.nextUrl;
    const saleId = searchParams.get("saleId");

    const where: { orgId: string; saleId?: string } = { orgId: auth.orgId };
    if (saleId) {
      where.saleId = saleId;
    }

    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          sale: {
            select: {
              id: true,
              saleNumber: true,
              customer: true,
              customerPhone: true,
              total: true,
              status: true,
            },
          },
        },
        orderBy: { date: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json(paginatedResponse(payments, total, pagination));
  } catch (error) {
    console.error("GET /api/payments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(auth.role, "accountant")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { saleId, amount, method, reference, notes, date } = body;

    // Validation
    if (!saleId || !amount || !method) {
      return NextResponse.json(
        { error: "saleId, amount, and method are required" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    if (!VALID_PAYMENT_METHODS.includes(method)) {
      return NextResponse.json(
        {
          error: `Invalid payment method. Allowed: ${VALID_PAYMENT_METHODS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate sale exists and belongs to org
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, orgId: auth.orgId },
      include: { payments: true },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Calculate outstanding balance
    const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.round((sale.total - totalPaid) * 100) / 100;

    if (outstanding <= 0) {
      return NextResponse.json(
        { error: "This sale is already fully paid" },
        { status: 400 }
      );
    }

    if (amount > outstanding + 0.01) {
      // small tolerance for floating point
      return NextResponse.json(
        {
          error: `Payment amount (${amount}) exceeds outstanding balance (${outstanding})`,
        },
        { status: 400 }
      );
    }

    // Determine new sale status after this payment
    const newTotalPaid = totalPaid + amount;
    const remainingAfterPayment =
      Math.round((sale.total - newTotalPaid) * 100) / 100;
    const newStatus = remainingAfterPayment <= 0 ? "completed" : "partial";

    // Create payment and update sale in a transaction
    const payment = await prisma.$transaction(async (tx) => {
      const newPayment = await tx.payment.create({
        data: {
          orgId: auth.orgId,
          saleId,
          amount: Math.round(amount * 100) / 100,
          method,
          reference: reference || null,
          notes: notes || null,
          date: date ? new Date(date) : new Date(),
        },
      });

      // Update sale status
      await tx.sale.update({
        where: { id: saleId },
        data: { status: newStatus },
      });

      // If fully paid, update invoice status to paid
      if (newStatus === "completed") {
        await tx.invoice.updateMany({
          where: { saleId, orgId: auth.orgId },
          data: { status: "paid", paidAt: new Date() },
        });
      }

      return newPayment;
    });

    // Fetch the payment with sale info
    const fullPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
      include: {
        sale: {
          select: {
            id: true,
            saleNumber: true,
            customer: true,
            total: true,
            status: true,
            paymentMethod: true,
          },
        },
      },
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "create",
      entity: "payment",
      entityId: payment.id,
      details: `Payment of ${amount} via ${method} for sale ${sale.saleNumber}. Status: ${newStatus}`,
    });

    return NextResponse.json(fullPayment, { status: 201 });
  } catch (error) {
    console.error("POST /api/payments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
