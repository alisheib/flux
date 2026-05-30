"use client";

// Proforma list page. Mirrors the invoices page structure (KPIs, search,
// status tabs, table, detail dialog) so the two surfaces feel like
// siblings — that's deliberate, see CLAUDE.md > Proforma Architecture.

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Download,
  ClipboardList,
  Search,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  Loader2,
  MoreHorizontal,
  Eye,
  ArrowRightLeft,
  Trash2,
  CalendarClock,
} from "lucide-react";

interface ProformaItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sellingUnit: string;
  area: number | null;
}

interface Proforma {
  id: string;
  number: string;
  customer: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  currency: string;
  status: "draft" | "sent" | "accepted" | "converted" | "expired" | "declined";
  issuedAt: string;
  validUntil: string;
  convertedAt: string | null;
  notes: string | null;
  items: ProformaItem[];
  invoice?: { id: string; number: string } | null;
}

const STATUS_MAP: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  draft:     { label: "Draft",     className: "bg-muted text-muted-foreground",                              icon: ClipboardList },
  sent:      { label: "Sent",      className: "bg-blue-500/12 text-blue-600 dark:text-blue-400",            icon: Clock },
  accepted:  { label: "Accepted",  className: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",   icon: CheckCircle },
  converted: { label: "Converted", className: "bg-[#d97706]/15 text-[#d97706]",                             icon: ArrowRightLeft },
  expired:   { label: "Expired",   className: "bg-amber-500/12 text-amber-700 dark:text-amber-400",         icon: AlertCircle },
  declined:  { label: "Declined",  className: "bg-red-500/12 text-red-600 dark:text-red-400",               icon: XCircle },
};

function StatusBadge({ status }: { status: Proforma["status"] }) {
  const meta = STATUS_MAP[status] ?? STATUS_MAP.draft;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.className}`}>
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}

export default function ProformasPage() {
  const router = useRouter();
  const [proformas, setProformas] = useState<Proforma[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgCurrency, setOrgCurrency] = useState<string>("USD");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [detail, setDetail] = useState<Proforma | null>(null);
  const [converting, setConverting] = useState(false);
  const [convertDialogOpen, setConvertDialogOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Proforma | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [pfRes, settingsRes] = await Promise.all([
        fetch("/api/proformas?limit=500"),
        fetch("/api/settings"),
      ]);
      if (pfRes.ok) {
        const data = await pfRes.json();
        setProformas(data.data || data);
      }
      if (settingsRes.ok) {
        const s = await settingsRes.json();
        if (s?.organization?.currency) setOrgCurrency(s.organization.currency);
      }
    } catch {
      toast.error("Failed to load proformas");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const filtered = useMemo(() => {
    return proformas.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!query) return true;
      const q = query.toLowerCase();
      return (
        p.number.toLowerCase().includes(q) ||
        p.customer.toLowerCase().includes(q) ||
        (p.customerPhone || "").toLowerCase().includes(q)
      );
    });
  }, [proformas, statusFilter, query]);

  const kpis = useMemo(() => {
    const open = proformas.filter((p) => ["draft", "sent", "accepted"].includes(p.status));
    const openValue = open.reduce((s, p) => s + p.total, 0);
    const converted = proformas.filter((p) => p.status === "converted");
    const convertedValue = converted.reduce((s, p) => s + p.total, 0);
    const expired = proformas.filter((p) => p.status === "expired").length;
    return {
      openCount: open.length,
      openValue,
      convertedCount: converted.length,
      convertedValue,
      expired,
    };
  }, [proformas]);

  const handleDownload = async (p: Proforma) => {
    try {
      const res = await fetch(`/api/proformas/${p.id}/download`);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${p.number}.${res.headers.get("content-type")?.includes("pdf") ? "pdf" : "html"}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    }
  };

  const handleConvert = async () => {
    if (!detail) return;
    setConverting(true);
    try {
      const res = await fetch(`/api/proformas/${detail.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: "credit" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Convert failed");
      toast.success(`Converted to invoice ${data.invoice.number}`);
      setConvertDialogOpen(false);
      setDetail(null);
      await fetchAll();
      router.push(`/invoices`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Convert failed");
    } finally {
      setConverting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/proformas/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Delete failed");
      }
      toast.success("Proforma deleted");
      setDeleteTarget(null);
      await fetchAll();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Proformas" description="Price quotations issued to customers" />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={<Clock className="size-5 text-blue-600 dark:text-blue-400" />}
          iconBg="bg-blue-500/12"
          label="Open"
          value={String(kpis.openCount)}
          sub={formatCurrency(kpis.openValue, orgCurrency)}
        />
        <KpiCard
          icon={<ArrowRightLeft className="size-5 text-[#d97706]" />}
          iconBg="bg-[#d97706]/15"
          label="Converted"
          value={String(kpis.convertedCount)}
          sub={formatCurrency(kpis.convertedValue, orgCurrency)}
        />
        <KpiCard
          icon={<CalendarClock className="size-5 text-amber-700 dark:text-amber-400" />}
          iconBg="bg-amber-500/12"
          label="Expired"
          value={String(kpis.expired)}
          sub="Past validity"
        />
        <KpiCard
          icon={<ClipboardList className="size-5 text-muted-foreground" />}
          iconBg="bg-muted"
          label="All time"
          value={String(proformas.length)}
          sub="Total issued"
        />
      </div>

      {/* Tabs by status — search + table sit OUTSIDE TabsContent because
          we're using `statusFilter` state to drive filtering ourselves;
          a TabsContent block with a dynamic `value` would mount/unmount
          on every keystroke and the search input would lose focus.
          This is the same pattern Invoices uses. */}
      <Tabs value={statusFilter} onValueChange={setStatusFilter} className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="draft">Draft</TabsTrigger>
            <TabsTrigger value="sent">Sent</TabsTrigger>
            <TabsTrigger value="accepted">Accepted</TabsTrigger>
            <TabsTrigger value="converted">Converted</TabsTrigger>
            <TabsTrigger value="expired">Expired</TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by number, customer, or phone..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Number</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Issued</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Valid Until</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Total</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                      <ClipboardList className="mx-auto mb-3 size-10 opacity-30" />
                      <p className="text-sm">No proformas {query || statusFilter !== "all" ? "match your filter" : "yet"}</p>
                      <p className="text-xs mt-1">
                        {query || statusFilter !== "all"
                          ? "Try a different search or status."
                          : "Build a cart in POS and choose “Save as proforma” to issue your first quote."}
                      </p>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((p) => (
                    <TableRow key={p.id} className="hover:bg-muted/40 transition-colors">
                      <TableCell className="font-mono text-sm font-semibold text-foreground">{p.number}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{p.customer}</div>
                        {p.customerPhone && (
                          <div className="text-xs text-muted-foreground font-mono">{p.customerPhone}</div>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(p.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(p.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </TableCell>
                      <TableCell className="text-right font-medium font-mono text-foreground">
                        {formatCurrency(p.total, p.currency || orgCurrency)}
                      </TableCell>
                      <TableCell><StatusBadge status={p.status} /></TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-xs">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDetail(p)}>
                              <Eye className="mr-2 size-4" /> View
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDownload(p)}>
                              <Download className="mr-2 size-4" /> Download PDF
                            </DropdownMenuItem>
                            {p.status !== "converted" && p.status !== "declined" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => { setDetail(p); setConvertDialogOpen(true); }}>
                                  <ArrowRightLeft className="mr-2 size-4" /> Convert to invoice
                                </DropdownMenuItem>
                              </>
                            )}
                            {p.status !== "converted" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(p)}>
                                  <Trash2 className="mr-2 size-4" /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
      </Tabs>

      {/* Detail dialog */}
      <Dialog open={!!detail && !convertDialogOpen} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-xl">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {detail.number}
                  <StatusBadge status={detail.status} />
                </DialogTitle>
                <DialogDescription>
                  Issued {new Date(detail.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} · valid until {new Date(detail.validUntil).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  {detail.invoice && <> · converted to <span className="font-medium text-foreground">{detail.invoice.number}</span></>}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Customer</h4>
                  <p className="font-medium text-foreground">{detail.customer}</p>
                  {detail.customerPhone && <p className="text-sm text-muted-foreground font-mono">{detail.customerPhone}</p>}
                  {detail.customerEmail && <p className="text-sm text-muted-foreground">{detail.customerEmail}</p>}
                  {detail.customerAddress && <p className="text-sm text-muted-foreground">{detail.customerAddress}</p>}
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs uppercase tracking-wide">Item</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-right">Qty</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-right">Unit Price</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detail.items.map((it) => (
                        <TableRow key={it.id}>
                          <TableCell>{it.name}</TableCell>
                          <TableCell className="text-right font-mono">
                            {it.sellingUnit === "sqm" && it.area ? `${it.area} m²` : it.quantity}
                          </TableCell>
                          <TableCell className="text-right font-mono">{formatCurrency(it.unitPrice, detail.currency)}</TableCell>
                          <TableCell className="text-right font-mono font-medium">{formatCurrency(it.total, detail.currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="ml-auto w-64 space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span className="font-mono">{formatCurrency(detail.subtotal, detail.currency)}</span></div>
                  {detail.discount > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span className="font-mono text-red-500">-{formatCurrency(detail.discount, detail.currency)}</span></div>}
                  {detail.taxRate > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Tax ({detail.taxRate}%)</span><span className="font-mono">{formatCurrency(detail.taxAmount, detail.currency)}</span></div>}
                  <div className="flex justify-between pt-2 border-t font-semibold"><span>Total</span><span className="font-mono text-[#d97706]">{formatCurrency(detail.total, detail.currency)}</span></div>
                </div>

                {detail.notes && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{detail.notes}</p>
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => handleDownload(detail)}>
                  <Download className="mr-1.5 size-4" /> Download PDF
                </Button>
                {detail.status !== "converted" && detail.status !== "declined" && (
                  <Button onClick={() => setConvertDialogOpen(true)} className="bg-[#d97706] hover:bg-[#c2410c] text-white">
                    <ArrowRightLeft className="mr-1.5 size-4" /> Convert to invoice
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Convert confirmation */}
      <Dialog open={convertDialogOpen} onOpenChange={(o) => !o && !converting && setConvertDialogOpen(false)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Convert to tax invoice?</DialogTitle>
            <DialogDescription>
              This will create a new invoice {detail ? `(from ${detail.number})` : ""}, decrement stock for every line item, and lock the proforma. The proforma PDF will remain downloadable with a “Converted” stamp.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertDialogOpen(false)} disabled={converting}>Cancel</Button>
            <Button onClick={handleConvert} disabled={converting} className="bg-[#d97706] hover:bg-[#c2410c] text-white">
              {converting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Convert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && !deleting && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete proforma {deleteTarget?.number}?</DialogTitle>
            <DialogDescription>This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({ icon, iconBg, label, value, sub }: { icon: React.ReactNode; iconBg: string; label: string; value: string; sub: string }) {
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-3">
        <div className={`flex size-10 items-center justify-center rounded-lg ${iconBg}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
          <p className="text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{sub}</p>
        </div>
      </div>
    </div>
  );
}
