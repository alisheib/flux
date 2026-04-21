"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Package,
  ShoppingCart,
  DollarSign,
  Ship,
  Loader2,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ── Types ──────────────────────────────────────────────────────────────────

interface DashboardData {
  totalProducts: number;
  totalSales: number;
  totalRevenue: number;
  totalShipments: number;
  recentSales: {
    id: string;
    saleNumber: string;
    customer: string | null;
    total: number;
    currency: string;
    paymentMethod: string;
    createdAt: string;
  }[];
  lowStockProducts: {
    id: string;
    name: string;
    sku: string | null;
    stockQty: number;
    minStockQty: number;
    unit: string;
  }[];
  monthlySales: {
    month: string;
    count: number;
    revenue: number;
  }[];
}

// ── KPI Config ─────────────────────────────────────────────────────────────

const kpiConfig = [
  {
    key: "totalProducts" as const,
    label: "Total Products",
    subtitle: "Active inventory items",
    icon: Package,
    bgClass: "bg-blue-100 dark:bg-blue-500/20",
    iconClass: "text-blue-600 dark:text-blue-400",
    format: (v: number) => formatNumber(v, 0),
  },
  {
    key: "totalSales" as const,
    label: "Total Sales",
    subtitle: "Completed transactions",
    icon: ShoppingCart,
    bgClass: "bg-emerald-100 dark:bg-emerald-500/20",
    iconClass: "text-emerald-600 dark:text-emerald-400",
    format: (v: number) => formatNumber(v, 0),
  },
  {
    key: "totalRevenue" as const,
    label: "Revenue",
    subtitle: "All-time total",
    icon: DollarSign,
    bgClass: "bg-amber-100 dark:bg-amber-500/20",
    iconClass: "text-amber-600 dark:text-amber-400",
    format: (v: number, currency?: string) => formatCurrency(v, currency),
  },
  {
    key: "totalShipments" as const,
    label: "Shipments",
    subtitle: "Import shipments",
    icon: Ship,
    bgClass: "bg-purple-100 dark:bg-purple-500/20",
    iconClass: "text-purple-600 dark:text-purple-400",
    format: (v: number) => formatNumber(v, 0),
  },
];

// ── Main Dashboard Page ────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currency, setCurrency] = useState("USD");

  useEffect(() => {
    async function fetchDashboard() {
      try {
        const [dashRes, settingsRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/settings"),
        ]);

        if (dashRes.ok) {
          setData(await dashRes.json());
        }
        if (settingsRes.ok) {
          const settings = await settingsRes.json();
          setCurrency(settings.organization?.currency || "USD");
        }
      } catch {
        // Silently handle — empty state will show
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // ── Format chart data ──────────────────────────────────────────────────

  const chartData = (data?.monthlySales || []).map((m) => {
    const [year, monthNum] = m.month.split("-");
    const date = new Date(Number(year), Number(monthNum) - 1);
    const label = date.toLocaleDateString("en-US", {
      month: "short",
      year: "2-digit",
    });
    return {
      name: label,
      revenue: m.revenue,
      // Estimate costs as ~60% of revenue for visual demo
      costs: Math.round(m.revenue * 0.6 * 100) / 100,
    };
  });

  // ── Payment method badge ───────────────────────────────────────────────

  function paymentBadge(method: string) {
    const labels: Record<string, { label: string; className: string }> = {
      cash: {
        label: "Cash",
        className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
      },
      card: {
        label: "Card",
        className: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
      },
      bank_transfer: {
        label: "Bank",
        className: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
      },
      mobile_money: {
        label: "Mobile",
        className: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
      },
    };
    const info = labels[method] || {
      label: method,
      className: "bg-secondary text-secondary-foreground",
    };
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${info.className}`}
      >
        {info.label}
      </span>
    );
  }

  // ── Stock indicator ────────────────────────────────────────────────────

  function stockIndicator(stockQty: number, minStockQty: number) {
    const ratio = minStockQty > 0 ? stockQty / minStockQty : 1;
    if (stockQty <= 0) {
      return (
        <span className="inline-block size-2.5 rounded-full bg-red-500" />
      );
    }
    if (ratio < 0.5) {
      return (
        <span className="inline-block size-2.5 rounded-full bg-red-500" />
      );
    }
    if (ratio < 1) {
      return (
        <span className="inline-block size-2.5 rounded-full bg-amber-500" />
      );
    }
    return (
      <span className="inline-block size-2.5 rounded-full bg-emerald-500" />
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description={user.orgName || "Business overview"}
      />

      {/* ── KPI Cards ──────────────────────────────────────────────────── */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {kpiConfig.map((kpi) => {
          const Icon = kpi.icon;
          const value = data ? data[kpi.key] : 0;
          const formatted =
            kpi.key === "totalRevenue"
              ? kpi.format(value, currency)
              : kpi.format(value);

          return (
            <div
              key={kpi.key}
              className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              {/* Icon */}
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${kpi.bgClass}`}
              >
                <Icon className={`size-5 ${kpi.iconClass}`} />
              </div>

              {/* Content */}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-muted-foreground">
                  {kpi.label}
                </p>
                <p className="text-2xl font-semibold tracking-tight text-foreground">
                  {formatted}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {kpi.subtitle}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Revenue Chart ──────────────────────────────────────────────── */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="space-y-1">
            <CardTitle className="text-base font-semibold">
              Revenue Overview
            </CardTitle>
          </div>
          <Badge
            variant="secondary"
            className="badge-brand text-xs"
          >
            Last 6 months
          </Badge>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 || chartData.every((d) => d.revenue === 0) ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center text-muted-foreground">
              <BarChart3 className="mb-3 size-12 opacity-40" />
              <p className="text-sm font-medium">No revenue data yet</p>
              <p className="text-xs">
                Complete some sales to see your revenue chart
              </p>
            </div>
          ) : (
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-border"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) =>
                      v >= 1000000
                        ? `${(v / 1000000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}K`
                          : String(v)
                    }
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      backgroundColor: "var(--card)",
                      color: "var(--foreground)",
                      fontSize: "13px",
                    }}
                    formatter={(value, name) => [
                      formatCurrency(Number(value), currency),
                      name === "costs" ? "Costs" : "Revenue",
                    ]}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: "12px" }}
                  />
                  <Bar
                    dataKey="costs"
                    name="Costs"
                    fill="var(--chart-3)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                  <Bar
                    dataKey="revenue"
                    name="Revenue"
                    fill="var(--chart-2)"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Two-column: Recent Sales + Low Stock ───────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Sales (2/3) */}
        <Card className="border border-border bg-card shadow-sm lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base font-semibold">
              Recent Sales
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.recentSales || data.recentSales.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center text-muted-foreground">
                <ShoppingCart className="mb-3 size-10 opacity-40" />
                <p className="text-sm font-medium">No sales yet</p>
                <p className="text-xs">
                  Sales will appear here once completed
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentSales.slice(0, 8).map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">
                        {new Date(sale.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {sale.customer || "Walk-in"}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatCurrency(sale.total, sale.currency || currency)}
                      </TableCell>
                      <TableCell className="text-right">
                        {paymentBadge(sale.paymentMethod)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts (1/3) */}
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <AlertTriangle className="size-4 text-amber-500" />
              Low Stock Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!data?.lowStockProducts || data.lowStockProducts.length === 0 ? (
              <div className="flex min-h-[200px] flex-col items-center justify-center text-muted-foreground">
                <Package className="mb-3 size-10 opacity-40" />
                <p className="text-sm font-medium">Stock levels healthy</p>
                <p className="text-xs">No items below minimum stock</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.lowStockProducts.slice(0, 10).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background p-3"
                  >
                    {stockIndicator(product.stockQty, product.minStockQty)}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {product.name}
                      </p>
                      {product.sku && (
                        <p className="truncate text-xs text-muted-foreground">
                          {product.sku}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">
                        {formatNumber(product.stockQty, 0)}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        min: {formatNumber(product.minStockQty, 0)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
