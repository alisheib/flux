"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Loader2, FileText } from "lucide-react";
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export default function InvoiceViewPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    fetch(`/api/invoices/${params.id}/pdf`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => toast.error("Failed to load invoice"))
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    toast.info("Generating PDF...");
    try {
      const res = await fetch(`/api/invoices/${params.id}/download`);
      if (!res.ok) throw new Error("Server error");
      const contentType = res.headers.get("content-type") || "";
      const blob = await res.blob();

      if (contentType.includes("text/html")) {
        // Fallback: open HTML in new tab for browser Save as PDF
        const html = await blob.text();
        const win = window.open("", "_blank");
        if (win) {
          win.document.write(html);
          win.document.close();
          setTimeout(() => win.print(), 500);
        }
        toast.info("Use 'Save as PDF' in the print dialog", { description: "Server PDF unavailable — using browser print" });
      } else {
        // Direct PDF download
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${data?.invoice.number || "invoice"}.pdf`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 200);
        toast.success("Download complete", { description: `${data?.invoice.number}.pdf saved` });
      }
    } catch {
      toast.error("Download failed", { description: "Please try again." });
    } finally {
      setDownloading(false);
    }
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
      <div className="mb-5 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => router.push("/invoices")}>
          <ArrowLeft className="mr-2 size-4" />
          Back to Invoices
        </Button>
        <Button
          size="sm"
          className="bg-[#d97706] text-white hover:bg-[#b45309]"
          onClick={handleDownloadPDF}
          disabled={downloading}
        >
          {downloading ? (
            <><Loader2 className="mr-2 size-4 animate-spin" />Generating...</>
          ) : (
            <><Download className="mr-2 size-4" />Download PDF</>
          )}
        </Button>
      </div>

      {/* ═══ Invoice Preview Document ═══ */}
      <div className="mx-auto max-w-[680px] rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden dark:bg-white dark:text-gray-900">
        <div className="p-10">

          {/* Brand accent */}
          <div style={{ height: 4, background: "linear-gradient(90deg, #d97706, #f59e0b)", borderRadius: 2, marginBottom: 28 }} />

          {/* Header */}
          <div className="flex justify-between mb-9">
            <div>
              {org.logo && <img src={org.logo} alt={org.name} className="mb-3 h-12 w-auto object-contain" />}
              <h1 className="text-[19px] font-bold text-gray-900 tracking-tight">{org.name}</h1>
              {org.address && <p className="text-[11px] text-gray-500 mt-1 leading-snug">{org.address}</p>}
              {org.phone && <p className="text-[11px] text-gray-500 leading-snug">{org.phone}</p>}
              {org.email && <p className="text-[11px] text-gray-500 leading-snug">{org.email}</p>}
              {org.website && <p className="text-[11px] text-gray-500 leading-snug">{org.website}</p>}
            </div>
            <div className="text-right">
              <h2 className="text-[28px] font-bold text-gray-900 tracking-tight">INVOICE</h2>
              <p className="text-[14px] font-bold text-[#d97706] mt-1">{inv.number}</p>
            </div>
          </div>

          {/* Separator */}
          <div className="h-px bg-gray-200 mb-7" />

          {/* Meta */}
          <div className="flex justify-between mb-8">
            <div className="w-[48%]">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-1.5">Issue Date</p>
              <p className="text-[13px] text-gray-700 mb-4">{fmtDate(inv.issuedAt)}</p>
              {inv.dueAt && (
                <>
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-1.5">Due Date</p>
                  <p className="text-[13px] text-gray-700 mb-4">{fmtDate(inv.dueAt)}</p>
                </>
              )}
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-1.5">Status</p>
              <span className="inline-block border-[1.5px] border-gray-900 px-3 py-[3px] text-[10px] font-bold uppercase tracking-[0.08em] text-gray-900">
                {inv.status}
              </span>
            </div>
            <div className="w-[48%]">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-1.5">Bill To</p>
              <p className="text-[13px] font-semibold text-gray-900 mb-1">{inv.customer}</p>
              {inv.customerPhone && <p className="text-[11px] text-gray-500 leading-snug">{inv.customerPhone}</p>}
              {inv.customerEmail && <p className="text-[11px] text-gray-500 leading-snug">{inv.customerEmail}</p>}
              {inv.customerAddress && <p className="text-[11px] text-gray-500 leading-snug">{inv.customerAddress}</p>}
            </div>
          </div>

          {/* Items table */}
          <table className="w-full mb-7">
            <thead>
              <tr className="bg-gray-900">
                <th className="px-4 py-[10px] text-left text-[10px] font-bold uppercase tracking-[0.08em] text-white" style={{ borderRadius: "6px 0 0 6px" }}>Item</th>
                <th className="px-4 py-[10px] text-center text-[10px] font-bold uppercase tracking-[0.08em] text-white">Qty</th>
                <th className="px-4 py-[10px] text-right text-[10px] font-bold uppercase tracking-[0.08em] text-white">Unit Price</th>
                <th className="px-4 py-[10px] text-right text-[10px] font-bold uppercase tracking-[0.08em] text-white" style={{ borderRadius: "0 6px 6px 0" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {inv.items.map((item, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                  <td className="px-4 py-3 text-[13px] text-gray-900 border-b border-gray-100">{item.name}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-500 text-center border-b border-gray-100">{item.quantity}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-500 text-right border-b border-gray-100">{fmt(item.unitPrice, cur)}</td>
                  <td className="px-4 py-3 text-[13px] text-gray-900 text-right font-semibold border-b border-gray-100">{fmt(item.total, cur)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-[240px]">
              <div className="flex justify-between py-[5px] text-[13px]">
                <span className="text-gray-500">Subtotal</span>
                <span className="text-gray-900">{fmt(inv.subtotal, cur)}</span>
              </div>
              {inv.discount > 0 && (
                <div className="flex justify-between py-[5px] text-[13px]">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-red-600">-{fmt(inv.discount, cur)}</span>
                </div>
              )}
              {inv.taxRate > 0 && (
                <div className="flex justify-between py-[5px] text-[13px]">
                  <span className="text-gray-500">{org.taxLabel} ({inv.taxRate}%)</span>
                  <span className="text-gray-900">{fmt(inv.taxAmount, cur)}</span>
                </div>
              )}
              <div style={{ height: 3, background: "#d97706", borderRadius: 1, marginTop: 8 }} />
              <div className="flex justify-between py-[10px]">
                <span className="text-[17px] font-bold text-gray-900">TOTAL</span>
                <span className="text-[17px] font-bold text-[#d97706]">{fmt(inv.total, cur)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {inv.notes && (
            <div className="bg-[#fafafa] border border-gray-100 rounded-md p-4 mb-8">
              <p className="text-[9px] font-bold uppercase tracking-[0.1em] text-gray-400 mb-1.5">Notes</p>
              <p className="text-[12px] text-gray-700 leading-relaxed">{inv.notes}</p>
            </div>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-3 flex justify-between">
            <span className="text-[10px] text-gray-400">{org.name} — {inv.number}</span>
            <span className="text-[10px] text-gray-400">Generated by FLUX Business Platform</span>
          </div>
        </div>
      </div>

      {/* File info */}
      <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <FileText className="size-3.5" />
        <span>{inv.number}.pdf — {inv.items.length} item{inv.items.length !== 1 ? "s" : ""} — {fmt(inv.total, cur)}</span>
      </div>
    </div>
  );
}
