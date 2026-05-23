"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  BarChart3,
  Target,
  PieChart,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { getCurrencySymbol } from "@/lib/currency";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// ─── Types ─────────────────────────────────────────────────────────────

interface ShipmentPL {
  id: string;
  name: string;
  fobCost: number;
  expenses: number;
  landedCost: number;
  salesRevenue: number;
  profit: number;
  marginPercent: number;
}

interface MonthlyData {
  month: string;
  revenue: number;
  costs: number;
}

interface AccountingData {
  totalInvestment: number;
  totalRevenue: number;
  profitLoss: number;
  averageMargin: number;
  monthlyData: MonthlyData[];
  shipments: ShipmentPL[];
}

// ─── Main Page Component ───────────────────────────────────────────────

export default function AccountingPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AccountingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // Org currency drives every formatCurrency call on this page. Without it,
  // formatCurrency falls through to the USD default — which is exactly the
  // bug we just fixed everywhere else.
  const [orgCurrency, setOrgCurrency] = useState<string>("USD");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.organization?.currency) setOrgCurrency(d.organization.currency); })
      .catch(() => {});
  }, []);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/accounting");
      if (!res.ok) throw new Error("Failed to fetch accounting data");
      const json = await res.json();

      // Transform API response to match component's expected shape
      const shipments: ShipmentPL[] = (json.shipments || []).map((s: Record<string, unknown>) => ({
        id: s.shipmentId || s.id || "",
        name: s.shipmentName || s.name || "",
        fobCost: (s.totalFob as number) ?? 0,
        expenses: (s.totalExpenses as number) ?? 0,
        landedCost: (s.totalLandedCost as number) ?? 0,
        salesRevenue: (s.totalRevenue as number) ?? (s.totalSales as number) ?? 0,
        profit: (s.grossProfit as number) ?? (s.profit as number) ?? 0,
        marginPercent: (s.grossMargin as number) ?? (s.margin as number) ?? 0,
      }));

      const totals = json.totals || {};
      const transformed: AccountingData = {
        totalInvestment: totals.totalLandedCost ?? shipments.reduce((s: number, x: ShipmentPL) => s + x.landedCost, 0),
        totalRevenue: totals.totalRevenue ?? shipments.reduce((s: number, x: ShipmentPL) => s + x.salesRevenue, 0),
        profitLoss: totals.grossProfit ?? totals.totalProfit ?? shipments.reduce((s: number, x: ShipmentPL) => s + x.profit, 0),
        averageMargin: totals.grossMargin ?? totals.overallMargin ?? 0,
        monthlyData: json.monthlyData || [],
        shipments,
      };
      setData(transformed);
    } catch {
      toast.error("Failed to load accounting data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Export Excel ─────────────────────────────────────────────────

  const handleExport = useCallback(async () => {
    if (!data || data.shipments.length === 0) {
      toast.error("No data to export");
      return;
    }
    setExporting(true);
    try {
    const { exportToExcel } = await import("@/lib/excel-export");

    const totals = data.shipments.reduce(
      (acc, s) => ({
        fob: acc.fob + s.fobCost,
        expenses: acc.expenses + s.expenses,
        landed: acc.landed + s.landedCost,
        revenue: acc.revenue + s.salesRevenue,
        profit: acc.profit + s.profit,
      }),
      { fob: 0, expenses: 0, landed: 0, revenue: 0, profit: 0 }
    );
    const totalMargin =
      totals.revenue > 0
        ? ((totals.revenue - totals.landed) / totals.revenue) * 100
        : 0;

    await exportToExcel({
      sheetName: "P&L Report",
      title: "Profit & Loss Report",
      subtitle: `${data.shipments.length} shipments | Generated ${new Date().toLocaleDateString()}`,
      currency: orgCurrency,
      filename: `flux-pnl-report-${new Date().toISOString().split("T")[0]}`,
      columns: [
        { header: "Shipment", key: "name", width: 28, type: "string" },
        { header: "FOB Cost", key: "fobCost", width: 14, type: "currency" },
        { header: "Expenses", key: "expenses", width: 14, type: "currency" },
        { header: "Landed Cost", key: "landedCost", width: 14, type: "currency" },
        { header: "Sales Revenue", key: "salesRevenue", width: 16, type: "currency" },
        { header: "Profit", key: "profit", width: 14, type: "currency" },
        { header: "Margin %", key: "marginPercent", width: 11, type: "percent" },
      ],
      data: data.shipments.map((s) => ({
        name: s.name,
        fobCost: s.fobCost,
        expenses: s.expenses,
        landedCost: s.landedCost,
        salesRevenue: s.salesRevenue,
        profit: s.profit,
        marginPercent: s.marginPercent,
      })),
      totalsRow: {
        name: "TOTALS",
        fobCost: totals.fob,
        expenses: totals.expenses,
        landedCost: totals.landed,
        salesRevenue: totals.revenue,
        profit: totals.profit,
        marginPercent: totalMargin,
      },
    });

    toast.success("Excel report downloaded");
    } finally {
      setExporting(false);
    }
  }, [data]);

  // ─── Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Accounting"
          description="Financial overview and profit analysis"
        />
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">
            Loading accounting data...
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Accounting"
          description="Financial overview and profit analysis"
        />
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center text-muted-foreground">
            <div className="empty-state-icon">
              <BarChart3 className="size-5" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              No accounting data
            </h3>
            <p className="text-sm">
              Start by creating shipments and recording sales
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isProfitable = data.profitLoss >= 0;

  // Compute totals for table footer
  const tableTotals = data.shipments.reduce(
    (acc, s) => ({
      fob: acc.fob + s.fobCost,
      expenses: acc.expenses + s.expenses,
      landed: acc.landed + s.landedCost,
      revenue: acc.revenue + s.salesRevenue,
      profit: acc.profit + s.profit,
    }),
    { fob: 0, expenses: 0, landed: 0, revenue: 0, profit: 0 }
  );
  const totalMarginPercent =
    tableTotals.revenue > 0
      ? ((tableTotals.revenue - tableTotals.landed) / tableTotals.revenue) * 100
      : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Accounting"
        description="Financial overview and profit analysis"
      >
        <Button variant="outline" onClick={handleExport} disabled={!data || data.shipments.length === 0 || exporting}>
          {exporting ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Download className="mr-1.5 h-4 w-4" />}
          {exporting ? "Exporting..." : "Export Report"}
        </Button>
      </PageHeader>

      {/* ── KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Total Investment */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 overflow-hidden relative">
          <div className="flex items-center justify-between">
            <div className="kpi-icon-blue flex size-10 items-center justify-center rounded-[10px]">
              <DollarSign className="size-[18px]" />
            </div>
          </div>
          <p className="text-[12.5px] font-medium text-muted-foreground">Total Investment</p>
          <p className="text-[clamp(24px,2.4vw,30px)] font-semibold tracking-tight leading-none">
            {formatCurrency(data.totalInvestment, orgCurrency)}
          </p>
          <p className="text-xs text-muted-foreground">FOB + landed costs</p>
        </div>

        {/* Total Revenue */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 overflow-hidden relative">
          <div className="flex items-center justify-between">
            <div className="kpi-icon-green flex size-10 items-center justify-center rounded-[10px]">
              <TrendingUp className="size-[18px]" />
            </div>
          </div>
          <p className="text-[12.5px] font-medium text-muted-foreground">Total Revenue</p>
          <p className="text-[clamp(24px,2.4vw,30px)] font-semibold tracking-tight leading-none">
            {formatCurrency(data.totalRevenue, orgCurrency)}
          </p>
        </div>

        {/* Profit / Loss */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 overflow-hidden relative">
          <div className="flex items-center justify-between">
            <div className={`flex size-10 items-center justify-center rounded-[10px] ${isProfitable ? "kpi-icon-accent" : "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-300"}`}>
              <Target className="size-[18px]" />
            </div>
          </div>
          <p className="text-[12.5px] font-medium text-muted-foreground">Profit / Loss</p>
          <p className={`text-[clamp(24px,2.4vw,30px)] font-semibold tracking-tight leading-none ${isProfitable ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {formatCurrency(data.profitLoss, orgCurrency)}
          </p>
        </div>

        {/* Average Margin */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col gap-2 overflow-hidden relative">
          <div className="flex items-center justify-between">
            <div className="kpi-icon-purple flex size-10 items-center justify-center rounded-[10px]">
              <PieChart className="size-[18px]" />
            </div>
          </div>
          <p className="text-[12.5px] font-medium text-muted-foreground">Avg Margin</p>
          <p className={`text-[clamp(24px,2.4vw,30px)] font-semibold tracking-tight leading-none ${data.averageMargin >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
            {formatNumber(data.averageMargin, 1)}%
          </p>
        </div>
      </div>

      {/* ── Monthly Revenue vs Costs Chart ───────────────────── */}
      {data.monthlyData && data.monthlyData.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="p-5 pb-0">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">Monthly Revenue vs Costs</h3>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">Last 6 months performance</p>
          </div>
          <div className="p-5">
            <div className="h-[350px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.monthlyData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                  />
                  <XAxis
                    dataKey="month"
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis
                    className="text-xs"
                    tick={{ fill: "hsl(var(--muted-foreground))" }}
                    tickFormatter={(value: number) =>
                      // Use the org currency's actual symbol, not a hardcoded "$".
                      `${getCurrencySymbol(orgCurrency).trim()}${(value / 1000).toFixed(0)}k`
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--card-foreground))",
                    }}
                    labelStyle={{ color: "hsl(var(--foreground))" }}
                    formatter={(value) =>
                      value != null ? formatCurrency(Number(value), orgCurrency) : ""
                    }
                  />
                  <Legend
                    wrapperStyle={{ color: "hsl(var(--foreground))" }}
                  />
                  <Bar
                    dataKey="costs"
                    name="Costs"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="#10b981"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── P&L Table ────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 pb-0">
          <h3 className="text-base font-semibold">Profit & Loss by Shipment</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Detailed breakdown of costs and revenue per shipment
          </p>
        </div>
        <div className="p-5">
          {data.shipments.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-medium uppercase tracking-wide">Shipment</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wide">FOB Cost</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wide">Expenses</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wide">Landed Cost</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wide">Sales Revenue</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wide">Profit</TableHead>
                    <TableHead className="text-right text-xs font-medium uppercase tracking-wide">Margin %</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.shipments.map((shipment) => {
                    const isProfit = shipment.profit >= 0;
                    return (
                      <TableRow key={shipment.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-foreground">
                          {shipment.name}
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {formatCurrency(shipment.fobCost, orgCurrency)}
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {formatCurrency(shipment.expenses, orgCurrency)}
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {formatCurrency(shipment.landedCost, orgCurrency)}
                        </TableCell>
                        <TableCell className="text-right text-foreground">
                          {formatCurrency(shipment.salesRevenue, orgCurrency)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            isProfit
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatCurrency(shipment.profit, orgCurrency)}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            isProfit
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatNumber(shipment.marginPercent, 1)}%
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow className="border-t-2 border-border bg-muted/30 font-bold hover:bg-muted/30">
                    <TableCell className="font-bold">TOTAL</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(tableTotals.fob, orgCurrency)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(tableTotals.expenses, orgCurrency)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(tableTotals.landed, orgCurrency)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(tableTotals.revenue, orgCurrency)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${
                        tableTotals.profit >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatCurrency(tableTotals.profit, orgCurrency)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-bold ${
                        totalMarginPercent >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {formatNumber(totalMarginPercent, 1)}%
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <BarChart3 className="mb-3 h-10 w-10" />
              <p className="text-sm font-medium">No shipment data available</p>
              <p className="mt-1 text-xs">
                Create shipments and record sales to see P&L analysis
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
