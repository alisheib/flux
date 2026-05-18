import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

function fmt(value: number, currency: string): string {
  return `${currency} ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Status rendered as simple black-bordered text box — professional print style

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;

  const invoice = await prisma.invoice.findFirst({
    where: { id, orgId: session.orgId },
    include: {
      org: true,
      sale: { include: { items: true } },
    },
  });

  if (!invoice) {
    return <div style={{ padding: 40, textAlign: "center", color: "#999" }}>Invoice not found</div>;
  }

  const org = invoice.org;
  const items = invoice.sale?.items || [];
  const cur = invoice.currency || org.currency || "USD";
  // Status uses simple black box styling

  return (
    <html>
      <head>
        <title>{invoice.number} — {org.name}</title>
        <meta charSet="utf-8" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #1a1813; background: #fff; }
          .page { max-width: 800px; margin: 0 auto; padding: 40px; }
          .brand-stripe { height: 4px; background: #d97706; border-radius: 2px; margin-bottom: 32px; }
          .header { display: flex; justify-content: space-between; margin-bottom: 36px; }
          .company-name { font-size: 22px; font-weight: 700; color: #1a1813; }
          .company-detail { font-size: 11px; color: #6b7280; margin-top: 3px; }
          .invoice-title { font-size: 32px; font-weight: 700; color: #1a1813; text-align: right; }
          .invoice-number { font-size: 16px; font-weight: 700; color: #d97706; text-align: right; margin-top: 4px; }
          .meta { display: flex; justify-content: space-between; margin-bottom: 32px; }
          .meta-col { width: 48%; }
          .meta-label { font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 4px; }
          .meta-value { font-size: 12px; color: #1a1813; margin-bottom: 3px; }
          .meta-value-bold { font-size: 12px; font-weight: 600; color: #1a1813; margin-bottom: 3px; }
          .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
          thead tr { background: #1a1813; }
          th { padding: 10px 14px; font-size: 10px; font-weight: 700; color: #fff; text-transform: uppercase; letter-spacing: 0.5px; }
          th:first-child { text-align: left; border-radius: 6px 0 0 6px; }
          th:last-child { border-radius: 0 6px 6px 0; }
          th:not(:first-child) { text-align: right; }
          td { padding: 10px 14px; font-size: 12px; border-bottom: 1px solid #f3f4f6; }
          td:not(:first-child) { text-align: right; }
          tr:nth-child(even) { background: #fafaf9; }
          .td-bold { font-weight: 600; }
          .td-muted { color: #6b7280; }
          .totals { display: flex; justify-content: flex-end; margin-bottom: 28px; }
          .totals-box { width: 260px; }
          .total-row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
          .total-label { color: #6b7280; }
          .total-value { color: #1a1813; }
          .total-discount { color: #dc2626; }
          .grand-total { display: flex; justify-content: space-between; padding: 10px 0; border-top: 3px solid #d97706; margin-top: 6px; }
          .grand-total-label { font-size: 18px; font-weight: 700; color: #1a1813; }
          .grand-total-value { font-size: 18px; font-weight: 700; color: #d97706; }
          .notes { background: #fafaf9; border-radius: 6px; padding: 14px; margin-bottom: 28px; }
          .notes-label { font-size: 9px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
          .notes-text { font-size: 11px; color: #1a1813; line-height: 1.5; }
          .footer { border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between; font-size: 9px; color: #9ca3af; }
          .logo { max-height: 48px; max-width: 200px; margin-bottom: 12px; }
          .actions { text-align: center; margin-bottom: 20px; }
          .actions button { background: #1a1813; color: #fff; border: none; padding: 10px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; margin: 0 6px; }
          .actions button:hover { background: #2a271d; }
          .actions a { color: #d97706; font-size: 13px; margin-left: 16px; text-decoration: none; }
          .actions a:hover { text-decoration: underline; }
          @media print {
            .actions { display: none !important; }
            .page { padding: 20px; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
          @page {
            margin: 15mm;
          }
        `}</style>
      </head>
      <body>
        <div className="page">
          {/* Actions bar — hidden on print */}
          <div className="actions">
            <button id="print-btn">Print / Save as PDF</button>
            <a href="/invoices">Back to Invoices</a>
          </div>
          <script dangerouslySetInnerHTML={{ __html: `document.getElementById('print-btn').addEventListener('click',function(){window.print()})` }} />

          <div className="brand-stripe" />

          {/* Header */}
          <div className="header">
            <div>
              {org.logo && <img src={org.logo} alt={org.name} className="logo" />}
              <div className="company-name">{org.name}</div>
              {org.address && <div className="company-detail">{org.address}</div>}
              {org.phone && <div className="company-detail">{org.phone}</div>}
              {org.email && <div className="company-detail">{org.email}</div>}
              {org.website && <div className="company-detail">{org.website}</div>}
            </div>
            <div>
              <div className="invoice-title">INVOICE</div>
              <div className="invoice-number">{invoice.number}</div>
            </div>
          </div>

          {/* Meta */}
          <div className="meta">
            <div className="meta-col">
              <div className="meta-label">Issue Date</div>
              <div className="meta-value">
                {invoice.issuedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              </div>
              {invoice.dueAt && (
                <>
                  <div className="meta-label" style={{ marginTop: 12 }}>Due Date</div>
                  <div className="meta-value">
                    {invoice.dueAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
                  </div>
                </>
              )}
              <div className="meta-label" style={{ marginTop: 12 }}>Status</div>
              <div
                style={{ display: 'inline-block', border: '1.5px solid #1a1813', padding: '4px 12px', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#1a1813' }}
              >
                {invoice.status}
              </div>
            </div>
            <div className="meta-col">
              <div className="meta-label">Bill To</div>
              <div className="meta-value-bold">{invoice.customer}</div>
              {invoice.customerPhone && <div className="meta-value">{invoice.customerPhone}</div>}
              {invoice.customerEmail && <div className="meta-value">{invoice.customerEmail}</div>}
              {invoice.customerAddress && <div className="meta-value">{invoice.customerAddress}</div>}
            </div>
          </div>

          {/* Items */}
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const isSqm = item.sellingUnit === "sqm";
                return (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td className="td-muted">{isSqm ? `${item.area ?? item.quantity} m²` : item.quantity}</td>
                    <td className="td-muted">{fmt(item.unitPrice, cur)}{isSqm ? "/m²" : ""}</td>
                    <td className="td-bold">{fmt(item.total, cur)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals */}
          <div className="totals">
            <div className="totals-box">
              <div className="total-row">
                <span className="total-label">Subtotal</span>
                <span className="total-value">{fmt(invoice.subtotal, cur)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="total-row">
                  <span className="total-label">Discount</span>
                  <span className="total-discount">-{fmt(invoice.discount, cur)}</span>
                </div>
              )}
              {invoice.taxRate > 0 && (
                <div className="total-row">
                  <span className="total-label">{org.taxLabel} ({invoice.taxRate}%)</span>
                  <span className="total-value">{fmt(invoice.taxAmount, cur)}</span>
                </div>
              )}
              <div className="grand-total">
                <span className="grand-total-label">TOTAL</span>
                <span className="grand-total-value">{fmt(invoice.total, cur)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {invoice.notes && (
            <div className="notes">
              <div className="notes-label">Notes</div>
              <div className="notes-text">{invoice.notes}</div>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            <span>{org.name} — {invoice.number}</span>
            <span>Generated by FLUX Business Platform</span>
          </div>
        </div>
      </body>
    </html>
  );
}
