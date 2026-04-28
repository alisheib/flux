"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { formatCurrency } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import { FormSelect } from "@/components/ui/form-select";
import { toast } from "sonner";
import {
  Search,
  Wallet,
  AlertTriangle,
  CheckCircle,
  TrendingDown,
  ChevronRight,
  MessageCircle,
  Plus,
  Phone,
  Mail,
  X,
  Download,
  Filter,
  FileText,
  Loader2,
  ArrowUp,
  ArrowDown,
  Smartphone,
  Building2,
  Banknote,
  CreditCard,
  Clock,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CustomerDebt {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  outstanding: number;
  lastPaymentDate: string | null;
  oldestDebtDays: number;
  status: "overdue" | "current" | "paid";
  invoiceCount: number;
}

interface OutstandingInvoice {
  id: string;
  number: string;
  customerId: string;
  customerName: string;
  issuedAt: string;
  dueAt: string;
  total: number;
  paid: number;
  balance: number;
  daysLate: number;
  status: "overdue" | "partial" | "pending" | "paid";
}

interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: string;
  invoiceNumber: string;
  note: string | null;
}

interface AgingBucket {
  label: string;
  amount: number;
  count: number;
  color: string;
}

interface ReceivablesData {
  customers: CustomerDebt[];
  invoices: OutstandingInvoice[];
  payments: PaymentRecord[];
  kpis: {
    totalOutstanding: number;
    overdueAmount: number;
    overdueCount: number;
    collectedThisMonth: number;
    collectedDelta: number;
    avgDaysToPay: number;
    avgDaysDelta: number;
    customersWithDebt: number;
    oldestDebtDays: number;
  };
  aging: AgingBucket[];
}

interface OrgSettings {
  currency: string;
  name: string;
}

// ── Status helpers ────────────────────────────────────────────────────────────

const customerStatusConfig: Record<
  string,
  { label: string; badgeBg: string; badgeText: string }
> = {
  overdue: {
    label: "Overdue",
    badgeBg: "bg-red-500/12",
    badgeText: "text-red-600 dark:text-red-400",
  },
  current: {
    label: "Current",
    badgeBg: "bg-blue-500/12",
    badgeText: "text-blue-600 dark:text-blue-400",
  },
  paid: {
    label: "Settled",
    badgeBg: "bg-emerald-500/12",
    badgeText: "text-emerald-600 dark:text-emerald-400",
  },
};

const invoiceStatusConfig: Record<
  string,
  { label: string; badgeBg: string; badgeText: string }
> = {
  overdue: {
    label: "Overdue",
    badgeBg: "bg-red-500/12",
    badgeText: "text-red-600 dark:text-red-400",
  },
  partial: {
    label: "Partial",
    badgeBg: "bg-amber-500/12",
    badgeText: "text-amber-600 dark:text-amber-400",
  },
  pending: {
    label: "Pending",
    badgeBg: "bg-blue-500/12",
    badgeText: "text-blue-600 dark:text-blue-400",
  },
  paid: {
    label: "Paid",
    badgeBg: "bg-emerald-500/12",
    badgeText: "text-emerald-600 dark:text-emerald-400",
  },
};

function StatusBadge({
  status,
  config,
}: {
  status: string;
  config: Record<string, { label: string; badgeBg: string; badgeText: string }>;
}) {
  const c = config[status] || config.current || { label: status, badgeBg: "bg-gray-500/12", badgeText: "text-gray-600" };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.badgeBg} ${c.badgeText}`}
    >
      <span
        className={`size-1.5 rounded-full ${status === "overdue" ? "bg-red-500" : status === "current" || status === "pending" ? "bg-blue-500" : status === "partial" ? "bg-amber-500" : "bg-emerald-500"}`}
      />
      {c.label}
    </span>
  );
}

// ── Payment method options ────────────────────────────────────────────────────

const paymentMethods = [
  { id: "mpesa", label: "M-Pesa", icon: Smartphone, color: "text-emerald-600" },
  { id: "tigo_pesa", label: "Tigo Pesa", icon: Smartphone, color: "text-blue-600" },
  { id: "airtel_money", label: "Airtel Money", icon: Smartphone, color: "text-red-600" },
  { id: "bank_transfer", label: "Bank Transfer", icon: Building2, color: "text-amber-600" },
  { id: "cash", label: "Cash", icon: Banknote, color: "text-muted-foreground" },
  { id: "card", label: "Card", icon: CreditCard, color: "text-violet-600" },
];

// ── KPI Card ──────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
  delta,
  icon: Icon,
  toneBg,
  toneFg,
  valueDanger,
}: {
  label: string;
  value: string;
  sub?: string;
  delta?: number;
  icon: React.ElementType;
  toneBg: string;
  toneFg: string;
  valueDanger?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-2">
        <div
          className={`flex size-9 items-center justify-center rounded-[9px] ${toneBg}`}
        >
          <Icon className={`size-[17px] ${toneFg}`} />
        </div>
        {delta != null && (
          <span
            className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold ${
              delta > 0
                ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                : "bg-red-500/12 text-red-600 dark:text-red-400"
            }`}
          >
            {delta > 0 ? (
              <ArrowUp className="size-3" />
            ) : (
              <ArrowDown className="size-3" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold tracking-tight ${valueDanger ? "text-red-600 dark:text-red-400" : "text-foreground"}`}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</p>
      )}
    </div>
  );
}

// ── Aging Chart ───────────────────────────────────────────────────────────────

function AgingChart({
  buckets,
  currency,
}: {
  buckets: AgingBucket[];
  currency: string;
}) {
  const total = buckets.reduce((s, b) => s + b.amount, 0);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Aging analysis
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Outstanding by days overdue
          </p>
        </div>
        <span className="text-[13px] text-muted-foreground">
          Total:{" "}
          <strong className="text-foreground">
            {formatCurrency(total, currency)}
          </strong>
        </span>
      </div>
      <div className="px-5 pb-5 pt-4">
        {/* Stacked bar */}
        <div className="flex h-9 overflow-hidden rounded-lg border border-border">
          {buckets.map((b, i) => {
            const pct = total > 0 ? (b.amount / total) * 100 : 0;
            return (
              <div
                key={b.label}
                title={`${b.label}: ${formatCurrency(b.amount, currency)}`}
                className="flex items-center justify-center text-[11px] font-semibold text-white"
                style={{
                  flex: b.amount,
                  minWidth: b.amount > 0 ? 4 : 0,
                  backgroundColor: b.color,
                  borderRight:
                    i < buckets.length - 1
                      ? "1px solid var(--background)"
                      : "none",
                }}
              >
                {pct > 8 && `${Math.round(pct)}%`}
              </div>
            );
          })}
        </div>

        {/* Legend grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {buckets.map((b) => (
            <div
              key={b.label}
              className="rounded-lg border border-border bg-muted/30 p-3"
            >
              <div className="mb-1 flex items-center gap-1.5">
                <span
                  className="size-2.5 rounded-[3px]"
                  style={{ backgroundColor: b.color }}
                />
                <span className="text-[11px] font-semibold tracking-[0.04em] text-muted-foreground">
                  {b.label}
                </span>
              </div>
              <div className="font-display text-base font-semibold tabular-nums text-foreground">
                {formatCurrency(b.amount, currency)}
              </div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {b.count} {b.count === 1 ? "invoice" : "invoices"}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Customer Detail Dialog ────────────────────────────────────────────────────

function CustomerDetailDialog({
  customer,
  invoices,
  payments,
  currency,
  onClose,
  onRecordPayment,
  onWhatsAppReminder,
}: {
  customer: CustomerDebt | null;
  invoices: OutstandingInvoice[];
  payments: PaymentRecord[];
  currency: string;
  onClose: () => void;
  onRecordPayment: () => void;
  onWhatsAppReminder: (customer: CustomerDebt) => void;
}) {
  const [tab, setTab] = useState("outstanding");

  if (!customer) return null;

  const custInvoices = invoices.filter(
    (inv) => inv.customerId === customer.id
  );
  const totalInvoiced = custInvoices.reduce((s, t) => s + t.total, 0);
  const totalPaid = custInvoices.reduce((s, t) => s + t.paid, 0);

  const initials = customer.name
    .split(" ")
    .slice(0, 2)
    .map((s) => s[0])
    .join("")
    .toUpperCase();

  return (
    <Dialog open={!!customer} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-[980px] p-0 gap-0 flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>{customer.name} - Account Details</DialogTitle>
          <DialogDescription>Customer account and payment details</DialogDescription>
        </DialogHeader>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-3.5">
            <div className="flex size-12 items-center justify-center rounded-full bg-amber-500/12 text-base font-semibold text-amber-700 dark:text-amber-400">
              {initials}
            </div>
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                {customer.name}
              </h2>
              <div className="mt-0.5 flex items-center gap-3.5 text-[12.5px] text-muted-foreground">
                {customer.phone && (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="size-3" />
                    {customer.phone}
                  </span>
                )}
                {customer.email && (
                  <span className="inline-flex items-center gap-1">
                    <Mail className="size-3" />
                    {customer.email}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hero numbers */}
        <div className="grid grid-cols-2 gap-4 border-b border-border px-6 py-3.5 sm:grid-cols-4">
          <HeroNumber
            label="Outstanding balance"
            value={formatCurrency(customer.outstanding, currency)}
            accent={customer.status === "overdue" ? "danger" : "amber"}
          />
          <HeroNumber
            label="Total invoiced (lifetime)"
            value={formatCurrency(totalInvoiced, currency)}
          />
          <HeroNumber
            label="Total paid"
            value={formatCurrency(totalPaid, currency)}
            accent="success"
          />
          <HeroNumber
            label="Oldest unpaid"
            value={`${customer.oldestDebtDays}d`}
            sub={
              customer.oldestDebtDays > 60
                ? "Critical"
                : customer.oldestDebtDays > 30
                  ? "Aging"
                  : "Within terms"
            }
            accent={
              customer.oldestDebtDays > 60
                ? "danger"
                : customer.oldestDebtDays > 30
                  ? "amber"
                  : "success"
            }
          />
        </div>

        {/* Tabs */}
        <Tabs value={tab} onValueChange={setTab} className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b border-border px-6">
            <TabsList className="h-auto bg-transparent p-0">
              <TabsTrigger
                value="outstanding"
                className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-[#d97706] data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Outstanding invoices
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-[#d97706] data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Payment history
              </TabsTrigger>
              <TabsTrigger
                value="statement"
                className="rounded-none border-b-2 border-transparent px-4 py-2.5 text-sm data-[state=active]:border-[#d97706] data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Statement
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-y-auto">
            <TabsContent value="outstanding" className="mt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Invoice
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Date
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Total
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Paid
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Balance
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Due
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Status
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {custInvoices.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-12 text-center text-muted-foreground"
                        >
                          No outstanding invoices
                        </TableCell>
                      </TableRow>
                    ) : (
                      custInvoices.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="font-mono text-[12.5px] font-medium text-foreground">
                            {t.number}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {t.issuedAt}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums text-foreground">
                            {formatCurrency(t.total, currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm tabular-nums text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(t.paid, currency)}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                            {formatCurrency(t.balance, currency)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {t.dueAt}
                          </TableCell>
                          <TableCell>
                            <StatusBadge
                              status={t.status}
                              config={invoiceStatusConfig}
                            />
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="history" className="mt-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Payment
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Date
                      </TableHead>
                      <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Amount
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Method
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Invoice
                      </TableHead>
                      <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Note
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={6}
                          className="py-12 text-center text-muted-foreground"
                        >
                          No payment history
                        </TableCell>
                      </TableRow>
                    ) : (
                      payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-mono text-[12.5px] text-foreground">
                            {p.id}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {p.date}
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                            +{formatCurrency(p.amount, currency)}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-foreground">
                              {p.method}
                            </span>
                          </TableCell>
                          <TableCell className="font-mono text-xs text-muted-foreground">
                            {p.invoiceNumber}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-[12.5px] text-muted-foreground">
                            {p.note || "\u2014"}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="statement" className="mt-0">
              <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
                <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                  <FileText className="size-6 text-muted-foreground" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  Generate customer statement
                </h4>
                <p className="max-w-sm text-xs text-muted-foreground">
                  Send a complete statement showing all invoices, payments, and
                  current balance to the customer via WhatsApp, email, or SMS.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2 gap-1.5"
                  onClick={() =>
                    toast.info("Statement PDF generation is being set up for your organization.")
                  }
                >
                  <Download className="size-3.5" />
                  Generate statement (PDF)
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        {/* Footer */}
        <div className="flex flex-col gap-2 border-t border-border px-6 py-3 sm:flex-row sm:items-center">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => customer.phone && window.open('tel:' + customer.phone)}>
            <Phone className="size-3.5" />
            Call
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
            onClick={() => onWhatsAppReminder(customer)}
          >
            <MessageCircle className="size-3.5" />
            WhatsApp reminder
          </Button>
          <div className="flex-1" />
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
          <Button
            size="sm"
            className="gap-1.5 bg-[#d97706] text-white hover:bg-[#b45309] dark:bg-[#d97706] dark:hover:bg-[#b45309]"
            onClick={onRecordPayment}
          >
            <Plus className="size-3.5" />
            Record payment
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function HeroNumber({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "danger" | "amber" | "success";
}) {
  const accentColors = {
    danger: "text-red-600 dark:text-red-400",
    amber: "text-amber-600 dark:text-amber-400",
    success: "text-emerald-600 dark:text-emerald-400",
  };
  const valueColor = accent ? accentColors[accent] : "text-foreground";

  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 font-display text-xl font-semibold tracking-tight tabular-nums ${valueColor} sm:text-[22px]`}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

// ── Record Payment Dialog ─────────────────────────────────────────────────────

function RecordPaymentDialog({
  open,
  onClose,
  customers,
  preselected,
  invoices,
  currency,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  customers: CustomerDebt[];
  preselected: CustomerDebt | null;
  invoices: OutstandingInvoice[];
  currency: string;
  onSave: (data: {
    customerId: string;
    amount: number;
    method: string;
    invoiceId: string;
    date: string;
    note: string;
  }) => void;
}) {
  const [customerId, setCustomerId] = useState(preselected?.id || "");
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("mpesa");
  const [invoiceId, setInvoiceId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setCustomerId(preselected?.id || "");
      setAmount("");
      setMethod("mpesa");
      setInvoiceId("");
      setDate(new Date().toISOString().slice(0, 10));
      setNote("");
    }
  }, [open, preselected]);

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const customerInvoices = invoices.filter(
    (inv) => inv.customerId === customerId && inv.status !== "paid"
  );
  const amountNum = parseFloat(amount) || 0;

  const handleSave = async () => {
    if (!customerId || amountNum <= 0) return;
    setSaving(true);
    try {
      await onSave({
        customerId,
        amount: amountNum,
        method,
        invoiceId,
        date,
        note,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="font-display text-lg font-semibold">
            Record payment
          </DialogTitle>
          <DialogDescription>
            Log a payment received from a customer
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 pt-1">
          {/* Customer */}
          <div className="space-y-1.5">
            <Label>Customer</Label>
            <FormSelect
              value={customerId}
              onChange={setCustomerId}
              placeholder="-- Select customer --"
              options={customers
                .filter((c) => c.outstanding > 0)
                .map((c) => ({
                  value: c.id,
                  label: `${c.name} \u00b7 owed ${formatCurrency(c.outstanding, currency)}`,
                }))}
            />
          </div>

          {/* Amount */}
          <div className="space-y-1.5">
            <Label>Amount</Label>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono text-[13px] font-medium text-muted-foreground">
                  {currency.toUpperCase() === "TZS" ||
                  currency.toUpperCase() === "TSH"
                    ? "TSh"
                    : "$"}
                </span>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                  className="h-11 pl-10 font-mono text-lg font-semibold"
                />
              </div>
              {selectedCustomer && selectedCustomer.outstanding > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 text-[11px]"
                  onClick={() =>
                    setAmount(String(selectedCustomer.outstanding))
                  }
                >
                  Full ({formatCurrency(selectedCustomer.outstanding, currency)})
                </Button>
              )}
            </div>
            {selectedCustomer &&
              amountNum > 0 &&
              amountNum > selectedCustomer.outstanding && (
                <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="size-3" />
                  Amount exceeds outstanding balance (
                  {formatCurrency(selectedCustomer.outstanding, currency)})
                </p>
              )}
          </div>

          {/* Payment method grid */}
          <div className="space-y-1.5">
            <Label>Payment method</Label>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((m) => {
                const Icon = m.icon;
                const isSelected = method === m.id;
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border-[1.5px] px-2 py-2.5 text-xs font-medium transition-colors ${
                      isSelected
                        ? "border-[#d97706] bg-amber-500/[0.08] text-amber-700 dark:text-amber-400"
                        : "border-border bg-background text-foreground hover:bg-muted/50"
                    }`}
                  >
                    <Icon
                      className={`size-4 ${isSelected ? "text-amber-600 dark:text-amber-400" : m.color}`}
                    />
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Invoice + Date */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Apply to invoice (optional)</Label>
              <FormSelect
                value={invoiceId}
                onChange={setInvoiceId}
                placeholder="Auto-allocate (oldest first)"
                options={customerInvoices.map((inv) => ({
                  value: inv.id,
                  label: `${inv.number} \u00b7 ${formatCurrency(inv.balance, currency)}`,
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label>
              Reference / note{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. M-Pesa ref XGT45MT"
            />
          </div>
        </div>

        <DialogFooter className="mt-2 gap-2 sm:gap-0">
          <Button variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!customerId || amountNum <= 0 || saving}
            className="gap-1.5 bg-[#d97706] text-white hover:bg-[#b45309] dark:bg-[#d97706] dark:hover:bg-[#b45309]"
            onClick={handleSave}
          >
            {saving ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <CheckCircle className="size-3.5" />
            )}
            Record payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReceivablesPage() {
  const { user } = useAuth();

  // Data state
  const [data, setData] = useState<ReceivablesData | null>(null);
  const [orgSettings, setOrgSettings] = useState<OrgSettings>({
    currency: "USD",
    name: "",
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [mainTab, setMainTab] = useState("customers");

  // Dialogs
  const [selectedCustomer, setSelectedCustomer] =
    useState<CustomerDebt | null>(null);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentFor, setPaymentFor] = useState<CustomerDebt | null>(null);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [arRes, settingsRes] = await Promise.all([
        fetch("/api/receivables"),
        fetch("/api/settings"),
      ]);

      if (arRes.ok) {
        const raw = await arRes.json();
        // Map API response to page interface
        const agingColors = ["#16a34a", "#d97706", "#ea580c", "#dc2626"];
        const arData: ReceivablesData = {
          customers: (raw.customers || []).map((c: Record<string, unknown>) => ({
            id: c.name,
            name: c.name,
            phone: c.phone,
            email: c.email,
            outstanding: c.totalOwed ?? 0,
            lastPaymentDate: c.lastPayment,
            oldestDebtDays: c.oldestDebt ?? 0,
            status: c.status ?? "current",
            invoiceCount: c.transactionCount ?? 0,
          })),
          invoices: [],
          payments: [],
          kpis: {
            totalOutstanding: raw.totals?.totalOutstanding ?? 0,
            overdueAmount: raw.totals?.overdueAmount ?? 0,
            overdueCount: raw.totals?.overdueCount ?? 0,
            collectedThisMonth: raw.totals?.collectedThisMonth ?? 0,
            collectedDelta: 0,
            avgDaysToPay: 0,
            avgDaysDelta: 0,
            customersWithDebt: (raw.customers || []).filter((c: Record<string, unknown>) => (c.totalOwed as number) > 0).length,
            oldestDebtDays: Math.max(0, ...(raw.customers || []).map((c: Record<string, unknown>) => (c.oldestDebt as number) ?? 0)),
          },
          aging: (raw.agingBuckets || []).map((b: Record<string, unknown>, i: number) => ({
            label: b.label,
            amount: b.amount ?? 0,
            count: b.count ?? 0,
            color: agingColors[i] || "#6b7280",
          })),
        };
        setData(arData);
      }
      if (settingsRes.ok) {
        const sData = await settingsRes.json();
        setOrgSettings({
          currency: sData.currency || "USD",
          name: sData.name || "",
        });
      }
    } catch {
      toast.error("Failed to load receivables data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived data ────────────────────────────────────────────────────────────

  const customers = data?.customers || [];
  const outstandingInvoices = data?.invoices || [];
  const paymentHistory = data?.payments || [];
  const kpis = data?.kpis || {
    totalOutstanding: 0,
    overdueAmount: 0,
    overdueCount: 0,
    collectedThisMonth: 0,
    collectedDelta: 0,
    avgDaysToPay: 0,
    avgDaysDelta: 0,
    customersWithDebt: 0,
    oldestDebtDays: 0,
  };
  const agingBuckets: AgingBucket[] = data?.aging || [
    { label: "0-30 DAYS", amount: 0, count: 0, color: "#16a34a" },
    { label: "31-60 DAYS", amount: 0, count: 0, color: "#d97706" },
    { label: "61-90 DAYS", amount: 0, count: 0, color: "#ea580c" },
    { label: "90+ DAYS", amount: 0, count: 0, color: "#dc2626" },
  ];

  const currency = orgSettings.currency;

  // Filtered customers
  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      if (statusFilter === "overdue" && c.status !== "overdue") return false;
      if (statusFilter === "current" && c.status !== "current") return false;
      if (statusFilter === "paid" && c.outstanding > 0) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !c.name.toLowerCase().includes(q) &&
          !(c.phone && c.phone.includes(q))
        )
          return false;
      }
      return true;
    });
  }, [customers, statusFilter, searchQuery]);

  // Outstanding invoices (non-paid only for tab)
  const filteredInvoices = useMemo(() => {
    return outstandingInvoices.filter((inv) => inv.status !== "paid");
  }, [outstandingInvoices]);

  // ── Record Payment Handler ──────────────────────────────────────────────────

  const handleRecordPayment = async (paymentData: {
    customerId: string;
    amount: number;
    method: string;
    invoiceId: string;
    date: string;
    note: string;
  }) => {
    try {
      const res = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(paymentData),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record payment");
      }
      toast.success(
        `Payment of ${formatCurrency(paymentData.amount, currency)} recorded`
      );
      fetchData(); // Refresh
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to record payment";
      toast.error(message);
    }
  };

  // ── WhatsApp Reminder ───────────────────────────────────────────────────────

  const sendWhatsAppReminder = (customer: CustomerDebt) => {
    const text = [
      `Hi ${customer.name.split(" ")[0]},`,
      "",
      `This is a friendly reminder that you have an outstanding balance of ${formatCurrency(customer.outstanding, currency)}.`,
      "",
      "Please arrange payment at your earliest convenience.",
      "",
      `Thank you,`,
      orgSettings.name || "Flux Business",
    ].join("\n");

    const phone = customer.phone
      ? customer.phone.replace(/[^0-9+]/g, "").replace(/^\+/, "")
      : "";

    const baseUrl = "https://api.whatsapp.com/send";
    const params = new URLSearchParams({ text });
    if (phone) params.set("phone", phone);
    window.open(`${baseUrl}?${params.toString()}`, "_blank");
  };

  // ── Loading ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <PageHeader title="Receivables" description="Track credit, age receivables, and record payments">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={async () => {
            const { exportToExcel } = await import("@/lib/excel-export");

            const totalOutstanding = filteredCustomers.reduce((s, c) => s + c.outstanding, 0);

            await exportToExcel({
              sheetName: "Receivables",
              title: "Receivables Report",
              subtitle: `${filteredCustomers.length} customers | ${statusFilter !== "all" ? `Status: ${statusFilter} | ` : ""}Generated ${new Date().toLocaleDateString()}`,
              currency,
              filename: `receivables-${new Date().toISOString().split("T")[0]}`,
              columns: [
                { header: "Customer", key: "name", width: 25, type: "string" },
                { header: "Phone", key: "phone", width: 18, type: "string" },
                { header: "Outstanding", key: "outstanding", width: 16, type: "currency" },
                { header: "Invoices", key: "invoiceCount", width: 12, type: "number" },
                { header: "Oldest Debt (days)", key: "oldestDebtDays", width: 18, type: "number" },
                { header: "Last Payment", key: "lastPaymentDate", width: 16, type: "string" },
                { header: "Status", key: "status", width: 12, type: "string" },
              ],
              data: filteredCustomers.map((c) => ({
                name: c.name,
                phone: c.phone || "",
                outstanding: c.outstanding,
                invoiceCount: c.invoiceCount,
                oldestDebtDays: c.oldestDebtDays,
                lastPaymentDate: c.lastPaymentDate || "",
                status: c.status.charAt(0).toUpperCase() + c.status.slice(1),
              })),
              totalsRow: {
                name: "TOTALS",
                outstanding: totalOutstanding,
                invoiceCount: filteredCustomers.reduce((s, c) => s + c.invoiceCount, 0),
              },
            });

            toast.success("Excel report downloaded");
          }}
        >
          <Download className="size-4 text-muted-foreground" />
          Export
        </Button>
        <Button
          size="sm"
          className="gap-1.5 bg-[#d97706] text-white hover:bg-[#b45309] dark:bg-[#d97706] dark:hover:bg-[#b45309]"
          onClick={() => {
            setPaymentFor(null);
            setPaymentOpen(true);
          }}
        >
          <Plus className="size-4" />
          Record payment
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="Total outstanding"
          value={formatCurrency(kpis.totalOutstanding, currency)}
          sub={`${kpis.customersWithDebt} customers on credit`}
          icon={Wallet}
          toneBg="bg-amber-500/12"
          toneFg="text-amber-600 dark:text-amber-400"
        />
        <KpiCard
          label="Overdue amount"
          value={formatCurrency(kpis.overdueAmount, currency)}
          sub={`${kpis.overdueCount} customers \u00b7 oldest ${kpis.oldestDebtDays}d`}
          icon={AlertTriangle}
          toneBg="bg-red-500/12"
          toneFg="text-red-600 dark:text-red-400"
          valueDanger
        />
        <KpiCard
          label="Collected this month"
          value={formatCurrency(kpis.collectedThisMonth, currency)}
          delta={kpis.collectedDelta || undefined}
          icon={CheckCircle}
          toneBg="bg-emerald-500/12"
          toneFg="text-emerald-600 dark:text-emerald-400"
        />
        <KpiCard
          label="Avg. days to pay"
          value={`${kpis.avgDaysToPay}d`}
          sub={
            kpis.avgDaysDelta
              ? `vs ${kpis.avgDaysToPay - Math.round((kpis.avgDaysToPay * kpis.avgDaysDelta) / 100)}d last quarter`
              : undefined
          }
          delta={kpis.avgDaysDelta || undefined}
          icon={Clock}
          toneBg="bg-blue-500/12"
          toneFg="text-blue-600 dark:text-blue-400"
        />
      </div>

      {/* Aging Chart */}
      <AgingChart buckets={agingBuckets} currency={currency} />

      {/* Customer Table Card */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        {/* Tabs + Filters */}
        <div className="flex flex-col gap-3 border-b border-border px-5 pb-4 pt-5">
          <Tabs
            value={mainTab}
            onValueChange={setMainTab}
            className="w-full"
          >
            <TabsList className="h-auto bg-transparent p-0">
              <TabsTrigger
                value="customers"
                className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-[#d97706] data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                By customer
              </TabsTrigger>
              <TabsTrigger
                value="invoices"
                className="rounded-none border-b-2 border-transparent px-4 py-2 text-sm data-[state=active]:border-[#d97706] data-[state=active]:text-foreground data-[state=active]:shadow-none"
              >
                Outstanding invoices
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[200px] max-w-[320px] flex-1">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name or phone..."
                className="h-9 pl-9 text-sm"
              />
            </div>

            <div className="inline-flex gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
              {(
                [
                  ["all", "All"],
                  ["overdue", "Overdue"],
                  ["current", "Current"],
                  ["paid", "Settled"],
                ] as const
              ).map(([v, l]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setStatusFilter(v)}
                  className={`rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all ${
                    statusFilter === v
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Customer Table */}
        {mainTab === "customers" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Customer
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground max-sm:hidden">
                    Contact
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Outstanding
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground max-sm:hidden">
                    Last Payment
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground max-sm:hidden">
                    Oldest Debt
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Wallet className="size-10 opacity-30" />
                        <p className="text-sm font-medium">
                          No customers match
                        </p>
                        <p className="text-xs">
                          Try clearing filters or search by phone number.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map((c) => {
                    const initials = c.name
                      .split(" ")
                      .slice(0, 2)
                      .map((s) => s[0])
                      .join("")
                      .toUpperCase();

                    return (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                        onClick={() => setSelectedCustomer(c)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-2.5">
                            <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/12 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                              {initials}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {c.name}
                              </p>
                              <p className="text-[11.5px] text-muted-foreground">
                                {c.invoiceCount}{" "}
                                {c.invoiceCount === 1
                                  ? "invoice"
                                  : "invoices"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-[12.5px] text-muted-foreground max-sm:hidden">
                          {c.phone || "\u2014"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm font-semibold tabular-nums ${c.outstanding > 0 ? "text-foreground" : "text-muted-foreground"}`}
                        >
                          {formatCurrency(c.outstanding, currency)}
                        </TableCell>
                        <TableCell className="text-[12.5px] text-muted-foreground max-sm:hidden">
                          {c.lastPaymentDate || "\u2014"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono text-sm tabular-nums max-sm:hidden ${
                            c.oldestDebtDays > 60
                              ? "font-semibold text-red-600 dark:text-red-400"
                              : c.oldestDebtDays > 30
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {c.outstanding > 0 ? `${c.oldestDebtDays}d` : "\u2014"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={c.status}
                            config={customerStatusConfig}
                          />
                        </TableCell>
                        <TableCell
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            {c.outstanding > 0 && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon-xs"
                                  title="Send WhatsApp reminder"
                                  onClick={() =>
                                    sendWhatsAppReminder(c)
                                  }
                                >
                                  <MessageCircle className="size-3.5 text-emerald-500" />
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-7 gap-1 bg-[#d97706] px-2 text-xs text-white hover:bg-[#b45309] dark:bg-[#d97706] dark:hover:bg-[#b45309]"
                                  onClick={() => {
                                    setPaymentFor(c);
                                    setPaymentOpen(true);
                                  }}
                                >
                                  <Plus className="size-3" />
                                  Record
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() =>
                                setSelectedCustomer(c)
                              }
                            >
                              <ChevronRight className="size-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Outstanding Invoices Table */}
        {mainTab === "invoices" && (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Invoice
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Customer
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground max-sm:hidden">
                    Issued
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground max-sm:hidden">
                    Due
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground max-sm:hidden">
                    Total
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Balance
                  </TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide text-muted-foreground max-sm:hidden">
                    Days Late
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Status
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <FileText className="size-10 opacity-30" />
                        <p className="text-sm font-medium">
                          No outstanding invoices
                        </p>
                        <p className="text-xs">
                          All invoices are settled.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-[12.5px] font-medium text-foreground">
                        {inv.number}
                      </TableCell>
                      <TableCell className="text-sm text-foreground">
                        {inv.customerName}
                      </TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground max-sm:hidden">
                        {inv.issuedAt}
                      </TableCell>
                      <TableCell className="text-[12.5px] text-muted-foreground max-sm:hidden">
                        {inv.dueAt}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm tabular-nums text-foreground max-sm:hidden">
                        {formatCurrency(inv.total, currency)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold tabular-nums text-foreground">
                        {formatCurrency(inv.balance, currency)}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono text-sm tabular-nums max-sm:hidden ${
                          inv.daysLate > 60
                            ? "font-semibold text-red-600 dark:text-red-400"
                            : inv.daysLate > 0
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground"
                        }`}
                      >
                        {inv.daysLate > 0 ? `${inv.daysLate}d` : "\u2014"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge
                          status={inv.status}
                          config={invoiceStatusConfig}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Customer Detail Dialog */}
      <CustomerDetailDialog
        customer={selectedCustomer}
        invoices={outstandingInvoices}
        payments={paymentHistory}
        currency={currency}
        onClose={() => setSelectedCustomer(null)}
        onWhatsAppReminder={sendWhatsAppReminder}
        onRecordPayment={() => {
          setPaymentFor(selectedCustomer);
          setPaymentOpen(true);
          setSelectedCustomer(null);
        }}
      />

      {/* Record Payment Dialog */}
      <RecordPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        customers={customers}
        preselected={paymentFor}
        invoices={outstandingInvoices}
        currency={currency}
        onSave={handleRecordPayment}
      />
    </div>
  );
}
