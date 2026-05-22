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

    const supplier = await prisma.supplier.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        purchaseOrders: {
          include: {
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("GET /api/suppliers/[id] error:", error);
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

    const existing = await prisma.supplier.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    const body = await request.json();
    const { name, country, city, contact, phone, email, address, paymentTerms, notes, status } = body;

    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "Supplier name cannot be empty" }, { status: 400 });
    }
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const supplier = await prisma.supplier.update({
      where: { id, orgId: auth.orgId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(country !== undefined && { country: country?.trim() || null }),
        ...(city !== undefined && { city: city?.trim() || null }),
        ...(contact !== undefined && { contact: contact?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(paymentTerms !== undefined && { paymentTerms: paymentTerms?.trim() || null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(status !== undefined && { status }),
      },
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "update",
      entity: "supplier",
      entityId: supplier.id,
      details: `Updated supplier: ${supplier.name}`,
    });

    return NextResponse.json(supplier);
  } catch (error) {
    console.error("PUT /api/suppliers/[id] error:", error);
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

    const existing = await prisma.supplier.findFirst({
      where: { id, orgId: auth.orgId },
      include: { _count: { select: { purchaseOrders: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    if (existing._count.purchaseOrders > 0) {
      return NextResponse.json(
        { error: "Cannot delete supplier with existing purchase orders. Deactivate instead." },
        { status: 400 }
      );
    }

    await prisma.supplier.delete({ where: { id, orgId: auth.orgId } });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "delete",
      entity: "supplier",
      entityId: id,
      details: `Deleted supplier: ${existing.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/suppliers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
