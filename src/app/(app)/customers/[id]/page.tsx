"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { CustomerDialog } from "@/components/customer-dialog";
import { toast } from "sonner";
import {
  Pencil, Wallet, ShoppingBag, Phone, Mail, MapPin,
  Loader2, TrendingUp, Clock, ChevronLeft,
} from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

const AVATAR_COLORS = ["#d97706", "#2563eb", "#16a34a", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04", "#0f766e"];

export default function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<any>(null);
  const [tab, setTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [currency, setCurrency] = useState("TSH");

  const fetchCustomer = useCallback(async () => {
    const { id } = await params;
    try {
      const [custRes, settingsRes] = await Promise.all([
        fetch(`/api/customers/${id}`),
        fetch("/api/settings"),
      ]);
      if (!custRes.ok) { router.push("/customers"); return; }
      setCustomer(await custRes.json());
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        setCurrency(s.organization?.currency || "TSH");
      }
    } catch {
      toast.error("Failed to load customer");
      router.push("/customers");
    } finally { setLoading(false); }
  }, [params, router]);

  useEffect(() => { fetchCustomer(); }, [fetchCustomer]);

  if (loading || !customer) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  const c = customer;
  const stats = c.stats || {};
  const initials: string = c.initials || "?";
  const bg = AVATAR_COLORS[(initials).charCodeAt(0) % AVATAR_COLORS.length];
  const tags: string[] = c.tags || [];
  const sales: any[] = c.sales || [];
  const invoices: any[] = c.invoices || [];
  const payments: any[] = c.payments || [];
  const monthlyRevenue: number[] = stats.monthlyRevenue || [];
  const maxRev = Math.max(...monthlyRevenue, 1);
  const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
        <button onClick={() => router.push("/customers")} className="hover:text-foreground"><ChevronLeft className="inline size-3" /> Customers</button>
        <span>/</span><span className="text-foreground">{c.name}</span>
      </div>

      {/* Header Card */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-start gap-4 flex-wrap">
          <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0" style={{ background: `linear-gradient(135deg, ${bg}, color-mix(in oklab, ${bg} 70%, black))` }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap mb-1">
              <h1 className="text-[22px] font-bold tracking-tight">{c.name}</h1>
              <StatusBadge status={c.status} isActive={(stats.lastSaleAt) !== null} salesCount={stats.salesCount as number} />
              {tags.map(t => (
                <span key={t} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">{t}</span>
              ))}
            </div>
            {c.company ? <div className="text-sm text-muted-foreground mb-2.5">{c.company}</div> : null}
            <div className="flex gap-4 text-[13px] text-muted-foreground flex-wrap">
              {c.tin && (
                <span className="inline-flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">TIN</span>
                  <span className="font-mono text-foreground">{c.tin}</span>
                </span>
              )}
              {c.phone && <a href={`tel:${c.phone}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Phone className="size-3.5" /><span className="font-mono">{c.phone}</span></a>}
              {c.email && <a href={`mailto:${c.email}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><Mail className="size-3.5" />{c.email}</a>}
              {c.address && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{c.address}</span>}
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}><Pencil className="mr-2 h-3.5 w-3.5" />Edit</Button>
            <Button variant="outline" size="sm"><Wallet className="mr-2 h-3.5 w-3.5" />Record payment</Button>
            <Button className="btn-accent" size="sm" onClick={() => router.push("/pos")}><ShoppingBag className="mr-2 h-3.5 w-3.5" />New sale</Button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0 border-b border-border overflow-x-auto">
        {["overview", "purchases", "invoices", "payments"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-3 text-sm font-semibold capitalize border-b-2 whitespace-nowrap transition-colors ${
            tab === t ? "text-foreground border-amber-500" : "text-muted-foreground border-transparent hover:text-foreground"
          }`} style={{ marginBottom: -1 }}>{t}</button>
        ))}
      </div>

      {/* Tab Content */}
      {tab === "overview" && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard icon={<ShoppingBag className="size-[18px]" />} iconClass="kpi-icon-amber" label="Total spent" value={formatCurrency(stats.totalSpent, currency)} sub={`across ${stats.salesCount} orders`} />
            <KpiCard icon={<Wallet className="size-[18px]" />} iconClass="kpi-icon-amber" label="Outstanding" value={formatCurrency(stats.outstanding, currency)} sub="" />
            <KpiCard icon={<TrendingUp className="size-[18px]" />} iconClass="kpi-icon-blue" label="Avg order" value={formatCurrency(stats.avgOrder, currency)} sub="" />
            <KpiCard icon={<Clock className="size-[18px]" />} iconClass="kpi-icon-purple" label="Last purchase" value={stats.lastSaleAt ? timeAgo(stats.lastSaleAt as string) : "Never"} sub="" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
            {/* Chart */}
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex justify-between items-baseline mb-3.5">
                <h3 className="text-sm font-semibold">Monthly revenue from this customer</h3>
                <span className="text-xs text-muted-foreground">Last 12 months</span>
              </div>
              <svg width="100%" height="200" viewBox="0 0 600 200" className="block">
                {monthlyRevenue.map((v, i) => {
                  const x = 20 + i * 48;
                  const h = (v / maxRev) * 160;
                  const y = 180 - h;
                  const isLast = i === monthlyRevenue.length - 1;
                  return (
                    <g key={i}>
                      <rect x={x} y={y} width="32" height={Math.max(h, 2)} rx="4" className={isLast ? "fill-amber-500" : "fill-amber-500/25"} />
                      <text x={x + 16} y="195" textAnchor="middle" className="fill-muted-foreground text-[9px] font-mono">{MONTHS[(new Date().getMonth() - 11 + i + 12) % 12]}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
            {/* Recent purchases */}
            <div className="rounded-xl border border-border bg-card p-4">
              <h3 className="text-sm font-semibold mb-3">Recent purchases</h3>
              {sales.slice(0, 5).map((s, i) => (
                <div key={i} className="flex justify-between items-center py-2 border-b border-border/30 last:border-0">
                  <div>
                    <div className="text-[12.5px] font-mono font-medium">{s.saleNumber}</div>
                    <div className="text-[11px] text-muted-foreground">{new Date(s.createdAt as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[13px] font-semibold font-mono">{formatCurrency(s.total, currency)}</div>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      s.status === "completed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" : "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                    }`}>{(s.status as string) === "completed" ? "Paid" : s.status}</span>
                  </div>
                </div>
              ))}
              {sales.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">No purchases yet</div>}
            </div>
          </div>
        </>
      )}

      {tab === "purchases" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sale #</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Items</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Total</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Method</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {sales.map((s, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(s.createdAt as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</TableCell>
                  <TableCell className="font-mono font-medium">{s.saleNumber}</TableCell>
                  <TableCell className="text-right font-mono">{((s.items) || []).length}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatCurrency(s.total, currency)}</TableCell>
                  <TableCell><span className="badge-neutral">{s.paymentMethod}</span></TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                      s.status === "completed" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" :
                      s.status === "credit" ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" :
                      "bg-muted text-muted-foreground"
                    }`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{s.status}</span>
                  </TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No purchases yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === "invoices" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice #</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Amount</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Due</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {invoices.map((inv, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(inv.issuedAt as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</TableCell>
                  <TableCell className="font-mono font-medium">{inv.number}</TableCell>
                  <TableCell className="text-right font-mono font-semibold">{formatCurrency(inv.total, currency)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{inv.dueAt ? new Date(inv.dueAt as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "--"}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                      inv.status === "paid" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" :
                      inv.status === "issued" ? "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" :
                      inv.status === "overdue" ? "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300" :
                      "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                    }`}><span className="w-1.5 h-1.5 rounded-full bg-current" />{inv.status}</span>
                  </TableCell>
                </TableRow>
              ))}
              {invoices.length === 0 && <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">No invoices yet</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      {tab === "payments" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <Table>
            <TableHeader><TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Amount</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Method</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Reference</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sale #</TableHead>
              <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recorded by</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {payments.map((p, i) => (
                <TableRow key={i}>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.date as string).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</TableCell>
                  <TableCell className="text-right font-mono font-semibold text-emerald-700 dark:text-emerald-400">+{formatCurrency(p.amount, currency)}</TableCell>
                  <TableCell><span className="badge-neutral">{p.method}</span></TableCell>
                  <TableCell className="font-mono text-[11.5px] text-muted-foreground">{(p.reference as string) || "--"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.saleNumber}</TableCell>
                  <TableCell className="text-xs">{p.recordedBy}</TableCell>
                </TableRow>
              ))}
              {payments.length === 0 && <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">No payments recorded</TableCell></TableRow>}
            </TableBody>
          </Table>
        </div>
      )}

      <CustomerDialog open={editOpen} onOpenChange={setEditOpen} mode="edit" initialData={{ id: c.id as string, name: c.name as string, company: (c.company as string) || "", tin: (c.tin as string) || "", phone: (c.phone as string) || "", email: (c.email as string) || "", address: (c.address as string) || "", tags, notes: (c.notes as string) || "" }} onSaved={() => fetchCustomer()} />
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

function StatusBadge({ status, isActive, salesCount }: { status: string; isActive: boolean; salesCount: number }) {
  if (status === "inactive") return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-muted text-muted-foreground"><span className="w-1.5 h-1.5 rounded-full bg-current" />Inactive</span>;
  if (salesCount === 0) return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"><span className="w-1.5 h-1.5 rounded-full bg-current" />New</span>;
  return <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"><span className="w-1.5 h-1.5 rounded-full bg-current" />Active</span>;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}
