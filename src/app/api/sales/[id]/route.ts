import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { recordStockMovement } from "@/lib/stock";

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
      // Fetch products to check sqmPerUnit for area-sold items
      const productIds = sale.items.map((i) => i.productId);
      const saleProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, sqmPerUnit: true },
      });
      const saleProductMap = new Map(saleProducts.map((p) => [p.id, p]));

      // Restore stock for each item (with stock movement tracking)
      for (const item of sale.items) {
        let restoreQty: number;
        let movementNotes: string;

        if (item.sellingUnit === "sqm") {
          // Convert area back to sheet-equivalent
          const product = saleProductMap.get(item.productId);
          const sqmPerUnit = product?.sqmPerUnit || 0;
          const area = item.area ?? item.quantity;
          restoreQty = sqmPerUnit > 0
            ? Math.round((area / sqmPerUnit) * 10000) / 10000
            : item.quantity;
          movementNotes = `Stock restored ${area} m² (${restoreQty} sheet equiv.) from deleted sale ${sale.saleNumber}`;
        } else {
          restoreQty = item.quantity;
          movementNotes = `Stock restored from deleted sale ${sale.saleNumber}`;
        }

        await recordStockMovement(tx, {
          orgId: auth.orgId,
          productId: item.productId,
          userId: auth.userId,
          type: "refund",
          quantity: +restoreQty,
          reference: sale.saleNumber,
          notes: movementNotes,
        });
      }

      // Delete linked invoice if exists
      if (sale.invoiceId) {
        await tx.invoice.delete({ where: { id: sale.invoiceId } });
      }

      // Delete sale (cascade deletes sale items)
      await tx.sale.delete({ where: { id } });
    });

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "delete", entity: "sale", entityId: id, details: `Deleted sale: ${sale.saleNumber}` });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/sales/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
