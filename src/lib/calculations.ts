import { formatCurrencyValue } from "@/lib/currency";

export interface ProductCost {
  itemId: string;
  name: string;
  totalQty: number;
  totalCost: number;
  valueShare: number;
  allocatedExpenses: number;
  landedCost: number;
  costPerUnit: number;
  margins: { percent: number; pricePerUnit: number }[];
}

export interface ShipmentCostBreakdown {
  totalFob: number;
  totalExpenses: number;
  totalLandedCost: number;
  avgCostPerUnit: number;
  totalQty: number;
  products: ProductCost[];
  expensesByCategory: { category: string; total: number }[];
}

export function calculateShipmentCosts(
  items: {
    id: string;
    name: string;
    quantity: number;
    totalCost: number;
    marginPercent?: number;
  }[],
  expenses: { amountUsd: number; category: string }[],
  defaultMargins: number[] = [5, 10, 15, 20, 25, 30]
): ShipmentCostBreakdown {
  const totalFob = items.reduce((sum, p) => sum + p.totalCost, 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amountUsd, 0);
  const totalLandedCost = totalFob + totalExpenses;
  const totalQty = items.reduce((sum, p) => sum + p.quantity, 0);

  const categoryMap = new Map<string, number>();
  for (const e of expenses) {
    categoryMap.set(e.category, (categoryMap.get(e.category) ?? 0) + e.amountUsd);
  }
  const expensesByCategory = Array.from(categoryMap.entries())
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  const products: ProductCost[] = items.map((p) => {
    const valueShare = totalFob > 0 ? p.totalCost / totalFob : 0;
    const allocatedExpenses = valueShare * totalExpenses;
    const landedCost = p.totalCost + allocatedExpenses;
    const costPerUnit = p.quantity > 0 ? landedCost / p.quantity : 0;

    const allMargins = Array.from(
      new Set([...defaultMargins, ...(p.marginPercent ? [p.marginPercent] : [])])
    ).sort((a, b) => a - b);

    const margins = allMargins.map((percent) => ({
      percent,
      pricePerUnit: round(costPerUnit * (1 + percent / 100), 2),
    }));

    return {
      itemId: p.id,
      name: p.name,
      totalQty: p.quantity,
      totalCost: p.totalCost,
      valueShare: round(valueShare, 6),
      allocatedExpenses: round(allocatedExpenses, 2),
      landedCost: round(landedCost, 2),
      costPerUnit: round(costPerUnit, 2),
      margins,
    };
  });

  const avgCostPerUnit = totalQty > 0 ? totalLandedCost / totalQty : 0;

  return {
    totalFob: round(totalFob, 2),
    totalExpenses: round(totalExpenses, 2),
    totalLandedCost: round(totalLandedCost, 2),
    avgCostPerUnit: round(avgCostPerUnit, 2),
    totalQty,
    products,
    expensesByCategory,
  };
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  // Delegates to the canonical currency registry in lib/currency.ts so the
  // symbol/decimals come from a single source — previously every non-TZS code
  // silently fell through to "$" which mis-labeled EUR/KES/NGN/etc as USD.
  return formatCurrencyValue(amount, currency);
}

export function formatNumber(n: number, decimals: number = 2): string {
  if (n == null || isNaN(n)) return "0";
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
