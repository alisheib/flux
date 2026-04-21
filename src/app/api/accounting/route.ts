import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateShipmentCosts } from "@/lib/calculations";

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

    if (!hasMinRole(auth.role, "accountant")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const orgId = auth.orgId;

    // Get all shipments with items and expenses
    const shipments = await prisma.shipment.findMany({
      where: { orgId },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sellingPrice: true } },
          },
        },
        expenses: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Get all sales for revenue tracking
    const sales = await prisma.sale.findMany({
      where: { orgId },
      include: {
        items: {
          include: { product: { select: { id: true, name: true } } },
        },
      },
    });

    // Build P&L per shipment
    const shipmentPnL = shipments.map((shipment) => {
      const items = shipment.items.map((item) => ({
        id: item.id,
        name: item.name,
        quantity: item.quantity,
        totalCost: item.totalCost,
      }));

      const expenses = shipment.expenses.map((e) => ({
        amountUsd: e.amountUsd,
        category: e.category,
      }));

      const breakdown = calculateShipmentCosts(items, expenses);

      // Calculate revenue from sales of products in this shipment
      const shipmentProductIds = new Set(
        shipment.items
          .map((item) => item.productId)
          .filter((id): id is string => id !== null)
      );

      let totalRevenue = 0;
      let totalUnitsSold = 0;

      for (const sale of sales) {
        for (const saleItem of sale.items) {
          if (shipmentProductIds.has(saleItem.productId)) {
            totalRevenue += saleItem.total;
            totalUnitsSold += saleItem.quantity;
          }
        }
      }

      const grossProfit = totalRevenue - breakdown.totalLandedCost;
      const grossMargin =
        totalRevenue > 0
          ? Math.round((grossProfit / totalRevenue) * 10000) / 100
          : 0;

      return {
        shipmentId: shipment.id,
        shipmentName: shipment.name,
        status: shipment.status,
        createdAt: shipment.createdAt,
        totalFob: breakdown.totalFob,
        totalExpenses: breakdown.totalExpenses,
        totalLandedCost: breakdown.totalLandedCost,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        grossProfit: Math.round(grossProfit * 100) / 100,
        grossMargin,
        totalUnitsSold,
        expensesByCategory: breakdown.expensesByCategory,
      };
    });

    // Overall totals
    const overallTotalFob = shipmentPnL.reduce((s, p) => s + p.totalFob, 0);
    const overallTotalExpenses = shipmentPnL.reduce((s, p) => s + p.totalExpenses, 0);
    const overallTotalCost = shipmentPnL.reduce((s, p) => s + p.totalLandedCost, 0);
    const overallTotalRevenue = shipmentPnL.reduce((s, p) => s + p.totalRevenue, 0);
    const overallGrossProfit = overallTotalRevenue - overallTotalCost;
    const overallGrossMargin =
      overallTotalRevenue > 0
        ? Math.round((overallGrossProfit / overallTotalRevenue) * 10000) / 100
        : 0;

    // Aggregate all expenses by category across shipments
    const expenseCategoryMap = new Map<string, number>();
    for (const s of shipmentPnL) {
      for (const ec of s.expensesByCategory) {
        expenseCategoryMap.set(
          ec.category,
          (expenseCategoryMap.get(ec.category) ?? 0) + ec.total
        );
      }
    }
    const overallExpensesByCategory = Array.from(expenseCategoryMap.entries())
      .map(([category, total]) => ({ category, total: Math.round(total * 100) / 100 }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      shipments: shipmentPnL,
      totals: {
        totalFob: Math.round(overallTotalFob * 100) / 100,
        totalExpenses: Math.round(overallTotalExpenses * 100) / 100,
        totalLandedCost: Math.round(overallTotalCost * 100) / 100,
        totalRevenue: Math.round(overallTotalRevenue * 100) / 100,
        grossProfit: Math.round(overallGrossProfit * 100) / 100,
        grossMargin: overallGrossMargin,
        expensesByCategory: overallExpensesByCategory,
      },
    });
  } catch (error) {
    console.error("GET /api/accounting error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
