import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

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
      include: {
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        expenses: true,
      },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    return NextResponse.json(shipment);
  } catch (error) {
    console.error("GET /api/shipments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      name,
      dossierNumber,
      invoiceNumber,
      containerNumber,
      containerType,
      containerCount,
      supplier,
      origin,
      exchangeRate,
      status,
      notes,
    } = body;

    // Validate status if provided
    const VALID_STATUSES = ["clearing", "in_transit", "in_warehouse", "completed"];
    if (status !== undefined && !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Allowed: ${VALID_STATUSES.join(", ")}` },
        { status: 400 }
      );
    }

    const shipment = await prisma.shipment.update({
      where: { id, orgId: auth.orgId },
      data: {
        ...(name !== undefined && { name }),
        ...(dossierNumber !== undefined && { dossierNumber }),
        ...(invoiceNumber !== undefined && { invoiceNumber }),
        ...(containerNumber !== undefined && { containerNumber }),
        ...(containerType !== undefined && { containerType }),
        ...(containerCount !== undefined && { containerCount }),
        ...(supplier !== undefined && { supplier }),
        ...(origin !== undefined && { origin }),
        ...(exchangeRate !== undefined && { exchangeRate }),
        ...(status !== undefined && { status }),
        ...(notes !== undefined && { notes }),
      },
      include: {
        items: true,
        expenses: true,
      },
    });

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "update", entity: "shipment", entityId: shipment.id, details: `Updated shipment: ${shipment.name}` });

    return NextResponse.json(shipment);
  } catch (error) {
    console.error("PUT /api/shipments/[id] error:", error);
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

    const existing = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    await prisma.shipment.delete({ where: { id, orgId: auth.orgId } });

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "delete", entity: "shipment", entityId: id, details: `Deleted shipment: ${existing.name}` });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/shipments/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
