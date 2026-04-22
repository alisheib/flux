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

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(auth.role, "accountant")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const orgId = auth.orgId;
    const { searchParams } = request.nextUrl;
    const fromStr = searchParams.get("from");
    const toStr = searchParams.get("to");

    // Build date range with validation
    const from = fromStr ? new Date(fromStr) : new Date(0);
    const to = toStr ? new Date(toStr + "T23:59:59.999Z") : new Date();

    if (isNaN(from.getTime()) || isNaN(to.getTime())) {
      return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
    }
    if (from > to) {
      return NextResponse.json({ error: "'from' date must be before 'to' date" }, { status: 400 });
    }

    // Sales in date range
    const sales = await prisma.sale.findMany({
      where: {
        orgId,
        createdAt: { gte: from, lte: to },
      },
      include: {
        items: {
          include: { product: { select: { id: true, name: true, categoryId: true, category: { select: { name: true } } } } },
        },
        user: { select: { name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Invoices in date range
    const invoices = await prisma.invoice.findMany({
      where: {
        orgId,
        issuedAt: { gte: from, lte: to },
      },
    });

    // Products for inventory snapshot
    const products = await prisma.product.findMany({
      where: { orgId, active: true },
      include: { category: { select: { name: true } } },
      orderBy: { stockQty: "asc" },
    });

    // ── Aggregate: Sales summary ───────────────────────────────
    const totalSales = sales.length;
    const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
    const totalDiscount = sales.reduce((s, sale) => s + sale.discount, 0);
    const totalTax = sales.reduce((s, sale) => s + sale.taxAmount, 0);
    const avgOrderValue = totalSales > 0 ? totalRevenue / totalSales : 0;

    // ── Aggregate: By payment method ───────────────────────────
    const paymentMethodMap = new Map<string, { count: number; total: number }>();
    for (const sale of sales) {
      const m = sale.paymentMethod;
      const existing = paymentMethodMap.get(m) || { count: 0, total: 0 };
      paymentMethodMap.set(m, { count: existing.count + 1, total: existing.total + sale.total });
    }
    const byPaymentMethod = Array.from(paymentMethodMap.entries())
      .map(([method, data]) => ({ method, ...data }))
      .sort((a, b) => b.total - a.total);

    // ── Aggregate: By salesperson ──────────────────────────────
    const salespersonMap = new Map<string, { name: string; count: number; total: number }>();
    for (const sale of sales) {
      const key = sale.userId;
      const existing = salespersonMap.get(key) || { name: sale.user.name, count: 0, total: 0 };
      salespersonMap.set(key, { name: existing.name, count: existing.count + 1, total: existing.total + sale.total });
    }
    const bySalesperson = Array.from(salespersonMap.values()).sort((a, b) => b.total - a.total);

    // ── Aggregate: Daily revenue (for line chart) ──────────────
    const dailyMap = new Map<string, { date: string; revenue: number; count: number }>();
    for (const sale of sales) {
      const day = new Date(sale.createdAt).toISOString().split("T")[0];
      const existing = dailyMap.get(day) || { date: day, revenue: 0, count: 0 };
      dailyMap.set(day, { date: day, revenue: existing.revenue + sale.total, count: existing.count + 1 });
    }
    const dailyRevenue = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

    // ── Aggregate: Top products ────────────────────────────────
    const productMap = new Map<string, { name: string; category: string; qty: number; revenue: number }>();
    for (const sale of sales) {
      for (const item of sale.items) {
        const key = item.productId;
        const existing = productMap.get(key) || {
          name: item.name,
          category: item.product?.category?.name || "Other",
          qty: 0,
          revenue: 0,
        };
        productMap.set(key, {
          ...existing,
          qty: existing.qty + item.quantity,
          revenue: existing.revenue + item.total,
        });
      }
    }
    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 15);

    // ── Aggregate: By category ─────────────────────────────────
    const categoryMap = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const sale of sales) {
      for (const item of sale.items) {
        const catName = item.product?.category?.name || "Other";
        const existing = categoryMap.get(catName) || { name: catName, qty: 0, revenue: 0 };
        categoryMap.set(catName, {
          ...existing,
          qty: existing.qty + item.quantity,
          revenue: existing.revenue + item.total,
        });
      }
    }
    const byCategory = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);

    // ── Invoice summary ────────────────────────────────────────
    const invoicePaid = invoices.filter((i) => i.status === "paid").length;
    const invoiceIssued = invoices.filter((i) => i.status === "issued").length;
    const invoiceOverdue = invoices.filter((i) => i.status === "overdue").length;
    const invoiceTotalPaid = invoices
      .filter((i) => i.status === "paid")
      .reduce((s, i) => s + i.total, 0);
    const invoiceTotalOutstanding = invoices
      .filter((i) => i.status === "issued" || i.status === "overdue")
      .reduce((s, i) => s + i.total, 0);

    // ── Low stock ──────────────────────────────────────────────
    const lowStockProducts = products
      .filter((p) => p.stockQty <= p.minStockQty)
      .slice(0, 10)
      .map((p) => ({
        name: p.name,
        stockQty: p.stockQty,
        minStockQty: p.minStockQty,
        category: p.category?.name || "Other",
      }));

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      sales: {
        totalSales,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalDiscount: Math.round(totalDiscount * 100) / 100,
        totalTax: Math.round(totalTax * 100) / 100,
        avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      },
      invoices: {
        total: invoices.length,
        paid: invoicePaid,
        issued: invoiceIssued,
        overdue: invoiceOverdue,
        totalPaid: Math.round(invoiceTotalPaid * 100) / 100,
        totalOutstanding: Math.round(invoiceTotalOutstanding * 100) / 100,
      },
      dailyRevenue,
      topProducts,
      byCategory,
      byPaymentMethod,
      bySalesperson,
      lowStockProducts,
    });
  } catch (error) {
    console.error("GET /api/reports error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
