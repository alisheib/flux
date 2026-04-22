"use client";

import React, { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Printer, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface InvoiceData {
  invoice: {
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
    items: { name: string; quantity: number; unitPrice: number; total: number }[];
  };
  org: {
    name: string;
    logo: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    taxLabel: string;
    currency: string;
  };
}

function fmt(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadge(status: string) {
  switch (status) {
    case "paid": return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "overdue": return "bg-red-100 text-red-800 border-red-200";
    case "cancelled": return "bg-gray-100 text-gray-600 border-gray-200";
    default: return "bg-blue-100 text-blue-800 border-blue-200";
  }
}

function InvoiceDocument({ invoice, org }: InvoiceData) {
  const cur = invoice.currency || org.currency || "USD";

  return (
    <div className="bg-white text-gray-900 p-8 font-sans" id="invoice-doc">
      {/* Brand stripe */}
      <div className="h-1 w-full rounded-full bg-[#d97706] mb-6" />

      {/* Header */}
      <div className="flex justify-between mb-8">
        <div>
          {org.logo && <img src={org.logo} alt={org.name} className="mb-3 h-12 w-auto object-contain" />}
          <h1 className="text-xl font-bold text-gray-900">{org.name}</h1>
          {org.address && <p className="text-xs text-gray-500 mt-1">{org.address}</p>}
          {org.phone && <p className="text-xs text-gray-500">{org.phone}</p>}
          {org.email && <p className="text-xs text-gray-500">{org.email}</p>}
          {org.website && <p className="text-xs text-gray-500">{org.website}</p>}
        </div>
        <div className="text-right">
          <h2 className="text-3xl font-bold text-gray-900">INVOICE</h2>
          <p className="text-base font-bold text-[#d97706] mt-1">{invoice.number}</p>
        </div>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Issue Date</p>
          <p className="text-sm text-gray-700">{new Date(invoice.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
          {invoice.dueAt && (
            <>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 mt-3">Due Date</p>
              <p className="text-sm text-gray-700">{new Date(invoice.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
            </>
          )}
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 mt-3">Status</p>
          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${statusBadge(invoice.status)}`}>
            {invoice.status}
          </span>
        </div>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Bill To</p>
          <p className="text-sm font-semibold text-gray-900">{invoice.customer}</p>
          {invoice.customerPhone && <p className="text-xs text-gray-500">{invoice.customerPhone}</p>}
          {invoice.customerEmail && <p className="text-xs text-gray-500">{invoice.customerEmail}</p>}
          {invoice.customerAddress && <p className="text-xs text-gray-500">{invoice.customerAddress}</p>}
        </div>
      </div>

      {/* Items table */}
      <table className="w-full mb-8">
        <thead>
          <tr className="bg-gray-900 text-white">
            <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider rounded-l-md">Item</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider">Qty</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider">Unit Price</th>
            <th className="px-3 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider rounded-r-md">Total</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
              <td className="px-3 py-2 text-sm text-gray-900">{item.name}</td>
              <td className="px-3 py-2 text-sm text-gray-500 text-right">{item.quantity}</td>
              <td className="px-3 py-2 text-sm text-gray-500 text-right">{fmt(item.unitPrice, cur)}</td>
              <td className="px-3 py-2 text-sm text-gray-900 text-right font-semibold">{fmt(item.total, cur)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totals */}
      <div className="flex justify-end mb-8">
        <div className="w-56">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">{fmt(invoice.subtotal, cur)}</span>
          </div>
          {invoice.discount > 0 && (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-500">Discount</span>
              <span className="text-red-600">-{fmt(invoice.discount, cur)}</span>
            </div>
          )}
          {invoice.taxRate > 0 && (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-gray-500">{org.taxLabel} ({invoice.taxRate}%)</span>
              <span className="text-gray-900">{fmt(invoice.taxAmount, cur)}</span>
            </div>
          )}
          <div className="flex justify-between py-2 mt-2 border-t-[3px] border-[#d97706]">
            <span className="text-lg font-bold text-gray-900">TOTAL</span>
            <span className="text-lg font-bold text-[#d97706]">{fmt(invoice.total, cur)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-gray-50 rounded-md p-3 mb-8">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
          <p className="text-xs text-gray-700 leading-relaxed">{invoice.notes}</p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-gray-200 pt-3 flex justify-between text-[10px] text-gray-400">
        <span>{org.name} — {invoice.number}</span>
        <span>Generated by FLUX Business Platform</span>
      </div>
    </div>
  );
}

export default function InvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const printRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    fetch(`/api/invoices/${params.id}/pdf`)
      .then((r) => r.json())
      .then((d) => { setData(d); setPreviewOpen(true); })
      .catch(() => toast.error("Failed to load invoice"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDownloadPDF = () => {
    if (!printRef.current || !data) return;

    const content = printRef.current.innerHTML;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to download PDF");
      return;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>${data.invoice.number} — ${data.org.name}</title>
        <meta charset="utf-8"/>
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@3/dist/tailwind.min.css" rel="stylesheet"/>
        <style>
          body { margin: 0; padding: 0; background: white; }
          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          @page { size: A4; margin: 15mm; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="py-20 text-center text-muted-foreground">Invoice not found</div>
    );
  }

  return (
    <div>
      {/* Top bar */}
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.push("/invoices")}>
          <ArrowLeft className="mr-2 size-4" />
          Back to Invoices
        </Button>
        <Button
          size="sm"
          className="bg-[#d97706] text-white hover:bg-[#b45309]"
          onClick={handleDownloadPDF}
        >
          <Download className="mr-2 size-4" />
          Download PDF
        </Button>
      </div>

      {/* Preview modal/card */}
      <div className="rounded-xl border border-border shadow-lg overflow-hidden bg-white dark:bg-white">
        <div ref={printRef}>
          <InvoiceDocument {...data} />
        </div>
      </div>

      {/* Bottom action */}
      <div className="mt-4 flex justify-center gap-3">
        <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
          <Printer className="mr-2 size-4" />
          Print
        </Button>
      </div>
    </div>
  );
}
