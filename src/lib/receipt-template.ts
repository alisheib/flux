/**
 * Professional receipt HTML template for server-side PDF generation.
 * Thermal receipt style — narrower than invoice, optimized for POS.
 * Uses Inter font, inline styles, no external dependencies.
 */

interface ReceiptTemplateData {
  receipt: {
    number: string;
    customer: string | null;
    customerPhone: string | null;
    subtotal: number;
    taxRate: number;
    taxLabel: string;
    taxAmount: number;
    discount: number;
    total: number;
    currency: string;
    paymentMethod: string;
    items: { name: string; quantity: number; unitPrice: number; total: number; sellingUnit?: string; area?: number | null }[];
    createdAt: string;
    salesperson: string;
  };
  org: {
    name: string;
    logo: string | null;
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
  };
}

function formatAmount(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatPayment(method: string): string {
  return method.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function buildReceiptHTML(data: ReceiptTemplateData): string {
  const { receipt: r, org } = data;
  const cur = r.currency || "USD";
  const date = new Date(r.createdAt);
  const dateStr = date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

  const itemRows = r.items.map((item) => {
    const isSqm = item.sellingUnit === "sqm";
    const qtyLabel = isSqm ? `${item.area ?? item.quantity} m²` : String(item.quantity);
    const priceLabel = isSqm ? `${formatAmount(item.unitPrice, cur)}/m²` : formatAmount(item.unitPrice, cur);
    return `
    <tr>
      <td style="padding:8px 0;font-size:12px;color:#1a1813;border-bottom:1px solid #f0f0f0">${escapeHtml(item.name)}</td>
      <td style="padding:8px 0;font-size:12px;color:#6b7280;text-align:center;border-bottom:1px solid #f0f0f0">${qtyLabel}</td>
      <td style="padding:8px 0;font-size:12px;color:#6b7280;text-align:right;border-bottom:1px solid #f0f0f0">${priceLabel}</td>
      <td style="padding:8px 0;font-size:12px;color:#1a1813;font-weight:600;text-align:right;border-bottom:1px solid #f0f0f0">${formatAmount(item.total, cur)}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Receipt ${escapeHtml(r.number)} — ${escapeHtml(org.name)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin:0; padding:0; box-sizing:border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1a1813;
      background: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    @page { size: A5; margin: 12mm; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>
<div style="max-width:420px;margin:0 auto;padding:28px 20px;">

  <!-- Header — centered company info -->
  <div style="text-align:center;margin-bottom:20px;">
    ${org.logo ? `<img src="${escapeHtml(org.logo)}" alt="${escapeHtml(org.name)}" style="max-height:40px;max-width:160px;margin:0 auto 10px;display:block;"/>` : ""}
    <div style="font-size:18px;font-weight:700;color:#1a1813;letter-spacing:-0.02em;">${escapeHtml(org.name)}</div>
    ${org.address ? `<div style="font-size:10px;color:#6b7280;margin-top:3px;">${escapeHtml(org.address)}</div>` : ""}
    ${org.phone ? `<div style="font-size:10px;color:#6b7280;">${escapeHtml(org.phone)}</div>` : ""}
    ${org.email ? `<div style="font-size:10px;color:#6b7280;">${escapeHtml(org.email)}</div>` : ""}
  </div>

  <!-- Brand line -->
  <div style="height:3px;background:linear-gradient(90deg,#d97706,#f59e0b);border-radius:1px;margin-bottom:16px;"></div>

  <!-- Receipt title + meta -->
  <div style="text-align:center;margin-bottom:16px;">
    <div style="font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:#1a1813;">Sales Receipt</div>
    <div style="font-size:12px;font-weight:700;color:#d97706;margin-top:3px;">${escapeHtml(r.number)}</div>
  </div>

  <!-- Date, time, salesperson -->
  <table style="width:100%;margin-bottom:14px;">
    <tr>
      <td style="font-size:10px;color:#6b7280;">Date</td>
      <td style="font-size:11px;color:#1a1813;text-align:right;">${dateStr}</td>
    </tr>
    <tr>
      <td style="font-size:10px;color:#6b7280;">Time</td>
      <td style="font-size:11px;color:#1a1813;text-align:right;">${timeStr}</td>
    </tr>
    <tr>
      <td style="font-size:10px;color:#6b7280;">Served by</td>
      <td style="font-size:11px;color:#1a1813;text-align:right;">${escapeHtml(r.salesperson)}</td>
    </tr>
    ${r.customer ? `<tr>
      <td style="font-size:10px;color:#6b7280;">Customer</td>
      <td style="font-size:11px;color:#1a1813;text-align:right;">${escapeHtml(r.customer)}</td>
    </tr>` : ""}
    ${r.customerPhone ? `<tr>
      <td style="font-size:10px;color:#6b7280;">Phone</td>
      <td style="font-size:11px;color:#1a1813;text-align:right;">${escapeHtml(r.customerPhone)}</td>
    </tr>` : ""}
  </table>

  <!-- Separator -->
  <div style="border-top:1px dashed #d1d5db;margin-bottom:12px;"></div>

  <!-- Items -->
  <table style="width:100%;margin-bottom:12px;">
    <thead>
      <tr>
        <th style="padding:6px 0;font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;text-align:left;border-bottom:1px solid #e5e7eb;">Item</th>
        <th style="padding:6px 0;font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;text-align:center;border-bottom:1px solid #e5e7eb;">Qty</th>
        <th style="padding:6px 0;font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border-bottom:1px solid #e5e7eb;">Price</th>
        <th style="padding:6px 0;font-size:9px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:0.5px;text-align:right;border-bottom:1px solid #e5e7eb;">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <!-- Separator -->
  <div style="border-top:1px dashed #d1d5db;margin-bottom:10px;"></div>

  <!-- Totals -->
  <table style="width:100%;margin-bottom:10px;">
    <tr>
      <td style="padding:4px 0;font-size:12px;color:#6b7280;">Subtotal</td>
      <td style="padding:4px 0;font-size:12px;color:#1a1813;text-align:right;">${formatAmount(r.subtotal, cur)}</td>
    </tr>
    ${r.discount > 0 ? `<tr>
      <td style="padding:4px 0;font-size:12px;color:#6b7280;">Discount</td>
      <td style="padding:4px 0;font-size:12px;color:#dc2626;text-align:right;">-${formatAmount(r.discount, cur)}</td>
    </tr>` : ""}
    ${r.taxRate > 0 ? `<tr>
      <td style="padding:4px 0;font-size:12px;color:#6b7280;">${escapeHtml(r.taxLabel)} (${r.taxRate}%)</td>
      <td style="padding:4px 0;font-size:12px;color:#1a1813;text-align:right;">${formatAmount(r.taxAmount, cur)}</td>
    </tr>` : ""}
  </table>

  <!-- Grand total -->
  <div style="background:#1a1813;border-radius:6px;padding:12px 14px;display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
    <span style="font-size:14px;font-weight:700;color:#ffffff;">TOTAL</span>
    <span style="font-size:18px;font-weight:700;color:#d97706;">${formatAmount(r.total, cur)}</span>
  </div>

  <!-- Payment method -->
  <div style="text-align:center;margin-bottom:14px;">
    <div style="display:inline-block;border:1.5px solid #1a1813;padding:4px 16px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#1a1813;">
      Paid by ${formatPayment(r.paymentMethod)}
    </div>
  </div>

  <!-- Separator -->
  <div style="border-top:1px dashed #d1d5db;margin-bottom:12px;"></div>

  <!-- Footer -->
  <div style="text-align:center;">
    <div style="font-size:11px;font-weight:600;color:#1a1813;margin-bottom:4px;">Thank you for your business!</div>
    <div style="font-size:9px;color:#9ca3af;">${escapeHtml(org.name)}${org.website ? ` — ${escapeHtml(org.website)}` : ""}</div>
    <div style="font-size:9px;color:#9ca3af;margin-top:2px;">Powered by FLUX Business Platform</div>
  </div>

</div>
</body>
</html>`;
}

export type { ReceiptTemplateData };
