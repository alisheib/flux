import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildInvoiceHTML } from "@/lib/invoice-template";

export const maxDuration = 30; // Allow up to 30 seconds for PDF generation

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("flux-token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const auth = await verifyToken(token);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const invoice = await prisma.invoice.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        org: true,
        sale: { include: { items: true } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    const data = {
      invoice: {
        number: invoice.number,
        customer: invoice.customer,
        customerPhone: invoice.customerPhone,
        customerEmail: invoice.customerEmail,
        customerAddress: invoice.customerAddress,
        customerTin: invoice.customerTin,
        subtotal: invoice.subtotal,
        taxRate: invoice.taxRate,
        taxAmount: invoice.taxAmount,
        discount: invoice.discount,
        total: invoice.total,
        currency: invoice.currency,
        status: invoice.status,
        issuedAt: invoice.issuedAt.toISOString(),
        dueAt: invoice.dueAt?.toISOString() || null,
        paidAt: invoice.paidAt?.toISOString() || null,
        notes: invoice.notes,
        items: invoice.sale?.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
          sellingUnit: item.sellingUnit,
          area: item.area,
        })) || [],
      },
      org: {
        name: invoice.org.name,
        logo: invoice.org.logo,
        address: invoice.org.address,
        phone: invoice.org.phone,
        email: invoice.org.email,
        website: invoice.org.website,
        taxLabel: invoice.org.taxLabel,
        currency: invoice.org.currency,
      },
    };

    const html = buildInvoiceHTML(data);
    const safeFilename = invoice.number.replace(/[^a-zA-Z0-9_\-]/g, "_");

    // Try server-side Puppeteer PDF generation
    try {
      const chromium = await import("@sparticuz/chromium");
      const puppeteer = await import("puppeteer-core");

      const execPath = await chromium.default.executablePath();
      if (!execPath) throw new Error("Chromium binary not found");

      const browser = await puppeteer.default.launch({
        args: [...chromium.default.args, "--no-sandbox", "--disable-gpu"],
        executablePath: execPath,
        headless: true,
        defaultViewport: { width: 794, height: 1123 },
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 10000 });
      await new Promise((r) => setTimeout(r, 1000)); // Let fonts load

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      });

      await browser.close();

      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${safeFilename}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } catch (puppeteerError) {
      // Fallback: return HTML as downloadable file
      console.error("Server-side PDF failed:", puppeteerError);
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `attachment; filename="${safeFilename}.html"`,
          "Cache-Control": "no-store",
        },
      });
    }
  } catch (error) {
    console.error("GET /api/invoices/[id]/download error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
