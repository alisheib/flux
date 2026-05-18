/**
 * Professional invoice HTML template for server-side PDF generation.
 * Uses only inline styles — no external CSS dependencies.
 * Designed for A4 print at 300 DPI quality.
 */

interface InvoiceTemplateData {
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

function formatAmount(value: number, currency: string): string {
  const formatted = value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency} ${formatted}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildInvoiceHTML(data: InvoiceTemplateData): string {
  const { invoice: inv, org } = data;
  const cur = inv.currency || org.currency || "USD";

  // Build item rows
  const itemRows = inv.items
    .map(
      (item, i) => {
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
      }
    )
    .join("");

  // Build totals section
  let totalsHTML = `
    <tr>
      <td style="padding: 6px 0; font-size: 13px; color: #6b7280">Subtotal</td>
      <td style="padding: 6px 0; font-size: 13px; color: #111827; text-align: right">${formatAmount(inv.subtotal, cur)}</td>
    </tr>`;

  if (inv.discount > 0) {
    totalsHTML += `
    <tr>
      <td style="padding: 6px 0; font-size: 13px; color: #6b7280">Discount</td>
      <td style="padding: 6px 0; font-size: 13px; color: #dc2626; text-align: right">-${formatAmount(inv.discount, cur)}</td>
    </tr>`;
  }

  if (inv.taxRate > 0) {
    totalsHTML += `
    <tr>
      <td style="padding: 6px 0; font-size: 13px; color: #6b7280">${escapeHtml(org.taxLabel)} (${inv.taxRate}%)</td>
      <td style="padding: 6px 0; font-size: 13px; color: #111827; text-align: right">${formatAmount(inv.taxAmount, cur)}</td>
    </tr>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${escapeHtml(inv.number)} — ${escapeHtml(org.name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #111827;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 14px;
      line-height: 1.5;
    }
    @page {
      size: A4;
      margin: 20mm 18mm;
    }
    /* Remove browser-added headers/footers (date, URL, page number) */
    @page {
      @top-left { content: none; }
      @top-right { content: none; }
      @bottom-left { content: none; }
      @bottom-right { content: none; }
    }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
<div style="max-width: 680px; margin: 0 auto; padding: 0;">

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
        <div style="font-size: 32px; font-weight: 700; color: #111827; letter-spacing: -0.03em;">INVOICE</div>
        <div style="font-size: 15px; font-weight: 700; color: #d97706; margin-top: 4px;">${escapeHtml(inv.number)}</div>
      </td>
    </tr>
  </table>

  <!-- Separator -->
  <div style="height: 1px; background: #e5e7eb; margin-bottom: 28px;"></div>

  <!-- Meta: Dates + Customer -->
  <table style="width: 100%; margin-bottom: 32px;">
    <tr>
      <td style="vertical-align: top; width: 50%; padding-right: 20px;">
        <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Issue Date</div>
        <div style="font-size: 13px; color: #374151; margin-bottom: 16px;">${formatDate(inv.issuedAt)}</div>
        ${inv.dueAt ? `
        <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Due Date</div>
        <div style="font-size: 13px; color: #374151; margin-bottom: 16px;">${formatDate(inv.dueAt)}</div>
        ` : ""}
        <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Status</div>
        <div style="display: inline-block; border: 1.5px solid #111827; padding: 3px 12px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: #111827;">${escapeHtml(inv.status)}</div>
      </td>
      <td style="vertical-align: top; width: 50%;">
        <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 6px;">Bill To</div>
        <div style="font-size: 14px; font-weight: 600; color: #111827; margin-bottom: 4px;">${escapeHtml(inv.customer)}</div>
        ${inv.customerPhone ? `<div style="font-size: 12px; color: #6b7280; line-height: 1.5;">${escapeHtml(inv.customerPhone)}</div>` : ""}
        ${inv.customerEmail ? `<div style="font-size: 12px; color: #6b7280; line-height: 1.5;">${escapeHtml(inv.customerEmail)}</div>` : ""}
        ${inv.customerAddress ? `<div style="font-size: 12px; color: #6b7280; line-height: 1.5;">${escapeHtml(inv.customerAddress)}</div>` : ""}
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
    <tbody>
      ${itemRows}
    </tbody>
  </table>

  <!-- Totals -->
  <table style="width: 260px; margin-left: auto; margin-bottom: 32px;">
    <tbody>
      ${totalsHTML}
      <tr>
        <td colspan="2" style="padding-top: 8px;">
          <div style="height: 3px; background: #d97706; border-radius: 1px;"></div>
        </td>
      </tr>
      <tr>
        <td style="padding: 10px 0; font-size: 18px; font-weight: 700; color: #111827;">TOTAL</td>
        <td style="padding: 10px 0; font-size: 18px; font-weight: 700; color: #d97706; text-align: right;">${formatAmount(inv.total, cur)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Notes -->
  ${inv.notes ? `
  <div style="background: #fafafa; border: 1px solid #f3f4f6; border-radius: 6px; padding: 14px 16px; margin-bottom: 32px;">
    <div style="font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;">Notes</div>
    <div style="font-size: 12px; color: #374151; line-height: 1.6;">${escapeHtml(inv.notes)}</div>
  </div>
  ` : ""}

  <!-- Footer -->
  <div style="border-top: 1px solid #e5e7eb; padding-top: 14px; margin-top: 20px;">
    <table style="width: 100%;">
      <tr>
        <td style="font-size: 10px; color: #9ca3af;">${escapeHtml(org.name)} — ${escapeHtml(inv.number)}</td>
        <td style="font-size: 10px; color: #9ca3af; text-align: right;">Generated by FLUX Business Platform</td>
      </tr>
    </table>
  </div>

</div>
</body>
</html>`;
}

export type { InvoiceTemplateData };
