"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Download,
  TrendingUp,
  DollarSign,
  ShoppingCart,
  FileText,
  BarChart3,
  Package,
  AlertTriangle,
  Calendar,
  Users,
  CreditCard,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays, startOfMonth, startOfYear } from "date-fns";

import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ── Types ────────────────────────────────────────────────────────────────

interface ReportData {
  period: { from: string; to: string };
  sales: {
    totalSales: number;
    totalRevenue: number;
    totalDiscount: number;
    totalTax: number;
    avgOrderValue: number;
  };
  invoices: {
    total: number;
    paid: number;
    issued: number;
    overdue: number;
    totalPaid: number;
    totalOutstanding: number;
  };
  dailyRevenue: { date: string; revenue: number; count: number }[];
  topProducts: { name: string; category: string; qty: number; revenue: number }[];
  byCategory: { name: string; qty: number; revenue: number }[];
  byPaymentMethod: { method: string; count: number; total: number }[];
  bySalesperson: { name: string; count: number; total: number }[];
  lowStockProducts: { name: string; stockQty: number; minStockQty: number; category: string }[];
}

const CHART_COLORS = ["#d97706", "#059669", "#3b82f6", "#8b5cf6", "#ec4899", "#f97316", "#06b6d4", "#84cc16"];

// ── Preset date ranges ──────────────────────────────────────────────────

const presets = [
  { label: "Today", from: () => format(new Date(), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "Last 7 days", from: () => format(subDays(new Date(), 7), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "Last 30 days", from: () => format(subDays(new Date(), 30), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "This Month", from: () => format(startOfMonth(new Date()), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "This Year", from: () => format(startOfYear(new Date()), "yyyy-MM-dd"), to: () => format(new Date(), "yyyy-MM-dd") },
  { label: "All Time", from: () => "", to: () => "" },
];

// ── Main ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { user } = useAuth();
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [activePreset, setActivePreset] = useState("This Month");
  const [currency, setCurrency] = useState("USD");

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const [reportRes, settingsRes] = await Promise.all([
        fetch(`/api/reports?${params.toString()}`),
        fetch("/api/settings"),
      ]);

      if (reportRes.ok) setData(await reportRes.json());
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setCurrency(s.organization?.currency || s.currency || "USD");
      }
    } catch {
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const applyPreset = (preset: typeof presets[number]) => {
    setDateFrom(preset.from());
    setDateTo(preset.to());
    setActivePreset(preset.label);
  };

  // ── Export ─────────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!data) return;
    const { exportToExcel } = await import("@/lib/excel-export");

    await exportToExcel({
      sheetName: "Sales Report",
      title: "Sales Report",
      subtitle: `Period: ${dateFrom || "All"} to ${dateTo || "Today"} | ${data.sales.totalSales} sales`,
      currency,
      filename: `flux-report-${dateFrom || "all"}-to-${dateTo || "today"}`,
      columns: [
        { header: "Product", key: "name", width: 28, type: "string" },
        { header: "Category", key: "category", width: 16, type: "string" },
        { header: "Qty Sold", key: "qty", width: 12, type: "number" },
        { header: "Revenue", key: "revenue", width: 16, type: "currency" },
      ],
      data: data.topProducts,
      totalsRow: {
        name: "TOTAL",
        qty: data.topProducts.reduce((s, p) => s + p.qty, 0),
        revenue: data.topProducts.reduce((s, p) => s + p.revenue, 0),
      },
    });

    toast.success("Report exported to Excel");
  };

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Reports" description="Business analytics & insights" />
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Loading report data...</p>
        </div>
      </div>
    );
  }

  const s = data?.sales;
  const inv = data?.invoices;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Reports" description="Business analytics & insights">
        <Button variant="outline" size="sm" onClick={handleExport} disabled={!data}>
          <Download className="size-4 mr-1.5" />
          Export Excel
        </Button>
      </PageHeader>

      {/* ── Date Range Selector ────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activePreset === p.label
                  ? "bg-[#d97706] text-white"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <label className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setActivePreset(""); }}
              className="h-8 w-auto text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setActivePreset(""); }}
              className="h-8 w-auto text-xs"
            />
          </div>
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KPICard icon={ShoppingCart} label="Total Sales" value={String(s?.totalSales ?? 0)} color="blue" />
        <KPICard icon={DollarSign} label="Revenue" value={formatCurrency(s?.totalRevenue ?? 0, currency)} color="emerald" />
        <KPICard icon={TrendingUp} label="Avg Order" value={formatCurrency(s?.avgOrderValue ?? 0, currency)} color="amber" />
        <KPICard icon={FileText} label="Invoices" value={`${inv?.paid ?? 0} paid / ${inv?.total ?? 0}`} color="purple" />
      </div>

      {/* ── Revenue Chart ──────────────────────────────────────────── */}
      {data && data.dailyRevenue.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="size-4 text-muted-foreground" />
            Revenue Over Time
          </h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.dailyRevenue}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                  tickFormatter={(d) => {
                    const date = new Date(d);
                    return `${date.getDate()}/${date.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                <RechartsTooltip
                  contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: number) => formatCurrency(value, currency)) as any}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  labelFormatter={((label: string) => new Date(label).toLocaleDateString()) as any}
                />
                <Line type="monotone" dataKey="revenue" stroke="#d97706" strokeWidth={2} dot={{ fill: "#d97706", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Top Products ────────────────────────────────────────── */}
        {data && data.topProducts.length > 0 && (
          <div className="bg-card border border-border rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Package className="size-4 text-muted-foreground" />
              Top Products by Revenue
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.topProducts.slice(0, 8)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} />
                  <RechartsTooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: number) => formatCurrency(value, currency)) as any}
                  />
                  <Bar dataKey="revenue" fill="#d97706" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Sales by Category ───────────────────────────────────── */}
        {data && data.byCategory.length > 0 && (
          <div className="bg-card border border-border rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <PieChart className="size-4 text-muted-foreground" />
              Revenue by Category
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.byCategory}
                    dataKey="revenue"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {data.byCategory.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }}
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={((value: number) => formatCurrency(value, currency)) as any}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── Payment Methods ─────────────────────────────────────── */}
        {data && data.byPaymentMethod.length > 0 && (
          <div className="bg-card border border-border rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="size-4 text-muted-foreground" />
              Payment Methods
            </h3>
            <div className="space-y-3">
              {data.byPaymentMethod.map((pm, i) => {
                const pct = s?.totalRevenue ? (pm.total / s.totalRevenue) * 100 : 0;
                return (
                  <div key={pm.method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium capitalize text-foreground">{pm.method.replace(/_/g, " ")}</span>
                      <span className="text-muted-foreground">{pm.count} sales &middot; {formatCurrency(pm.total, currency)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Salesperson Performance ─────────────────────────────── */}
        {data && data.bySalesperson.length > 0 && (
          <div className="bg-card border border-border rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <Users className="size-4 text-muted-foreground" />
              Salesperson Performance
            </h3>
            <div className="space-y-3">
              {data.bySalesperson.map((sp, i) => {
                const pct = s?.totalRevenue ? (sp.total / s.totalRevenue) * 100 : 0;
                return (
                  <div key={sp.name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-foreground">{sp.name}</span>
                      <span className="text-muted-foreground">{sp.count} sales &middot; {formatCurrency(sp.total, currency)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Low Stock Alert ──────────────────────────────────────── */}
      {data && data.lowStockProducts.length > 0 && (
        <div className="bg-card border border-border rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-500" />
            Low Stock Alert
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.lowStockProducts.map((p) => (
              <div key={p.name} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.category}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${p.stockQty <= 0 ? "text-red-500" : "text-amber-600 dark:text-amber-400"}`}>
                    {p.stockQty}
                  </p>
                  <p className="text-xs text-muted-foreground">min: {p.minStockQty}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Invoice Summary ──────────────────────────────────────── */}
      {inv && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KPICard icon={FileText} label="Total Invoices" value={String(inv.total)} color="blue" />
          <KPICard icon={DollarSign} label="Paid Revenue" value={formatCurrency(inv.totalPaid, currency)} color="emerald" />
          <KPICard icon={AlertTriangle} label="Outstanding" value={formatCurrency(inv.totalOutstanding, currency)} color="amber" />
          <KPICard icon={FileText} label="Overdue" value={String(inv.overdue)} color="red" />
        </div>
      )}
    </div>
  );
}

// ── KPI Card Component ──────────────────────────────────────────────────

function KPICard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: "blue" | "emerald" | "amber" | "purple" | "red";
}) {
  const colorMap = {
    blue: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
    emerald: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
    amber: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
    purple: "bg-purple-500/12 text-purple-600 dark:text-purple-400",
    red: "bg-red-500/12 text-red-600 dark:text-red-400",
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-lg ${colorMap[color].split(" ")[0]}`}>
          <Icon className={`size-5 ${colorMap[color].split(" ").slice(1).join(" ")}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-xl font-semibold tracking-tight text-foreground truncate">{value}</p>
        </div>
      </div>
    </div>
  );
}
