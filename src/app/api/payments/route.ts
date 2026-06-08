import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { parseCurrencyEntry, formatEntryForAudit } from "@/lib/currency-entry";

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

    // Rate limit: 10 payment requests per minute per user
    const rateLimitKey = `payment:${auth.userId}`;
    const { allowed, resetIn } = rateLimit(rateLimitKey, { maxAttempts: 10, windowMs: 60 * 1000 });
    if (!allowed) {
      const seconds = Math.ceil(resetIn / 1000);
      return NextResponse.json(
        { error: `Too many payment requests. Please try again in ${seconds} seconds.` },
        { status: 429 }
      );
    }

    if (!hasMinRole(auth.role, "accountant")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { saleId, amount, method, reference, notes, date, amountEntry } = body;

    // Validation
    if (!saleId || !amount || !method) {
      return NextResponse.json(
        { error: "saleId, amount, and method are required" },
        { status: 400 }
      );
    }

    if (typeof amount !== "number" || !isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "Amount must be a positive finite number" },
        { status: 400 }
      );
    }

    const parsedEntry = parseCurrencyEntry(amountEntry, "Payment amount");
    if (!parsedEntry.ok) return NextResponse.json({ error: parsedEntry.error }, { status: 400 });

    if (!VALID_PAYMENT_METHODS.includes(method)) {
      return NextResponse.json(
        {
          error: `Invalid payment method. Allowed: ${VALID_PAYMENT_METHODS.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate sale exists (quick check before expensive transaction)
    const saleExists = await prisma.sale.findFirst({
      where: { id: saleId, orgId: auth.orgId },
      select: { id: true },
    });
    if (!saleExists) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Create payment and update sale in a transaction with row lock
    const payment = await prisma.$transaction(async (tx) => {
      // Lock sale row to prevent concurrent overpayment
      const saleRows = await tx.$queryRaw<Array<{ id: string; total: number; status: string }>>`
        SELECT "id", "total", "status" FROM "Sale"
        WHERE "id" = ${saleId} AND "orgId" = ${auth.orgId}
        FOR UPDATE
      `;
      const sale = saleRows[0];
      if (!sale) throw new Error("Sale not found");

      // Get payments sum inside the locked transaction
      const paymentAgg = await tx.payment.aggregate({
        where: { saleId },
        _sum: { amount: true },
      });
      const totalPaid = paymentAgg._sum.amount || 0;
      const outstanding = Math.round((sale.total - totalPaid) * 100) / 100;

      if (outstanding <= 0) throw new Error("This sale is already fully paid");
      if (amount > outstanding + 0.01) {
        throw new Error(`Payment amount (${amount}) exceeds outstanding balance (${outstanding})`);
      }

      const newTotalPaid = totalPaid + amount;
      const remainingAfterPayment = Math.round((sale.total - newTotalPaid) * 100) / 100;
      const newStatus = remainingAfterPayment <= 0 ? "completed" : "partial";

      const newPayment = await tx.payment.create({
        data: {
          orgId: auth.orgId,
          saleId,
          amount: Math.round(amount * 100) / 100,
          method,
          reference: reference || null,
          notes: notes || null,
          date: date ? new Date(date) : new Date(),
          entryCurrency: parsedEntry.columns.entryCurrency,
          entryAmount: parsedEntry.columns.entryAmount,
          entryRate: parsedEntry.columns.entryRate,
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

    const entryNote = formatEntryForAudit("Amount", parsedEntry.columns);
    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "create",
      entity: "payment",
      entityId: payment.id,
      details: `Payment of ${amount} via ${method} for sale ${saleId}${entryNote ? " | " + entryNote : ""}`,
    });

    return NextResponse.json(fullPayment, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("already fully paid") || message.includes("exceeds outstanding")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error("POST /api/payments error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
