import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { recordStockMovement } from "@/lib/stock";
import { logAudit } from "@/lib/audit";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(auth.role, "admin")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { productId, quantity, notes } = body;

    if (!productId || typeof quantity !== "number" || quantity === 0) {
      return NextResponse.json(
        { error: "productId and a non-zero quantity are required" },
        { status: 400 }
      );
    }

    // Validate product exists and belongs to org
    const product = await prisma.product.findFirst({
      where: { id: productId, orgId: auth.orgId },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Perform adjustment in a transaction
    const newBalance = await prisma.$transaction(async (tx) => {
      return await recordStockMovement(tx, {
        orgId: auth.orgId,
        productId,
        userId: auth.userId,
        type: "manual",
        quantity,
        notes: notes || undefined,
      });
    });

    // Fetch updated product
    const updatedProduct = await prisma.product.findUnique({
      where: { id: productId },
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "update",
      entity: "product",
      entityId: productId,
      details: `Manual stock adjustment: ${quantity > 0 ? "+" : ""}${quantity}. New balance: ${newBalance}${notes ? `. Notes: ${notes}` : ""}`,
    });

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error("POST /api/stock-movements/adjust error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
