import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildReceiptHTML } from "@/lib/receipt-template";

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

    const sale = await prisma.sale.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        org: true,
        items: true,
        user: { select: { name: true } },
        invoice: { select: { id: true, number: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    const data = {
      receipt: {
        number: sale.invoice?.number || sale.saleNumber,
        customer: sale.customer,
        customerPhone: sale.customerPhone,
        subtotal: sale.subtotal,
        taxRate: sale.taxRate,
        taxLabel: sale.org.taxLabel || "VAT",
        taxAmount: sale.taxAmount,
        discount: sale.discount,
        total: sale.total,
        currency: sale.currency || sale.org.currency || "USD",
        paymentMethod: sale.paymentMethod,
        items: sale.items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        createdAt: sale.createdAt.toISOString(),
        salesperson: sale.user?.name || "Staff",
      },
      org: {
        name: sale.org.name,
        logo: sale.org.logo,
        address: sale.org.address,
        phone: sale.org.phone,
        email: sale.org.email,
        website: sale.org.website,
      },
    };

    const html = buildReceiptHTML(data);

    // Try server-side PDF
    try {
      const chromium = await import("@sparticuz/chromium");
      const puppeteer = await import("puppeteer-core");

      const browser = await puppeteer.default.launch({
        args: chromium.default.args,
        executablePath: await chromium.default.executablePath(),
        headless: true,
        defaultViewport: { width: 420, height: 600 },
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "networkidle0" });

      const pdfBuffer = await page.pdf({
        width: "148mm",
        height: "210mm",
        printBackground: true,
        displayHeaderFooter: false,
        margin: { top: "0", bottom: "0", left: "0", right: "0" },
      });

      await browser.close();

      return new NextResponse(Buffer.from(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="receipt-${sale.invoice?.number || sale.saleNumber}.pdf"`,
          "Cache-Control": "no-store",
        },
      });
    } catch {
      // Fallback: return HTML
      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "X-PDF-Fallback": "html",
        },
      });
    }
  } catch (error) {
    console.error("GET /api/sales/[id]/receipt error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
