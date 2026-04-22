import { prisma } from "@/lib/db";

interface StockMovementParams {
  orgId: string;
  productId: string;
  userId?: string;
  type: "sale" | "refund" | "adjustment" | "shipment_received" | "manual";
  quantity: number; // positive = stock in, negative = stock out
  reference?: string;
  notes?: string;
}

/**
 * Record a stock movement and update product stock atomically.
 * Must be called within a Prisma transaction (tx).
 */
export async function recordStockMovement(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  params: StockMovementParams
) {
  // Update product stock
  const product = await tx.product.update({
    where: { id: params.productId },
    data: { stockQty: { increment: params.quantity } },
    select: { stockQty: true },
  });

  // Record the movement
  await tx.stockMovement.create({
    data: {
      orgId: params.orgId,
      productId: params.productId,
      userId: params.userId || null,
      type: params.type,
      quantity: params.quantity,
      balance: product.stockQty,
      reference: params.reference || null,
      notes: params.notes || null,
    },
  });

  return product.stockQty;
}
