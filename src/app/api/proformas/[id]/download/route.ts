import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildProformaHTML } from "@/lib/proforma-template";

// Mirrors src/app/api/invoices/[id]/download/route.ts — server-side
// Puppeteer renders the HTML template to PDF; falls back to returning
// raw HTML if Chromium isn't available (e.g. in some sandboxed runtimes).
//
// Same auth, same error handling, same headers.

export const maxDuration = 30;

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

    const proforma = await prisma.proforma.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        org: true,
        items: true,
        invoice: { select: { number: true } },
      },
    });

    if (!proforma) {
      return NextResponse.json({ error: "Proforma not found" }, { status: 404 });
    }

    // Refresh expired status if validity has lapsed and status is still pending.
    let effectiveStatus = proforma.status;
    if (
      proforma.validUntil < new Date() &&
      ["draft", "sent", "accepted"].includes(proforma.status)
    ) {
      effectiveStatus = "expired";
      await prisma.proforma.update({ where: { id }, data: { status: "expired" } });
    }

    const data = {
      proforma: {
        number: proforma.number,
        customer: proforma.customer,
        customerPhone: proforma.customerPhone,
        customerEmail: proforma.customerEmail,
        customerAddress: proforma.customerAddress,
        // customerTin intentionally not passed to template — see proforma-template.ts
        subtotal: proforma.subtotal,
        taxRate: proforma.taxRate,
        taxAmount: proforma.taxAmount,
        discount: proforma.discount,
        total: proforma.total,
        currency: proforma.currency,
        proformaStatus: effectiveStatus as "draft" | "sent" | "accepted" | "converted" | "expired" | "declined",
        issuedAt: proforma.issuedAt.toISOString(),
        validUntil: proforma.validUntil.toISOString(),
        convertedToInvoiceNumber: proforma.invoice?.number ?? null,
        convertedAt: proforma.convertedAt?.toISOString() ?? null,
        notes: proforma.notes,
        items: proforma.items.map((it) => ({
          name: it.name,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.total,
          sellingUnit: it.sellingUnit,
          area: it.area,
        })),
      },
      org: {
        name: proforma.org.name,
        logo: proforma.org.logo,
        address: proforma.org.address,
        phone: proforma.org.phone,
        email: proforma.org.email,
        website: proforma.org.website,
        taxLabel: proforma.org.taxLabel,
        currency: proforma.org.currency,
      },
    };

    const html = buildProformaHTML(data);
    const safeFilename = proforma.number.replace(/[^a-zA-Z0-9_\-]/g, "_");

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
      await new Promise((r) => setTimeout(r, 1000));

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
    console.error("GET /api/proformas/[id]/download error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
