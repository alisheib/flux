import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ customer: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(auth.role, "accountant")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { customer } = await params;
    const customerName = decodeURIComponent(customer);

    if (!customerName) {
      return NextResponse.json(
        { error: "Customer name is required" },
        { status: 400 }
      );
    }

    // Find all sales for this customer
    const sales = await prisma.sale.findMany({
      where: {
        orgId: auth.orgId,
        customer: customerName,
      },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
          },
        },
        payments: {
          orderBy: { date: "desc" },
        },
        invoice: {
          select: { id: true, number: true, status: true, dueAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    if (sales.length === 0) {
      return NextResponse.json(
        { error: "No sales found for this customer" },
        { status: 404 }
      );
    }

    // Compute per-sale outstanding balance and summary
    let totalOwed = 0;
    let totalPaid = 0;
    let totalSalesAmount = 0;

    const salesWithBalance = sales.map((sale) => {
      const paidAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      const outstanding = Math.round((sale.total - paidAmount) * 100) / 100;

      totalSalesAmount += sale.total;
      totalPaid += paidAmount;
      if (outstanding > 0) {
        totalOwed += outstanding;
      }

      return {
        id: sale.id,
        saleNumber: sale.saleNumber,
        createdAt: sale.createdAt,
        subtotal: sale.subtotal,
        taxAmount: sale.taxAmount,
        discount: sale.discount,
        total: sale.total,
        currency: sale.currency,
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        notes: sale.notes,
        invoice: sale.invoice,
        items: sale.items,
        payments: sale.payments,
        paidAmount: Math.round(paidAmount * 100) / 100,
        outstanding: Math.max(0, outstanding),
      };
    });

    return NextResponse.json({
      customer: {
        name: customerName,
        phone: sales[0].customerPhone,
        email: sales[0].customerEmail,
      },
      summary: {
        totalSalesAmount: Math.round(totalSalesAmount * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
        totalOwed: Math.round(totalOwed * 100) / 100,
        salesCount: sales.length,
      },
      sales: salesWithBalance,
    });
  } catch (error) {
    console.error("GET /api/receivables/[customer] error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
