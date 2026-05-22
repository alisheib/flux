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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const po = await prisma.purchaseOrder.findFirst({
      where: { id, orgId: auth.orgId },
      include: { items: true, supplier: { select: { name: true } } },
    });

    if (!po) {
      return NextResponse.json({ error: "Purchase order not found" }, { status: 404 });
    }

    if (po.status === "received" || po.status === "cancelled") {
      return NextResponse.json(
        { error: `Cannot receive goods for a ${po.status} PO` },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { items: receivedItems } = body;

    if (!receivedItems || !Array.isArray(receivedItems)) {
      return NextResponse.json(
        { error: "Received items data is required" },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      let allFullyReceived = true;
      let anyReceived = false;

      for (const received of receivedItems) {
        const { itemId, quantityReceived } = received;
        if (!itemId || quantityReceived === undefined || quantityReceived < 0) continue;

        const poItem = po.items.find((i) => i.id === itemId);
        if (!poItem) continue;

        const newQtyReceived = poItem.quantityReceived + quantityReceived;
        if (newQtyReceived > poItem.quantityOrdered) {
          throw new Error(
            `Cannot receive more than ordered for "${poItem.name}" (ordered: ${poItem.quantityOrdered}, already received: ${poItem.quantityReceived}, trying to add: ${quantityReceived})`
          );
        }

        if (quantityReceived > 0) {
          anyReceived = true;

          await tx.purchaseOrderItem.update({
            where: { id: itemId },
            data: { quantityReceived: newQtyReceived },
          });

          if (poItem.productId) {
            await recordStockMovement(tx, {
              orgId: auth.orgId,
              productId: poItem.productId,
              userId: auth.userId,
              type: "po_received",
              quantity: quantityReceived,
              reference: po.poNumber,
              notes: `Received from PO ${po.poNumber} (${po.supplier.name})`,
            });
          }
        }

        if (newQtyReceived < poItem.quantityOrdered) {
          allFullyReceived = false;
        }
      }

      for (const poItem of po.items) {
        const inReceivedList = receivedItems.some(
          (r: { itemId: string }) => r.itemId === poItem.id
        );
        if (!inReceivedList && poItem.quantityReceived < poItem.quantityOrdered) {
          allFullyReceived = false;
        }
      }

      let newStatus = po.status;
      if (anyReceived) {
        newStatus = allFullyReceived ? "received" : "partial";
      }

      const updatedPO = await tx.purchaseOrder.update({
        where: { id, orgId: auth.orgId },
        data: {
          status: newStatus,
          ...(newStatus === "received" && { receivedAt: new Date() }),
        },
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
      });

      return updatedPO;
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "update",
      entity: "purchase_order",
      entityId: po.id,
      details: `Received goods for PO ${po.poNumber} - new status: ${result.status}`,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/purchase-orders/[id]/receive error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
