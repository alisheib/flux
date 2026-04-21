"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
  TabsContent,
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
  FileText,
  Search,
  MessageCircle,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  DollarSign,
  ReceiptText,
  Loader2,
  MoreHorizontal,
  Eye,
  Mail,
  Printer,
  Ban,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
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
  status: string;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  notes: string | null;
  sale?: {
    id: string;
    items: InvoiceItem[];
  } | null;
}

interface OrgSettings {
  currency: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxLabel: string;
}

// ── Status helpers ───────────────────────────────────────────────────────────

const statusConfig: Record<
  string,
  { label: string; dotColor: string; badgeBg: string; badgeText: string; icon: React.ElementType }
> = {
  issued: {
    label: "Issued",
    dotColor: "bg-blue-500",
    badgeBg: "bg-blue-500/12",
    badgeText: "text-blue-600 dark:text-blue-400",
    icon: Clock,
  },
  paid: {
    label: "Paid",
    dotColor: "bg-emerald-500",
    badgeBg: "bg-emerald-500/12",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    icon: CheckCircle,
  },
  overdue: {
    label: "Overdue",
    dotColor: "bg-red-500",
    badgeBg: "bg-red-500/12",
    badgeText: "text-red-600 dark:text-red-400",
    icon: AlertCircle,
  },
  cancelled: {
    label: "Cancelled",
    dotColor: "bg-gray-400",
    badgeBg: "bg-gray-500/12",
    badgeText: "text-gray-600 dark:text-gray-400",
    icon: XCircle,
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || statusConfig.issued;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeBg} ${config.badgeText}`}>
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const { user } = useAuth();

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings>({
    currency: "USD",
    name: "",
    phone: null,
    email: null,
    address: null,
    taxLabel: "Tax",
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Detail dialog
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [invoicesRes, settingsRes] = await Promise.all([
        fetch("/api/invoices"),
        fetch("/api/settings"),
      ]);

      if (invoicesRes.ok) setInvoices(await invoicesRes.json());
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setOrgSettings({
          currency: data.currency || "USD",
          name: data.name || "",
          phone: data.phone || null,
          email: data.email || null,
          address: data.address || null,
          taxLabel: data.taxLabel || "Tax",
        });
      }
    } catch {
      toast.error("Failed to load invoices");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── KPI Metrics ──────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const totalInvoices = invoices.length;
    const paid = invoices.filter((inv) => inv.status === "paid").length;
    const pending = invoices.filter(
      (inv) => inv.status === "issued" || inv.status === "overdue"
    ).length;
    const totalRevenue = invoices
      .filter((inv) => inv.status === "paid")
      .reduce((sum, inv) => sum + inv.total, 0);
    return { totalInvoices, paid, pending, totalRevenue };
  }, [invoices]);

  // ── Filtered Invoices ──────────────────────────────────────────────────

  const filteredInvoices = useMemo(() => {
    let filtered = invoices;

    // Tab filter
    if (activeTab !== "all") {
      filtered = filtered.filter((inv) => inv.status === activeTab);
    }

    // Date range filter
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter((inv) => new Date(inv.issuedAt) >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter((inv) => new Date(inv.issuedAt) <= to);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (inv) =>
          inv.number.toLowerCase().includes(q) ||
          inv.customer.toLowerCase().includes(q) ||
          (inv.customerPhone && inv.customerPhone.includes(q))
      );
    }

    return filtered;
  }, [invoices, activeTab, searchQuery, dateFrom, dateTo]);

  // ── View Invoice Detail ────────────────────────────────────────────────

  const viewInvoiceDetail = async (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setDetailDialogOpen(true);

    // Fetch full detail with items if not already loaded
    if (!invoice.sale?.items) {
      setLoadingDetail(true);
      try {
        const res = await fetch(`/api/invoices/${invoice.id}`);
        if (res.ok) {
          const fullInvoice = await res.json();
          setSelectedInvoice(fullInvoice);
        }
      } catch {
        // Use what we have
      } finally {
        setLoadingDetail(false);
      }
    }
  };

  // ── Mark as Paid ───────────────────────────────────────────────────────

  const markAsPaid = async (invoice: Invoice) => {
    try {
      const response = await fetch(`/api/invoices/${invoice.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paid", paidAt: new Date().toISOString() }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update invoice");
      }

      toast.success(`Invoice ${invoice.number} marked as paid`);
      fetchData();

      // Update selected if open
      if (selectedInvoice?.id === invoice.id) {
        setSelectedInvoice((prev) =>
          prev
            ? { ...prev, status: "paid", paidAt: new Date().toISOString() }
            : null
        );
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to update invoice";
      toast.error(message);
    }
  };

  // ── WhatsApp Share ─────────────────────────────────────────────────────

  const generateInvoiceText = (invoice: Invoice): string => {
    const items = invoice.sale?.items || [];
    const lines = [
      `Invoice #${invoice.number}`,
      `Date: ${new Date(invoice.issuedAt).toLocaleDateString()}`,
      `Customer: ${invoice.customer}`,
      "",
      "Items:",
      ...items.map(
        (item) =>
          `- ${item.name} x${item.quantity} = ${formatCurrency(item.total, invoice.currency)}`
      ),
      "",
      `Subtotal: ${formatCurrency(invoice.subtotal, invoice.currency)}`,
      invoice.taxRate > 0
        ? `${orgSettings.taxLabel} (${invoice.taxRate}%): ${formatCurrency(invoice.taxAmount, invoice.currency)}`
        : "",
      invoice.discount > 0
        ? `Discount: -${formatCurrency(invoice.discount, invoice.currency)}`
        : "",
      `Total: ${formatCurrency(invoice.total, invoice.currency)}`,
      "",
      "Thank you for your business!",
      orgSettings.name || "Flux Business Platform",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const shareWhatsApp = (invoice: Invoice) => {
    const text = generateInvoiceText(invoice);
    const phone = invoice.customerPhone
      ? invoice.customerPhone.replace(/[^0-9+]/g, "").replace(/^\+/, "")
      : "";

    // Use api.whatsapp.com for better mobile compatibility
    const baseUrl = "https://api.whatsapp.com/send";
    const params = new URLSearchParams({ text });
    if (phone) params.set("phone", phone);

    const url = `${baseUrl}?${params.toString()}`;
    window.open(url, "_blank");
  };

  // ── Download PDF ──────────────────────────────────────────────────────

  const downloadPdf = async (invoice: Invoice) => {
    try {
      toast.info("Generating PDF...");
      const res = await fetch(`/api/invoices/${invoice.id}/pdf`);
      if (!res.ok) throw new Error("Failed to fetch invoice data");
      const data = await res.json();

      const { generateInvoicePDF } = await import("@/lib/invoice-pdf");
      const blob = await generateInvoicePDF(data);

      // Create a proper blob with explicit PDF MIME type
      const pdfBlob = new Blob([blob], { type: "application/pdf" });
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `invoice-${invoice.number}.pdf`;
      // Append to DOM for cross-browser compatibility (Safari requires this)
      document.body.appendChild(a);
      a.click();
      // Delay cleanup to ensure the download has started
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 100);
      toast.success("PDF downloaded");
    } catch (err) {
      console.error("PDF generation error:", err);
      toast.error("Failed to generate PDF");
    }
  };

  // ── Send Email (placeholder) ───────────────────────────────────────────

  const sendEmail = (invoice: Invoice) => {
    toast.info(
      `Email functionality coming soon. Invoice ${invoice.number} would be sent to ${invoice.customerEmail || "the customer"}.`
    );
  };

  // ── Export ─────────────────────────────────────────────────────────────

  const handleExport = async () => {
    const { exportToExcel } = await import("@/lib/excel-export");

    const totalSubtotal = filteredInvoices.reduce((s, i) => s + i.subtotal, 0);
    const totalTax = filteredInvoices.reduce((s, i) => s + i.taxAmount, 0);
    const totalDiscount = filteredInvoices.reduce((s, i) => s + i.discount, 0);
    const totalAmount = filteredInvoices.reduce((s, i) => s + i.total, 0);

    await exportToExcel({
      sheetName: "Invoices",
      title: "Invoice Report",
      subtitle: `${filteredInvoices.length} invoices | ${activeTab !== "all" ? `Status: ${activeTab} | ` : ""}Generated ${new Date().toLocaleDateString()}`,
      currency: orgSettings.currency,
      filename: `invoices-${new Date().toISOString().split("T")[0]}`,
      columns: [
        { header: "Invoice #", key: "number", width: 18, type: "string" },
        { header: "Date", key: "date", width: 14, type: "date" },
        { header: "Customer", key: "customer", width: 25, type: "string" },
        { header: "Phone", key: "phone", width: 18, type: "string" },
        { header: "Subtotal", key: "subtotal", width: 14, type: "currency" },
        { header: "Tax", key: "tax", width: 12, type: "currency" },
        { header: "Discount", key: "discount", width: 12, type: "currency" },
        { header: "Total", key: "total", width: 14, type: "currency" },
        { header: "Status", key: "status", width: 12, type: "string" },
      ],
      data: filteredInvoices.map((inv) => ({
        number: inv.number,
        date: inv.issuedAt,
        customer: inv.customer,
        phone: inv.customerPhone || "",
        subtotal: inv.subtotal,
        tax: inv.taxAmount,
        discount: inv.discount,
        total: inv.total,
        status: inv.status.charAt(0).toUpperCase() + inv.status.slice(1),
      })),
      totalsRow: {
        number: "TOTALS",
        subtotal: totalSubtotal,
        tax: totalTax,
        discount: totalDiscount,
        total: totalAmount,
      },
    });

    toast.success("Excel report downloaded");
  };

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Manage and track all invoices"
      >
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors"
        >
          <Download className="size-4 text-muted-foreground" />
          Export Excel
        </button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Invoices */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/12">
              <FileText className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total Invoices
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {metrics.totalInvoices}
              </p>
            </div>
          </div>
        </div>

        {/* Paid */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/12">
              <CheckCircle className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Paid
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {metrics.paid}
              </p>
            </div>
          </div>
        </div>

        {/* Pending */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/12">
              <Clock className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Pending
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {metrics.pending}
              </p>
            </div>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-emerald-500/12">
              <DollarSign className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total Revenue
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatCurrency(metrics.totalRevenue, orgSettings.currency)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-4"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <TabsList>
            <TabsTrigger value="all">
              All
              <span className="ml-1.5 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {invoices.length}
              </span>
            </TabsTrigger>
            <TabsTrigger value="issued">Issued</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="overdue">
              Overdue
              {invoices.filter((i) => i.status === "overdue").length > 0 && (
                <span className="ml-1.5 inline-flex items-center rounded-full bg-red-500/12 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                  {invoices.filter((i) => i.status === "overdue").length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">From</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-8 w-auto text-xs"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted-foreground shrink-0">To</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-8 w-auto text-xs"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              onClick={() => { setDateFrom(""); setDateTo(""); }}
              className="text-xs font-medium text-[#d97706] hover:underline"
            >
              Clear dates
            </button>
          )}
          {(dateFrom || dateTo) && (
            <span className="text-xs text-muted-foreground">
              Showing {filteredInvoices.length} of {invoices.length} invoices
            </span>
          )}
        </div>

        {/* Invoice Table */}
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Invoice #</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Customer</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Subtotal</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Tax</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Total</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ReceiptText className="size-10 opacity-30" />
                        <p className="text-sm font-medium">
                          No invoices found
                        </p>
                        <p className="text-xs">
                          {searchQuery
                            ? "Try a different search term"
                            : "Invoices will appear here after sales"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/40 transition-colors"
                      onClick={() => viewInvoiceDetail(invoice)}
                    >
                      <TableCell className="font-medium text-foreground">
                        {invoice.number}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {new Date(invoice.issuedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {invoice.customer}
                          </p>
                          {invoice.customerPhone && (
                            <p className="text-xs text-muted-foreground">
                              {invoice.customerPhone}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatCurrency(invoice.subtotal, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm">
                        {formatCurrency(invoice.taxAmount, invoice.currency)}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-foreground">
                        {formatCurrency(invoice.total, invoice.currency)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={invoice.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            asChild
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button variant="ghost" size="icon-xs">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                viewInvoiceDetail(invoice);
                              }}
                            >
                              <Eye className="mr-2 size-4" />
                              View
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                downloadPdf(invoice);
                              }}
                            >
                              <Download className="mr-2 size-4" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                shareWhatsApp(invoice);
                              }}
                            >
                              <MessageCircle className="mr-2 size-4" />
                              Send WhatsApp
                            </DropdownMenuItem>
                            {invoice.status !== "paid" &&
                              invoice.status !== "cancelled" && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      markAsPaid(invoice);
                                    }}
                                  >
                                    <CheckCircle className="mr-2 size-4" />
                                    Mark as Paid
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
        </div>
      </Tabs>

      {/* ── Invoice Detail Dialog ────────────────────────────────────── */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl rounded-xl p-0">
          {selectedInvoice && (
            <div className="flex flex-col">
              {/* Invoice Header — mimics a real invoice */}
              <div className="bg-muted/30 border-b border-border px-4 sm:px-6 py-5">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="flex size-8 items-center justify-center rounded-lg bg-[#d97706]">
                        <span className="text-xs font-bold text-[#1a1813]">FM</span>
                      </div>
                      <span className="text-lg font-bold text-foreground">
                        {orgSettings.name || "FluxMark"}
                      </span>
                    </div>
                    {orgSettings.address && (
                      <p className="text-xs text-muted-foreground">{orgSettings.address}</p>
                    )}
                    <div className="flex gap-4 mt-1">
                      {orgSettings.phone && (
                        <p className="text-xs text-muted-foreground">{orgSettings.phone}</p>
                      )}
                      {orgSettings.email && (
                        <p className="text-xs text-muted-foreground">{orgSettings.email}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-foreground tracking-tight">INVOICE</p>
                    <p className="text-sm font-semibold text-[#d97706] mt-0.5">
                      {selectedInvoice.number}
                    </p>
                  </div>
                </div>
              </div>

              {/* Invoice Meta & Customer */}
              <div className="px-4 sm:px-6 py-5 space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* Left column: meta */}
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Issue Date
                        </p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                          {new Date(selectedInvoice.issuedAt).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedInvoice.dueAt && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                            Due Date
                          </p>
                          <p className="text-sm font-medium text-foreground mt-0.5">
                            {new Date(selectedInvoice.dueAt).toLocaleDateString()}
                          </p>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        Status
                      </p>
                      <div className="mt-1">
                        <StatusBadge status={selectedInvoice.status} />
                      </div>
                    </div>
                  </div>

                  {/* Right column: bill to */}
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
                      Bill To
                    </p>
                    <p className="text-sm font-semibold text-foreground">
                      {selectedInvoice.customer}
                    </p>
                    {selectedInvoice.customerPhone && (
                      <p className="text-sm text-muted-foreground">
                        {selectedInvoice.customerPhone}
                      </p>
                    )}
                    {selectedInvoice.customerEmail && (
                      <p className="text-sm text-muted-foreground">
                        {selectedInvoice.customerEmail}
                      </p>
                    )}
                    {selectedInvoice.customerAddress && (
                      <p className="text-sm text-muted-foreground">
                        {selectedInvoice.customerAddress}
                      </p>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Items Table */}
                {loadingDetail ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="size-5 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                      Items
                    </p>
                    <div className="rounded-lg border border-border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</TableHead>
                            <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Qty</TableHead>
                            <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Price</TableHead>
                            <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(selectedInvoice.sale?.items || []).length === 0 ? (
                            <TableRow>
                              <TableCell
                                colSpan={4}
                                className="py-6 text-center text-muted-foreground text-sm"
                              >
                                No items data available
                              </TableCell>
                            </TableRow>
                          ) : (
                            (selectedInvoice.sale?.items || []).map(
                              (item, idx) => (
                                <TableRow key={idx} className={idx % 2 === 1 ? "bg-muted/20" : ""}>
                                  <TableCell className="font-medium text-foreground">
                                    {item.name}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {item.quantity}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground">
                                    {formatCurrency(
                                      item.unitPrice,
                                      selectedInvoice.currency
                                    )}
                                  </TableCell>
                                  <TableCell className="text-right font-medium text-foreground">
                                    {formatCurrency(
                                      item.total,
                                      selectedInvoice.currency
                                    )}
                                  </TableCell>
                                </TableRow>
                              )
                            )
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}

                {/* Totals — right-aligned */}
                <div className="flex justify-end">
                  <div className="w-64 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="text-foreground font-medium">
                        {formatCurrency(
                          selectedInvoice.subtotal,
                          selectedInvoice.currency
                        )}
                      </span>
                    </div>
                    {selectedInvoice.discount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="text-red-500 font-medium">
                          -{formatCurrency(
                            selectedInvoice.discount,
                            selectedInvoice.currency
                          )}
                        </span>
                      </div>
                    )}
                    {selectedInvoice.taxRate > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {orgSettings.taxLabel} ({selectedInvoice.taxRate}%)
                        </span>
                        <span className="text-foreground font-medium">
                          {formatCurrency(
                            selectedInvoice.taxAmount,
                            selectedInvoice.currency
                          )}
                        </span>
                      </div>
                    )}
                    <div className="border-t border-border pt-2 mt-2">
                      <div className="flex justify-between">
                        <span className="text-lg font-bold text-foreground">
                          Total
                        </span>
                        <span className="text-lg font-bold text-foreground">
                          {formatCurrency(
                            selectedInvoice.total,
                            selectedInvoice.currency
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notes */}
                {selectedInvoice.notes && (
                  <div className="rounded-lg bg-muted/30 border border-border p-4">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Notes
                    </p>
                    <p className="mt-1.5 text-sm text-foreground">
                      {selectedInvoice.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="border-t border-border px-4 sm:px-6 py-4 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => downloadPdf(selectedInvoice)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors"
                >
                  <Download className="size-4" />
                  <span className="hidden xs:inline">Download</span> PDF
                </button>
                <button
                  onClick={() => shareWhatsApp(selectedInvoice)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 shadow-sm hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-colors"
                >
                  <MessageCircle className="size-4" />
                  WhatsApp
                </button>
                <button
                  onClick={() => sendEmail(selectedInvoice)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors"
                >
                  <Mail className="size-4" />
                  Email
                </button>
                {selectedInvoice.status !== "paid" &&
                  selectedInvoice.status !== "cancelled" && (
                    <button
                      onClick={() => markAsPaid(selectedInvoice)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97706] px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-[#1a1813] shadow-sm hover:bg-[#c2410c] transition-colors sm:ml-auto"
                    >
                      <CheckCircle className="size-4" />
                      Mark as Paid
                    </button>
                  )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
