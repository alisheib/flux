import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
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
    ]);

    // Monthly sales for last 6 months
    const now = new Date();
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const allSales = await prisma.sale.findMany({
      where: {
        orgId,
        createdAt: { gte: sixMonthsAgo },
      },
      select: { total: true, createdAt: true },
    });

    // Aggregate by month
    const monthlyMap = new Map<string, { count: number; revenue: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      monthlyMap.set(key, { count: 0, revenue: 0 });
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

    const monthlySales = Array.from(monthlyMap.entries()).map(([month, data]) => ({
      month,
      count: data.count,
      revenue: Math.round(data.revenue * 100) / 100,
    }));

    return NextResponse.json({
      totalProducts,
      totalSales,
      totalRevenue: revenueAgg._sum.total || 0,
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
