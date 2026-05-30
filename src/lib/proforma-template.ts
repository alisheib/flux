/**
 * FLUX — Proforma Invoice HTML template for server-side PDF generation.
 * A sibling of buildInvoiceHTML (01-invoice-template.ts): same brand bar,
 * header, items table, totals and footer. Only provisional markers differ.
 * A4 portrait, 300 DPI, inline styles only.
 *
 * Differentiation from the tax invoice (and nothing else):
 *  D1  Title "PROFORMA INVOICE" (instead of "INVOICE")
 *  D2  "Due Date" slot becomes "Valid Until" + footer validity line
 *  D3  Same bordered status box; word changes per proformaStatus
 *  D4  "Price quotation — not a tax invoice" under the number + in footer
 *  D5  Conversion: one ruled line "Converted to INV-#### · {date}"; status "Converted"
 *  D6  Accept/Signature/Date block (notes-box style); removed once converted
 *  D7  PRO-#### numbering (separate sequence)
 *  D8  Expired: faint grey "EXPIRED" watermark; status "Expired"
 *
 * SECURITY: customerTin is intentionally NOT rendered (07-invoice-data-shape.md).
 */

import { formatCurrencyValue } from "@/lib/currency";

interface ProformaTemplateData {
  proforma: {
    number: string;                 // "PRO-0042"
    customer: string;
    customerPhone: string | null;
    customerEmail: string | null;
    customerAddress: string | null;
    // customerTin intentionally omitted from PDF output
    subtotal: number;
    taxRate: number;
    taxAmount: number;
    discount: number;
    total: number;
    currency: string;
    proformaStatus: "draft" | "sent" | "accepted" | "converted" | "expired" | "declined";
    issuedAt: string;
    validUntil: string;
    convertedToInvoiceNumber: string | null;
    convertedAt: string | null;
    notes: string | null;
    items: { name: string; quantity: number; unitPrice: number; total: number; sellingUnit?: string; area?: number | null }[];
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

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  converted: "Converted",
  expired: "Expired",
  declined: "Declined",
};

function formatAmount(value: number, currency: string): string {
  return formatCurrencyValue(value, currency);
}
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function buildProformaHTML(data: ProformaTemplateData): string {
  const { proforma: pf, org } = data;
  const cur = pf.currency || org.currency || "USD";
  const isConverted = pf.proformaStatus === "converted";
  const isExpired = pf.proformaStatus === "expired";

  const itemRows = pf.items.map((item, i) => {
    const isSqm = item.sellingUnit === "sqm";
    const qtyLabel = isSqm ? `${item.area ?? item.quantity} m²` : String(item.quantity);
    const priceLabel = isSqm ? `${formatAmount(item.unitPrice, cur)}/m²` : formatAmount(item.unitPrice, cur);
    const bg = i % 2 === 0 ? "#fafafa" : "#ffffff";
    return `
    <tr>
      <td style="padding: 12px 16px; font-size: 13px; color: #111827; border-bottom: 1px solid #f3f4f6; background: ${bg}">${escapeHtml(item.name)}</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6; text-align: center; background: ${bg}">${qtyLabel}</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #6b7280; border-bottom: 1px solid #f3f4f6; text-align: right; background: ${bg}">${priceLabel}</td>
      <td style="padding: 12px 16px; font-size: 13px; color: #111827; font-weight: 600; border-bottom: 1px solid #f3f4f6; text-align: right; background: ${bg}">${formatAmount(item.total, cur)}</td>
    </tr>`;
  }).join("");

  let totalsHTML = `
    <tr>
      <td style="padding: 6px 0; font-size: 13px; color: #6b7280">Subtotal</td>
      <td style="padding: 6px 0; font-size: 13px; color: #111827; text-align: right">${formatAmount(pf.subtotal, cur)}</td>
    </tr>`;
  if (pf.discount > 0) {
    totalsHTML += `
    <tr>
      <td style="padding: 6px 0; font-size: 13px; color: #6b7280">Discount</td>
      <td style="padding: 6px 0; font-size: 13px; color: #dc2626; text-align: right">-${formatAmount(pf.discount, cur)}</td>
    </tr>`;
  }
  if (pf.taxRate > 0) {
    totalsHTML += `
    <tr>
      <td style="padding: 6px 0; font-size: 13px; color: #6b7280">${escapeHtml(org.taxLabel)} (${pf.taxRate}%)</td>
      <td style="padding: 6px 0; font-size: 13px; color: #111827; text-align: right">${formatAmount(pf.taxAmount, cur)}</td>
    </tr>`;
  }

  const statusLabel = STATUS_LABEL[pf.proformaStatus] ?? "Sent";
  const validText = isExpired ? `${formatDate(pf.validUntil)} — lapsed` : formatDate(pf.validUntil);

  // D5 — conversion note
  const convertNote = isConverted
    ? `<div style="border-top:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;padding:11px 0;margin-bottom:28px;font-size:11.5px;color:#374151;"><span style="font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.8px;font-size:10px;">Converted</span> &nbsp; to tax invoice <strong style="color:#111827;">${escapeHtml(pf.convertedToInvoiceNumber ?? "")}</strong>${pf.convertedAt ? ` · ${formatDate(pf.convertedAt)}` : ""}</div>`
    : "";

  // D8 — watermark
  const watermark = isExpired
    ? `<div style="position:absolute;top:46%;left:50%;transform:translate(-50%,-50%) rotate(-22deg);font-size:160px;font-weight:700;letter-spacing:0.04em;color:rgba(17,24,39,0.05);z-index:0;pointer-events:none;white-space:nowrap;">EXPIRED</div>`
    : "";

  // D6 — signature, hidden once converted
  const signature = isConverted ? "" : `
  <div style="background:#fafafa;border:1px solid #f3f4f6;border-radius:6px;padding:16px;margin-bottom:24px;">
    <div style="font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin-bottom:16px;">Acceptance — sign and return to confirm</div>
    <table style="width:100%;"><tr>
      <td style="width:33%;padding-right:20px;"><div style="border-bottom:1px solid #9ca3af;height:26px;"></div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin-top:6px;">Name</div></td>
      <td style="width:33%;padding-right:20px;"><div style="border-bottom:1px solid #9ca3af;height:26px;"></div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin-top:6px;">Signature</div></td>
      <td style="width:33%;"><div style="border-bottom:1px solid #9ca3af;height:26px;"></div><div style="font-size:9px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.8px;margin-top:6px;">Date</div></td>
    </tr></table>
  </div>`;

  // D2/D4/D5 — footer line
  const footerLine = isConverted
    ? `This proforma was accepted and converted to tax invoice ${escapeHtml(pf.convertedToInvoiceNumber ?? "")}${pf.convertedAt ? ` on ${formatDate(pf.convertedAt)}` : ""}. Refer to that invoice for payment and tax records. Retained for reference only.`
    : isExpired
    ? `This quotation expired on ${formatDate(pf.validUntil)}. Prices and availability are no longer guaranteed — please request a current quotation from ${escapeHtml(org.name)}. This document is not a tax invoice.`
    : `This quotation is valid until ${formatDate(pf.validUntil)}. Prices and availability are not guaranteed after this date. This document is not a tax invoice and does not represent a completed sale.`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(pf.number)} — ${escapeHtml(org.name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111827; background: #ffffff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
      font-size: 14px; line-height: 1.5;
    }
    @page { size: A4; margin: 20mm 18mm; }
    @page { @top-left { content: none; } @top-right { content: none; } @bottom-left { content: none; } @bottom-right { content: none; } }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
<div style="max-width: 680px; margin: 0 auto; padding: 0; position: relative;">
  ${watermark}
  <div style="position: relative; z-index: 1;">

  <!-- Brand accent line -->
  <div style="height: 4px; background: linear-gradient(90deg, #d97706, #f59e0b); border-radius: 2px; margin-bottom: 32px;"></div>

  <!-- Header -->
  <table style="width: 100%; margin-bottom: 36px;">
    <tr>
      <td style="vertical-align: top; width: 50%;">
        ${org.logo ? `<img src="${escapeHtml(org.logo)}" alt="${escapeHtml(org.name)}" style="max-height: 52px; max-width: 200px; margin-bottom: 12px; display: block;"/>` : ""}
        <div style="font-size: 20px; font-weight: 700; color: #111827; letter-spacing: -0.02em;">${escapeHtml(org.name)}</div>
        ${org.address ? `<div style="font-size: 11px; color: #6b7280; margin-top: 4px; line-height: 1.4;">${escapeHtml(org.address)}</div>` : ""}
        ${org.phone ? `<div style="font-size: 11px; color: #6b7280; line-height: 1.4;">${escapeHtml(org.phone)}</div>` : ""}
        ${org.email ? `<div style="font-size: 11px; color: #6b7280; line-height: 1.4;">${escapeHtml(org.email)}</div>` : ""}
        ${org.website ? `<div style="font-size: 11px; color: #6b7280; line-height: 1.4;">${escapeHtml(org.website)}</div>` : ""}
      </td>
      <td style="vertical-align: top; text-align: right; width: 50%;">
        <div style="font-size: 26px; font-weight: 700; color: #111827; letter-spacing: -0.03em;">PROFORMA INVOICE</div>
        <div style="font-size: 15px; font-weight: 700; color: #d97706; margin-top: 4px;">${escapeHtml(pf.number)}</div>
        <div style="font-size: 11px; color: #9a3412; font-style: italic; margin-top: 3px;">Price quotation — not a tax invoice</div>
      </td>
    </tr>
  </table>

  <!-- Separator -->
  <div style="height: 1px; background: #e5e7eb; margin-bottom: 28px;"></div>

  ${convertNote}

  <!-- Meta: Dates + Customer -->
  <table style="width: 100%; margin-bottom: 32px;">
    <tr>
      <td style="vertical-align: top; width: 50%; padding-right: 20px;">
        <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Issue Date</div>
        <div style="font-size: 13px; color: #374151; margin-bottom: 16px;">${formatDate(pf.issuedAt)}</div>
        <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Valid Until</div>
        <div style="font-size: 13px; color: #374151; margin-bottom: 16px;">${validText}</div>
        <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Status</div>
        <div style="display: inline-block; border: 1.5px solid #111827; padding: 3px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #111827;">${escapeHtml(statusLabel)}</div>
      </td>
      <td style="vertical-align: top; width: 50%;">
        <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Prepared For</div>
        <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px;">${escapeHtml(pf.customer)}</div>
        ${pf.customerPhone ? `<div style="font-size: 12px; color: #6b7280; line-height: 1.5;">${escapeHtml(pf.customerPhone)}</div>` : ""}
        ${pf.customerEmail ? `<div style="font-size: 12px; color: #6b7280; line-height: 1.5;">${escapeHtml(pf.customerEmail)}</div>` : ""}
        ${pf.customerAddress ? `<div style="font-size: 12px; color: #6b7280; line-height: 1.5;">${escapeHtml(pf.customerAddress)}</div>` : ""}
      </td>
    </tr>
  </table>

  <!-- Items Table -->
  <table style="width: 100%; margin-bottom: 28px;">
    <thead>
      <tr style="background: #111827;">
        <th style="padding: 11px 16px; font-size: 10px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px; text-align: left; border-radius: 6px 0 0 6px;">Item</th>
        <th style="padding: 11px 16px; font-size: 10px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px; text-align: center;">Qty</th>
        <th style="padding: 11px 16px; font-size: 10px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px; text-align: right;">Unit Price</th>
        <th style="padding: 11px 16px; font-size: 10px; font-weight: 700; color: #ffffff; text-transform: uppercase; letter-spacing: 0.8px; text-align: right; border-radius: 0 6px 6px 0;">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Totals -->
  <table style="width: 260px; margin-left: auto; margin-bottom: 32px;">
    <tbody>
      ${totalsHTML}
      <tr><td colspan="2" style="padding-top: 8px;"><div style="height: 3px; background: #d97706; border-radius: 1px;"></div></td></tr>
      <tr>
        <td style="padding: 10px 0; font-size: 18px; font-weight: 700; color: #111827;">TOTAL</td>
        <td style="padding: 10px 0; font-size: 18px; font-weight: 700; color: #d97706; text-align: right;">${formatAmount(pf.total, cur)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Terms -->
  ${pf.notes ? `
  <div style="background: #fafafa; border: 1px solid #f3f4f6; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px;">
    <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Terms</div>
    <div style="font-size: 12px; color: #374151; line-height: 1.6;">${escapeHtml(pf.notes)}</div>
  </div>` : ""}

  ${signature}

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 20px;">
    <div style="font-size: 10px; color: #6b7280; line-height: 1.6; margin-bottom: 8px;">${escapeHtml(footerLine)}</div>
    <table style="width: 100%;">
      <tr>
        <td style="font-size: 10px; color: #9ca3af;">${escapeHtml(org.name)} — ${escapeHtml(pf.number)}</td>
        <td style="font-size: 10px; color: #9ca3af; text-align: right;">Generated by FLUX Business Platform</td>
      </tr>
    </table>
  </div>

  </div>
</div>
</body>
</html>`;
}

export type { ProformaTemplateData };
