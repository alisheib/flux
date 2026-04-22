import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const orgId = auth.orgId;

    // Run queries in parallel
    const [
      totalProducts,
      totalSales,
      revenueAgg,
      totalShipments,
      recentSales,
      lowStockProducts,
      totalCostsAgg,
    ] = await Promise.all([
      prisma.product.count({ where: { orgId, active: true } }),
      prisma.sale.count({ where: { orgId } }),
      prisma.sale.aggregate({ where: { orgId }, _sum: { total: true } }),
      prisma.shipment.count({ where: { orgId } }),
      prisma.sale.findMany({
        where: { orgId },
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      prisma.product.findMany({
        where: {
          orgId,
          active: true,
          minStockQty: { gt: 0 },
        },
        select: {
          id: true,
          name: true,
          sku: true,
          stockQty: true,
          minStockQty: true,
          unit: true,
        },
        orderBy: { stockQty: "asc" },
      }).then((products) =>
        products.filter((p) => p.stockQty < p.minStockQty)
      ),
      // Real costs: sum of all shipment item FOB + expenses
      Promise.all([
        prisma.shipmentItem.aggregate({ where: { shipment: { orgId } }, _sum: { totalCost: true } }),
        prisma.shipmentExpense.aggregate({ where: { orgId }, _sum: { amountUsd: true } }),
      ]).then(([items, expenses]) =>
        (items._sum.totalCost || 0) + (expenses._sum.amountUsd || 0)
      ),
    ]);

    // Monthly sales for last 6 months
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const [allSales, allShipmentItems, allShipmentExpenses] = await Promise.all([
      prisma.sale.findMany({
        where: { orgId, createdAt: { gte: sixMonthsAgo } },
        select: { total: true, createdAt: true },
      }),
      prisma.shipmentItem.findMany({
        where: { shipment: { orgId, createdAt: { gte: sixMonthsAgo } } },
        select: { totalCost: true, shipment: { select: { createdAt: true } } },
      }),
      prisma.shipmentExpense.findMany({
        where: { orgId, shipment: { createdAt: { gte: sixMonthsAgo } } },
        select: { amountUsd: true, shipment: { select: { createdAt: true } } },
      }),
    ]);

    // Aggregate by month
    const monthlyMap = new Map<string, { count: number; revenue: number; costs: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, { count: 0, revenue: 0, costs: 0 });
    }

    for (const sale of allSales) {
      const d = new Date(sale.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key);
      if (entry) {
        entry.count += 1;
        entry.revenue += sale.total;
      }
    }

    // Aggregate real costs by month (shipment FOB + expenses)
    for (const item of allShipmentItems) {
      const d = new Date(item.shipment.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key);
      if (entry) entry.costs += item.totalCost;
    }
    for (const expense of allShipmentExpenses) {
      const d = new Date(expense.shipment.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const entry = monthlyMap.get(key);
      if (entry) entry.costs += expense.amountUsd;
    }

    const monthlySales = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
      costs: Math.round(data.costs * 100) / 100,
    }));

    return NextResponse.json({
      totalProducts,
      totalSales,
      totalRevenue: revenueAgg._sum.total || 0,
      totalCosts: Math.round(totalCostsAgg * 100) / 100,
      totalShipments,
      recentSales,
      lowStockProducts,
      monthlySales,
    });
  } catch (error) {
    console.error("GET /api/dashboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
