import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const sale = await prisma.sale.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        invoice: true,
        user: { select: { id: true, name: true, email: true } },
      },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    return NextResponse.json(sale);
  } catch (error) {
    console.error("GET /api/sales/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const sale = await prisma.sale.findFirst({
      where: { id, orgId: auth.orgId },
      include: { items: true },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Restore stock and delete sale in a transaction
    await prisma.$transaction(async (tx) => {
      // Restore stock for each item
      for (const item of sale.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stockQty: { increment: item.quantity },
          },
        });
      }

      // Delete linked invoice if exists
      if (sale.invoiceId) {
        await tx.invoice.delete({ where: { id: sale.invoiceId } });
      }

      // Delete sale (cascade deletes sale items)
      await tx.sale.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/sales/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
