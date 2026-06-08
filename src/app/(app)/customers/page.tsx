"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CustomerDialog } from "@/components/customer-dialog";
import { toast } from "sonner";
import {
  Plus, Download, Search, Users, TrendingUp, ShoppingBag, Wallet,
  MoreHorizontal, Pencil, Eye, CreditCard, UserX, Loader2,
} from "lucide-react";

interface Customer {
  id: string;
  name: string;
  company: string | null;
  tin: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  status: string;
  totalSpent: number;
  outstanding: number;
  salesCount: number;
  lastSaleAt: string | null;
  isActive: boolean;
  initials: string;
}

interface Stats {
  totalCustomers: number;
  activeCount: number;
  totalRevenue: number;
  totalOutstanding: number;
  withBalanceCount: number;
}

const AVATAR_COLORS = ["#d97706", "#2563eb", "#16a34a", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04", "#0f766e"];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function CustomersPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [stats, setStats] = useState<Stats>({ totalCustomers: 0, activeCount: 0, totalRevenue: 0, totalOutstanding: 0, withBalanceCount: 0 });
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [currency, setCurrency] = useState("TSH");

  const fetchCustomers = useCallback(async () => {
    try {
      const [custRes, settingsRes] = await Promise.all([
        fetch("/api/customers"),
        fetch("/api/settings"),
      ]);
      if (custRes.ok) {
        const data = await custRes.json();
        setCustomers(data.customers);
        setStats(data.stats);
      }
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setCurrency(sData.organization?.currency || "TSH");
      }
    } catch {
      toast.error("Failed to load customers");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const filtered = customers.filter(c => {
    if (filter === "active" && !c.isActive) return false;
    if (filter === "balance" && c.outstanding <= 0) return false;
    if (filter === "inactive" && c.status !== "inactive") return false;
    if (search) {
      const s = `${c.name} ${c.company || ""} ${c.tin || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
      if (!s.includes(search.toLowerCase())) return false;
    }
    return true;
  });

  const handleDeactivate = async (id: string, name: string) => {
    if (!confirm(`Deactivate "${name}"? They'll be hidden from search but history is preserved.`)) return;
    try {
      const res = await fetch(`/api/customers/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setCustomers(prev => prev.map(c => c.id === id ? { ...c, status: "inactive" } : c));
      toast.success("Customer deactivated");
    } catch { toast.error("Failed to deactivate"); }
  };

  const FILTERS = [
    { id: "all", label: "All", count: customers.length },
    { id: "active", label: "Active" },
    { id: "balance", label: "With balance", count: stats.withBalanceCount },
    { id: "inactive", label: "Inactive" },
  ];

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <span className="text-foreground">Customers</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
            <p className="text-sm text-muted-foreground mt-1">Repeat buyers — separate from walk-in sales. Track balances, history, and contact details.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={filtered.length === 0} onClick={() => {
              import("@/lib/excel-export").then(({ exportToExcel }) => {
                exportToExcel({
                  filename: "flux-customers",
                  sheetName: "Customers",
                  title: "Customers",
                  columns: [
                    { header: "Name", key: "name", width: 24 },
                    { header: "Company", key: "company", width: 20 },
                    { header: "TIN", key: "tin", width: 14 },
                    { header: "Phone", key: "phone", width: 16 },
                    { header: "Email", key: "email", width: 22 },
                    { header: "Total Spent", key: "totalSpent", width: 16, type: "currency" as const },
                    { header: "Outstanding", key: "outstanding", width: 16, type: "currency" as const },
                    { header: "Status", key: "status", width: 12 },
                  ],
                  data: filtered.map(c => ({ name: c.name, company: c.company || "", tin: c.tin || "", phone: c.phone || "", email: c.email || "", totalSpent: c.totalSpent, outstanding: c.outstanding, status: c.status })),
                  currency,
                });
                toast.success("Exported customers");
              }).catch(() => toast.error("Export failed"));
            }}><Download className="mr-2 h-3.5 w-3.5" />Export</Button>
            <Button className="btn-accent" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-3.5 w-3.5" />Add customer
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<Users className="size-[18px]" />} iconClass="kpi-icon-amber" label="Total customers" value={String(stats.totalCustomers)} sub="all-time records" />
        <KpiCard icon={<TrendingUp className="size-[18px]" />} iconClass="kpi-icon-green" label="Active" value={String(stats.activeCount)} sub="bought in last 90 days" />
        <KpiCard icon={<ShoppingBag className="size-[18px]" />} iconClass="kpi-icon-blue" label="Total revenue" value={formatCurrency(stats.totalRevenue, currency)} sub="lifetime, from customers" />
        <KpiCard icon={<Wallet className="size-[18px]" />} iconClass="kpi-icon-amber" label="Outstanding" value={formatCurrency(stats.totalOutstanding, currency)} sub={stats.withBalanceCount > 0 ? `${stats.withBalanceCount} customers with balance` : ""} />
      </div>

      {/* Table Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="px-3.5 py-3 border-b border-border/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(f => (
              <button key={f.id} onClick={() => setFilter(f.id)} className={`chip ${filter === f.id ? "active" : ""}`}>
                {f.label}
                {f.count != null && <span className="text-[11px] opacity-60 font-mono ml-1">{f.count}</span>}
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-[320px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, TIN, email..." className="pl-8 h-9 text-[13px]" />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="empty-state-icon mx-auto mb-4"><Users className="size-7" /></div>
            <h3 className="text-base font-semibold mb-1">{search || filter !== "all" ? "No matches" : "No customers yet"}</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
              {search || filter !== "all"
                ? "Try clearing your filters or search."
                : "Walk-in sales don't need a customer record. Add a customer when someone returns or asks for an invoice."}
            </p>
            {!search && filter === "all" && (
              <Button className="btn-accent" size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-2 h-3.5 w-3.5" />Add your first customer
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">TIN</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Phone</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Purchases</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Outstanding</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last purchase</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(c => {
                  const bg = AVATAR_COLORS[c.initials.charCodeAt(0) % AVATAR_COLORS.length];
                  return (
                    <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/customers/${c.id}`)}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: `linear-gradient(135deg, ${bg}, color-mix(in oklab, ${bg} 70%, black))` }}>
                            {c.initials}
                          </div>
                          <div>
                            <div className="font-semibold text-foreground">{c.name}</div>
                            {c.company && <div className="text-[11.5px] text-muted-foreground">{c.company}</div>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-[12.5px]">{c.tin || <span className="text-muted-foreground/50">--</span>}</TableCell>
                      <TableCell className="font-mono text-[12.5px] text-muted-foreground">{c.phone || "--"}</TableCell>
                      <TableCell className="text-right font-mono">{formatCurrency(c.totalSpent, currency)}</TableCell>
                      <TableCell className={`text-right font-mono ${c.outstanding > 0 ? "text-amber-700 dark:text-amber-400 font-semibold" : "text-muted-foreground/50"}`}>
                        {c.outstanding > 0 ? formatCurrency(c.outstanding, currency) : "--"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(c.lastSaleAt)}</TableCell>
                      <TableCell>
                        {c.status === "active" && c.isActive && <StatusBadge kind="success">Active</StatusBadge>}
                        {c.status === "active" && !c.isActive && c.salesCount > 0 && <StatusBadge kind="neutral">Inactive</StatusBadge>}
                        {c.status === "active" && c.salesCount === 0 && <StatusBadge kind="info">New</StatusBadge>}
                        {c.status === "inactive" && <StatusBadge kind="neutral">Inactive</StatusBadge>}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0"><MoreHorizontal className="size-3.5" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); router.push(`/customers/${c.id}`); }}><Eye className="mr-2 h-3.5 w-3.5" />View</DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); router.push(`/customers/${c.id}`); }}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); router.push(`/receivables?customer=${c.id}`); }}><CreditCard className="mr-2 h-3.5 w-3.5" />Record payment</DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); handleDeactivate(c.id, c.name); }}><UserX className="mr-2 h-3.5 w-3.5" />Deactivate</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CustomerDialog open={dialogOpen} onOpenChange={setDialogOpen} mode="add" onSaved={() => fetchCustomers()} />
    </div>
  );
}

function KpiCard({ icon, iconClass, label, value, sub }: { icon: React.ReactNode; iconClass: string; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${iconClass}`}>{icon}</div>
      <div>
        <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
        <div className="text-xl font-bold tracking-tight truncate">{value}</div>
        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

function StatusBadge({ kind, children }: { kind: string; children: React.ReactNode }) {
  const styles: Record<string, string> = {
    success: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
    neutral: "bg-muted text-muted-foreground",
    info: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${styles[kind] || styles.neutral}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
