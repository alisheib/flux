import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseCurrencyEntry } from "@/lib/currency-entry";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, itemId } = await params;

    // Verify shipment belongs to org
    const shipment = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const existing = await prisma.shipmentItem.findFirst({
      where: { id: itemId, shipmentId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    const body = await request.json();
    const { productId, name, thickness, width, height, color, unit, quantity, unitCost, notes, unitCostEntry } = body;

    if (quantity !== undefined && (typeof quantity !== "number" || quantity <= 0 || !isFinite(quantity))) {
      return NextResponse.json({ error: "Quantity must be a positive finite number" }, { status: 400 });
    }
    if (unitCost !== undefined && (typeof unitCost !== "number" || unitCost < 0 || !isFinite(unitCost))) {
      return NextResponse.json({ error: "Unit cost must be a non-negative finite number" }, { status: 400 });
    }
    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: "Item name cannot be empty" }, { status: 400 });
    }

    // Foreign-currency entry: only touch columns when the client explicitly
    // provided the key. See products PUT route for the same pattern.
    const wantsEntry = body.unitCostEntry !== undefined;
    const parsed = parseCurrencyEntry(unitCostEntry, "Unit cost");
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

    // Auto-calculate totalCost if quantity or unitCost changed
    const newQty = quantity !== undefined ? quantity : existing.quantity;
    const newUnitCost = unitCost !== undefined ? unitCost : existing.unitCost;
    const totalCost = Math.round(newQty * newUnitCost * 100) / 100;

    const item = await prisma.shipmentItem.update({
      where: { id: itemId },
      data: {
        ...(productId !== undefined && { productId }),
        ...(name !== undefined && { name }),
        ...(thickness !== undefined && { thickness }),
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(color !== undefined && { color }),
        ...(unit !== undefined && { unit }),
        ...(quantity !== undefined && { quantity }),
        ...(unitCost !== undefined && { unitCost }),
        totalCost,
        ...(notes !== undefined && { notes }),
        ...(wantsEntry && {
          entryCurrency: parsed.columns.entryCurrency,
          entryAmount: parsed.columns.entryAmount,
          entryRate: parsed.columns.entryRate,
        }),
      },
      include: { product: { select: { id: true, name: true, sku: true } } },
    });

    return NextResponse.json(item);
  } catch (error) {
    console.error("PUT /api/shipments/[id]/items/[itemId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, itemId } = await params;

    const shipment = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const existing = await prisma.shipmentItem.findFirst({
      where: { id: itemId, shipmentId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    await prisma.shipmentItem.delete({ where: { id: itemId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/shipments/[id]/items/[itemId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
