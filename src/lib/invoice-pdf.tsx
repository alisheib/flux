import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  pdf,
} from "@react-pdf/renderer";
import { formatCurrencyValue } from "@/lib/currency";

const BRAND = "#d97706";
const DARK = "#1a1813";
const MUTED = "#6b7280";
const BORDER = "#e5e7eb";
const LIGHT_BG = "#fafaf9";

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: DARK },
  // Header
  headerRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 30 },
  companyName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: DARK },
  companyDetail: { fontSize: 9, color: MUTED, marginTop: 2 },
  invoiceTitle: { fontSize: 24, fontFamily: "Helvetica-Bold", color: DARK, textAlign: "right" },
  invoiceNumber: { fontSize: 12, fontFamily: "Helvetica-Bold", color: BRAND, textAlign: "right", marginTop: 4 },
  // Meta
  metaRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 24 },
  metaCol: { width: "48%" },
  metaLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  metaValue: { fontSize: 10, color: DARK, marginBottom: 2 },
  metaValueBold: { fontSize: 10, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 2 },
  // Status badge
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginTop: 6, alignSelf: "flex-start" },
  statusText: { fontSize: 8, fontFamily: "Helvetica-Bold", textTransform: "uppercase" },
  // Table
  table: { marginBottom: 24 },
  tableHeader: { flexDirection: "row", backgroundColor: DARK, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 4 },
  tableHeaderCell: { fontFamily: "Helvetica-Bold", fontSize: 9, color: "#ffffff", textTransform: "uppercase" },
  tableRow: { flexDirection: "row", paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 0.5, borderBottomColor: BORDER },
  tableRowAlt: { backgroundColor: LIGHT_BG },
  tableCell: { fontSize: 10, color: DARK },
  tableCellMuted: { fontSize: 10, color: MUTED },
  // Totals
  totalsContainer: { alignItems: "flex-end", marginBottom: 24 },
  totalsBox: { width: 220 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: MUTED },
  totalValue: { fontSize: 10, color: DARK },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderTopWidth: 2, borderTopColor: BRAND, marginTop: 4 },
  grandTotalLabel: { fontSize: 14, fontFamily: "Helvetica-Bold", color: DARK },
  grandTotalValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BRAND },
  // Notes
  notesBox: { backgroundColor: LIGHT_BG, borderRadius: 4, padding: 12, marginBottom: 24 },
  notesLabel: { fontSize: 8, fontFamily: "Helvetica-Bold", color: MUTED, textTransform: "uppercase", marginBottom: 4 },
  notesText: { fontSize: 9, color: DARK, lineHeight: 1.5 },
  // Footer
  footer: { position: "absolute", bottom: 30, left: 40, right: 40, borderTopWidth: 0.5, borderTopColor: BORDER, paddingTop: 10, flexDirection: "row", justifyContent: "space-between" },
  footerText: { fontSize: 8, color: MUTED },
  // Brand stripe
  stripe: { height: 4, backgroundColor: BRAND, marginBottom: 20, borderRadius: 2 },
});

interface InvoicePDFData {
  invoice: {
    number: string;
    customer: string;
    customerPhone: string | null;
    customerEmail: string | null;
    customerAddress: string | null;
    customerTin: string | null;
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
    address: string | null;
    phone: string | null;
    email: string | null;
    website: string | null;
    taxLabel: string;
    currency: string;
  };
}

function fmt(value: number, currency: string): string {
  // Use the canonical registry formatter so PDFs show proper symbols and
  // decimal rules (TSh 100 for TZS, € 99.99 for EUR, etc.) instead of the
  // raw ISO code prefix.
  return formatCurrencyValue(value, currency);
}

function statusColor(status: string) {
  switch (status) {
    case "paid": return { bg: "#d1fae5", text: "#065f46" };
    case "overdue": return { bg: "#fee2e2", text: "#991b1b" };
    case "cancelled": return { bg: "#f3f4f6", text: "#4b5563" };
    default: return { bg: "#dbeafe", text: "#1e40af" };
  }
}

function InvoiceDocument({ invoice, org }: InvoicePDFData) {
  const sc = statusColor(invoice.status);
  const cur = invoice.currency || org.currency || "USD";

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Brand stripe */}
        <View style={styles.stripe} />

        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.companyName}>{org.name}</Text>
            {org.address && <Text style={styles.companyDetail}>{org.address}</Text>}
            {org.phone && <Text style={styles.companyDetail}>{org.phone}</Text>}
            {org.email && <Text style={styles.companyDetail}>{org.email}</Text>}
            {org.website && <Text style={styles.companyDetail}>{org.website}</Text>}
          </View>
          <View>
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.number}</Text>
          </View>
        </View>

        {/* Meta: dates + bill to */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Issue Date</Text>
            <Text style={styles.metaValue}>{new Date(invoice.issuedAt).toLocaleDateString("en-GB")}</Text>
            {invoice.dueAt && (
              <>
                <Text style={[styles.metaLabel, { marginTop: 8 }]}>Due Date</Text>
                <Text style={styles.metaValue}>{new Date(invoice.dueAt).toLocaleDateString("en-GB")}</Text>
              </>
            )}
            <Text style={[styles.metaLabel, { marginTop: 8 }]}>Status</Text>
            <View style={[styles.statusBadge, { backgroundColor: sc.bg }]}>
              <Text style={[styles.statusText, { color: sc.text }]}>{invoice.status}</Text>
            </View>
          </View>
          <View style={styles.metaCol}>
            <Text style={styles.metaLabel}>Bill To</Text>
            <Text style={styles.metaValueBold}>{invoice.customer}</Text>
            {invoice.customerPhone && <Text style={styles.metaValue}>{invoice.customerPhone}</Text>}
            {invoice.customerEmail && <Text style={styles.metaValue}>{invoice.customerEmail}</Text>}
            {invoice.customerAddress && <Text style={styles.metaValue}>{invoice.customerAddress}</Text>}
          </View>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, { width: "45%" }]}>Item</Text>
            <Text style={[styles.tableHeaderCell, { width: "15%", textAlign: "right" }]}>Qty</Text>
            <Text style={[styles.tableHeaderCell, { width: "20%", textAlign: "right" }]}>Unit Price</Text>
            <Text style={[styles.tableHeaderCell, { width: "20%", textAlign: "right" }]}>Total</Text>
          </View>
          {invoice.items.map((item, i) => {
            const isSqm = item.sellingUnit === "sqm";
            const qtyLabel = isSqm ? `${item.area ?? item.quantity} m²` : String(item.quantity);
            return (
              <View key={i} style={[styles.tableRow, i % 2 === 0 ? styles.tableRowAlt : {}]}>
                <Text style={[styles.tableCell, { width: "45%" }]}>{item.name}</Text>
                <Text style={[styles.tableCellMuted, { width: "15%", textAlign: "right" }]}>{qtyLabel}</Text>
                <Text style={[styles.tableCellMuted, { width: "20%", textAlign: "right" }]}>{fmt(item.unitPrice, cur)}{isSqm ? "/m²" : ""}</Text>
                <Text style={[styles.tableCell, { width: "20%", textAlign: "right", fontFamily: "Helvetica-Bold" }]}>{fmt(item.total, cur)}</Text>
              </View>
            );
          })}
        </View>

        {/* Totals */}
        <View style={styles.totalsContainer}>
          <View style={styles.totalsBox}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal</Text>
              <Text style={styles.totalValue}>{fmt(invoice.subtotal, cur)}</Text>
            </View>
            {invoice.discount > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount</Text>
                <Text style={[styles.totalValue, { color: "#dc2626" }]}>-{fmt(invoice.discount, cur)}</Text>
              </View>
            )}
            {invoice.taxRate > 0 && (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{org.taxLabel} ({invoice.taxRate}%)</Text>
                <Text style={styles.totalValue}>{fmt(invoice.taxAmount, cur)}</Text>
              </View>
            )}
            <View style={styles.grandTotalRow}>
              <Text style={styles.grandTotalLabel}>TOTAL</Text>
              <Text style={styles.grandTotalValue}>{fmt(invoice.total, cur)}</Text>
            </View>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && (
          <View style={styles.notesBox}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text style={styles.notesText}>{invoice.notes}</Text>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>{org.name} — {invoice.number}</Text>
          <Text style={styles.footerText}>Generated by FLUX Business Platform</Text>
        </View>
      </Page>
    </Document>
  );
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<Blob> {
  // Ensure items is always an array (guards against undefined/null from API)
  const safeData: InvoicePDFData = {
    ...data,
    invoice: {
      ...data.invoice,
      items: data.invoice.items || [],
    },
  };

  const doc = <InvoiceDocument {...safeData} />;
  const blob = await pdf(doc).toBlob();

  if (!blob || blob.size === 0) {
    throw new Error("PDF generation produced an empty blob");
  }

  return blob;
}

export type { InvoicePDFData };
