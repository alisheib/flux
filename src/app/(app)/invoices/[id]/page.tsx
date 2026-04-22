"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
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

function fmt(v: number, c: string) {
  return `${c} ${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function buildInvoiceHTML(data: InvoiceData): string {
  const { invoice: inv, org } = data;
  const cur = inv.currency || org.currency || "USD";
  const issueDate = new Date(inv.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const dueDate = inv.dueAt ? new Date(inv.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";

  const itemRows = inv.items.map((item, i) => `
    <tr style="background:${i % 2 === 0 ? '#fafaf9' : '#fff'}">
      <td style="padding:10px 14px;font-size:12px;border-bottom:1px solid #f3f4f6">${item.name}</td>
      <td style="padding:10px 14px;font-size:12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#6b7280">${item.quantity}</td>
      <td style="padding:10px 14px;font-size:12px;border-bottom:1px solid #f3f4f6;text-align:right;color:#6b7280">${fmt(item.unitPrice, cur)}</td>
      <td style="padding:10px 14px;font-size:12px;border-bottom:1px solid #f3f4f6;text-align:right;font-weight:600">${fmt(item.total, cur)}</td>
    </tr>
  `).join("");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${inv.number} — ${org.name}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1813;background:#fff}
  @page{size:A4;margin:18mm}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
  table{border-collapse:collapse}
</style></head>
<body>
<div style="max-width:720px;margin:0 auto;padding:40px">

  <div style="height:4px;background:#d97706;border-radius:2px;margin-bottom:28px"></div>

  <div style="display:flex;justify-content:space-between;margin-bottom:32px">
    <div>
      ${org.logo ? `<img src="${org.logo}" style="max-height:48px;max-width:180px;margin-bottom:10px"/>` : ""}
      <div style="font-size:20px;font-weight:700">${org.name}</div>
      ${org.address ? `<div style="font-size:11px;color:#6b7280;margin-top:3px">${org.address}</div>` : ""}
      ${org.phone ? `<div style="font-size:11px;color:#6b7280">${org.phone}</div>` : ""}
      ${org.email ? `<div style="font-size:11px;color:#6b7280">${org.email}</div>` : ""}
      ${org.website ? `<div style="font-size:11px;color:#6b7280">${org.website}</div>` : ""}
    </div>
    <div style="text-align:right">
      <div style="font-size:28px;font-weight:700">INVOICE</div>
      <div style="font-size:14px;font-weight:700;color:#d97706;margin-top:4px">${inv.number}</div>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;margin-bottom:28px">
    <div style="width:48%">
      <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Issue Date</div>
      <div style="font-size:12px">${issueDate}</div>
      ${dueDate ? `<div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;margin-top:12px">Due Date</div><div style="font-size:12px">${dueDate}</div>` : ""}
      <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;margin-top:12px">Status</div>
      <div style="display:inline-block;border:1.5px solid #1a1813;padding:3px 10px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px">${inv.status}</div>
    </div>
    <div style="width:48%">
      <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px">Bill To</div>
      <div style="font-size:12px;font-weight:600">${inv.customer}</div>
      ${inv.customerPhone ? `<div style="font-size:11px;color:#6b7280">${inv.customerPhone}</div>` : ""}
      ${inv.customerEmail ? `<div style="font-size:11px;color:#6b7280">${inv.customerEmail}</div>` : ""}
      ${inv.customerAddress ? `<div style="font-size:11px;color:#6b7280">${inv.customerAddress}</div>` : ""}
    </div>
  </div>

  <table style="width:100%;margin-bottom:24px">
    <thead>
      <tr style="background:#1a1813">
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-radius:4px 0 0 4px">Item</th>
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;text-align:right">Qty</th>
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;text-align:right">Unit Price</th>
        <th style="padding:10px 14px;font-size:10px;font-weight:700;color:#fff;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border-radius:0 4px 4px 0">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div style="display:flex;justify-content:flex-end;margin-bottom:24px">
    <div style="width:240px">
      <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px">
        <span style="color:#6b7280">Subtotal</span><span>${fmt(inv.subtotal, cur)}</span>
      </div>
      ${inv.discount > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px"><span style="color:#6b7280">Discount</span><span style="color:#dc2626">-${fmt(inv.discount, cur)}</span></div>` : ""}
      ${inv.taxRate > 0 ? `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:12px"><span style="color:#6b7280">${org.taxLabel} (${inv.taxRate}%)</span><span>${fmt(inv.taxAmount, cur)}</span></div>` : ""}
      <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:3px solid #d97706;margin-top:6px">
        <span style="font-size:16px;font-weight:700">TOTAL</span>
        <span style="font-size:16px;font-weight:700;color:#d97706">${fmt(inv.total, cur)}</span>
      </div>
    </div>
  </div>

  ${inv.notes ? `<div style="background:#fafaf9;border-radius:4px;padding:12px;margin-bottom:24px"><div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">Notes</div><div style="font-size:11px;line-height:1.5">${inv.notes}</div></div>` : ""}

  <div style="border-top:1px solid #e5e7eb;padding-top:10px;display:flex;justify-content:space-between;font-size:9px;color:#9ca3af">
    <span>${org.name} — ${inv.number}</span>
    <span>Generated by FLUX Business Platform</span>
  </div>

</div></body></html>`;
}

export default function InvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/invoices/${params.id}/pdf`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast.error("Failed to load invoice"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDownloadPDF = () => {
    if (!data) return;
    const html = buildInvoiceHTML(data);
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error("Please allow popups to download the PDF");
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    // Wait for content to render then trigger print
    printWindow.onload = () => printWindow.print();
    // Fallback if onload doesn't fire
    setTimeout(() => printWindow.print(), 300);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) {
    return <div className="py-20 text-center text-muted-foreground">Invoice not found</div>;
  }

  const { invoice: inv, org } = data;
  const cur = inv.currency || org.currency || "USD";

  return (
    <div className="mx-auto max-w-3xl">
      {/* Action bar */}
      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.push("/invoices")}>
          <ArrowLeft className="mr-2 size-4" />
          Back
        </Button>
        <Button size="sm" className="bg-[#d97706] text-white hover:bg-[#b45309]" onClick={handleDownloadPDF}>
          <Download className="mr-2 size-4" />
          Download PDF
        </Button>
      </div>

      {/* Invoice preview — constrained width, white card */}
      <div className="mx-auto max-w-[720px] rounded-xl border border-border bg-white shadow-sm overflow-hidden dark:bg-white dark:text-gray-900">
        <div className="p-8">
          {/* Brand stripe */}
          <div className="h-1 w-full rounded-sm bg-[#d97706] mb-7" />

          {/* Header */}
          <div className="flex justify-between mb-8">
            <div>
              {org.logo && <img src={org.logo} alt={org.name} className="mb-3 h-12 w-auto object-contain" />}
              <h1 className="text-lg font-bold text-gray-900">{org.name}</h1>
              {org.address && <p className="text-[11px] text-gray-500 mt-1">{org.address}</p>}
              {org.phone && <p className="text-[11px] text-gray-500">{org.phone}</p>}
              {org.email && <p className="text-[11px] text-gray-500">{org.email}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-2xl font-bold text-gray-900">INVOICE</h2>
              <p className="text-sm font-bold text-[#d97706] mt-1">{inv.number}</p>
            </div>
          </div>

          {/* Meta */}
          <div className="flex justify-between mb-8">
            <div className="w-[48%]">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Issue Date</p>
              <p className="text-xs text-gray-700">{new Date(inv.issuedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
              {inv.dueAt && (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 mt-3">Due Date</p>
                  <p className="text-xs text-gray-700">{new Date(inv.dueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
                </>
              )}
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1 mt-3">Status</p>
              <span className="inline-block border-[1.5px] border-gray-900 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-gray-900">
                {inv.status}
              </span>
            </div>
            <div className="w-[48%]">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Bill To</p>
              <p className="text-xs font-semibold text-gray-900">{inv.customer}</p>
              {inv.customerPhone && <p className="text-[11px] text-gray-500">{inv.customerPhone}</p>}
              {inv.customerEmail && <p className="text-[11px] text-gray-500">{inv.customerEmail}</p>}
            </div>
          </div>

          {/* Table */}
          <table className="w-full mb-6 text-xs">
            <thead>
              <tr className="bg-gray-900 text-white">
                <th className="px-3 py-2 text-left text-[9px] font-bold uppercase tracking-wider rounded-l">Item</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-wider">Qty</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-wider">Unit Price</th>
                <th className="px-3 py-2 text-right text-[9px] font-bold uppercase tracking-wider rounded-r">Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : ""}>
                  <td className="px-3 py-2 text-gray-900">{item.name}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-gray-500">{fmt(item.unitPrice, cur)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-gray-900">{fmt(item.total, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-6">
            <div className="w-52">
              <div className="flex justify-between py-1 text-xs">
                <span className="text-gray-500">Subtotal</span>
                <span>{fmt(inv.subtotal, cur)}</span>
              </div>
              {inv.discount > 0 && (
                <div className="flex justify-between py-1 text-xs">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-600">-{fmt(inv.discount, cur)}</span>
                </div>
              )}
              {inv.taxRate > 0 && (
                <div className="flex justify-between py-1 text-xs">
                  <span className="text-gray-500">{org.taxLabel} ({inv.taxRate}%)</span>
                  <span>{fmt(inv.taxAmount, cur)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 mt-1 border-t-[3px] border-[#d97706]">
                <span className="text-sm font-bold">TOTAL</span>
                <span className="text-sm font-bold text-[#d97706]">{fmt(inv.total, cur)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div className="bg-gray-50 rounded p-3 mb-6">
              <p className="text-[9px] font-bold uppercase tracking-wider text-gray-400 mb-1">Notes</p>
              <p className="text-[11px] text-gray-700 leading-relaxed">{inv.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-3 flex justify-between text-[9px] text-gray-400">
            <span>{org.name} — {inv.number}</span>
            <span>Generated by FLUX</span>
          </div>
        </div>
      </div>
    </div>
  );
}
