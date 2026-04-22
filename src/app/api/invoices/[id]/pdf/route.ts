import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    // Return invoice data as JSON — the client will render the PDF
    return NextResponse.json({
      invoice: {
        number: invoice.number,
        customer: invoice.customer,
        customerPhone: invoice.customerPhone,
        customerEmail: invoice.customerEmail,
        customerAddress: invoice.customerAddress,
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
        })) || [],
      },
      org: {
        name: invoice.org.name,
        logo: invoice.org.logo,
        address: invoice.org.address,
        phone: invoice.org.phone,
        email: invoice.org.email,
        website: invoice.org.website,
        taxRate: invoice.org.taxRate,
        taxLabel: invoice.org.taxLabel,
        currency: invoice.org.currency,
      },
    });
  } catch (error) {
    console.error("GET /api/invoices/[id]/pdf error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
