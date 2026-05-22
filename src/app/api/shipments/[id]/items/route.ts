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

    const shipment = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const items = await prisma.shipmentItem.findMany({
      where: { shipmentId: id },
      include: { product: { select: { id: true, name: true, sku: true } } },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(items);
  } catch (error) {
    console.error("GET /api/shipments/[id]/items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
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

    const shipment = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      productId,
      name,
      thickness,
      width,
      height,
      color,
      unit,
      quantity,
      unitCost,
      notes,
    } = body;

    if (!name || quantity === undefined || unitCost === undefined) {
      return NextResponse.json(
        { error: "name, quantity, and unitCost are required" },
        { status: 400 }
      );
    }

    if (typeof quantity !== "number" || quantity <= 0 || !isFinite(quantity)) {
      return NextResponse.json(
        { error: "Quantity must be a positive finite number" },
        { status: 400 }
      );
    }

    if (typeof unitCost !== "number" || unitCost < 0 || !isFinite(unitCost)) {
      return NextResponse.json(
        { error: "Unit cost must be a non-negative finite number" },
        { status: 400 }
      );
    }

    const totalCost = Math.round(quantity * unitCost * 100) / 100;

    const item = await prisma.shipmentItem.create({
      data: {
        shipmentId: id,
        productId: productId || null,
        name,
        thickness: thickness || null,
        width: width || null,
        height: height || null,
        color: color || null,
        unit: unit || "sheet",
        quantity,
        unitCost,
        totalCost,
        notes: notes || null,
      },
      include: { product: { select: { id: true, name: true, sku: true } } },
    });

    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    console.error("POST /api/shipments/[id]/items error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
