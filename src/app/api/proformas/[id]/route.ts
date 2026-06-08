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

// ─── GET /api/proformas/[id] ─────────────────────────────────────────
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const proforma = await prisma.proforma.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        items: true,
        customerRecord: { select: { id: true, name: true, phone: true, email: true, address: true, tin: true } },
        invoice: { select: { id: true, number: true, status: true } },
      },
    });
    if (!proforma) return NextResponse.json({ error: "Proforma not found" }, { status: 404 });

    // Refresh status to expired if past validUntil and still pending — same
    // logic as the list route, kept local so direct fetches stay honest.
    if (
      proforma.validUntil < new Date() &&
      ["draft", "sent", "accepted"].includes(proforma.status)
    ) {
      const updated = await prisma.proforma.update({
        where: { id },
        data: { status: "expired" },
        include: {
          items: true,
          customerRecord: { select: { id: true, name: true, phone: true, email: true, address: true, tin: true } },
          invoice: { select: { id: true, number: true, status: true } },
        },
      });
      return NextResponse.json(updated);
    }

    return NextResponse.json(proforma);
  } catch (error) {
    console.error("GET /api/proformas/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── PUT /api/proformas/[id] ─────────────────────────────────────────
// Update a proforma. Once converted, the proforma is locked — only PDF
// re-render is allowed.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.proforma.findFirst({
      where: { id, orgId: auth.orgId },
      include: { items: true },
    });
    if (!existing) return NextResponse.json({ error: "Proforma not found" }, { status: 404 });
    if (existing.status === "converted") {
      return NextResponse.json(
        { error: "This proforma has been converted to a tax invoice and is locked. Create a new proforma if you need a revised quote." },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      customerId,
      customer,
      customerPhone,
      customerEmail,
      customerAddress,
      customerTin,
      items,
      taxRate,
      discount,
      currency,
      validUntil,
      notes,
      status,
    } = body;

    if (customer !== undefined && (typeof customer !== "string" || !customer.trim())) {
      return NextResponse.json({ error: "Customer name cannot be empty" }, { status: 400 });
    }
    if (taxRate !== undefined && (typeof taxRate !== "number" || !isFinite(taxRate) || taxRate < 0)) {
      return NextResponse.json({ error: "taxRate must be a non-negative finite number" }, { status: 400 });
    }
    if (discount !== undefined && (typeof discount !== "number" || !isFinite(discount) || discount < 0)) {
      return NextResponse.json({ error: "discount must be a non-negative finite number" }, { status: 400 });
    }

    // Status guard: only allow user-driven transitions; converted is set
    // exclusively by /convert; expired is set automatically.
    const allowedStatuses = ["draft", "sent", "accepted", "declined"];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return NextResponse.json({ error: `Invalid status. Allowed: ${allowedStatuses.join(", ")}` }, { status: 400 });
    }

    // If items provided, replace the entire item set (proformas are quotes
    // — a revision typically rewrites all lines). Compute totals server-side.
    let newSubtotal = existing.subtotal;
    let newTaxAmount = existing.taxAmount;
    let newTotal = existing.total;
    let newItems: { productId: string | null; name: string; quantity: number; unitPrice: number; total: number; sellingUnit: string; area: number | null }[] | null = null;
    if (items !== undefined) {
      if (!Array.isArray(items) || items.length === 0) {
        return NextResponse.json({ error: "items must be a non-empty array" }, { status: 400 });
      }
      for (const it of items) {
        if (!it?.name || typeof it.name !== "string" || !it.name.trim()) {
          return NextResponse.json({ error: "Each item must have a name" }, { status: 400 });
        }
        if (typeof it.quantity !== "number" || !isFinite(it.quantity) || it.quantity <= 0) {
          return NextResponse.json({ error: `Item "${it.name}" must have a positive quantity` }, { status: 400 });
        }
        if (typeof it.unitPrice !== "number" || !isFinite(it.unitPrice) || it.unitPrice < 0) {
          return NextResponse.json({ error: `Item "${it.name}" must have a non-negative unit price` }, { status: 400 });
        }
      }
      newItems = (items as Array<{ productId?: string; name: string; quantity: number; unitPrice: number; sellingUnit?: string; area?: number | null }>).map((it) => ({
        productId: it.productId || null,
        name: it.name.trim(),
        quantity: it.quantity,
        unitPrice: it.unitPrice,
        total: Math.round(it.quantity * it.unitPrice * 100) / 100,
        sellingUnit: it.sellingUnit || "unit",
        area: it.area ?? null,
      }));
      newSubtotal = Math.round(newItems.reduce((s: number, it) => s + it.total, 0) * 100) / 100;
    }

    const effectiveTaxRate = taxRate !== undefined ? taxRate : existing.taxRate;
    const effectiveDiscount = discount !== undefined ? discount : existing.discount;
    if (items !== undefined || taxRate !== undefined || discount !== undefined) {
      const taxBase = Math.max(0, newSubtotal - effectiveDiscount);
      newTaxAmount = Math.round(taxBase * (effectiveTaxRate / 100) * 100) / 100;
      newTotal = Math.round((taxBase + newTaxAmount) * 100) / 100;
    }

    const valid = validUntil !== undefined ? new Date(validUntil) : undefined;
    if (valid && isNaN(valid.getTime())) {
      return NextResponse.json({ error: "validUntil is not a valid date" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (newItems) {
        await tx.proformaItem.deleteMany({ where: { proformaId: id, proforma: { orgId: auth.orgId } } });
      }
      return tx.proforma.update({
        where: { id },
        data: {
          ...(customerId !== undefined && { customerId: customerId || null }),
          ...(customer !== undefined && { customer: customer.trim() }),
          ...(customerPhone !== undefined && { customerPhone: customerPhone?.trim() || null }),
          ...(customerEmail !== undefined && { customerEmail: customerEmail?.trim() || null }),
          ...(customerAddress !== undefined && { customerAddress: customerAddress?.trim() || null }),
          ...(customerTin !== undefined && { customerTin: customerTin?.trim() || null }),
          ...(currency !== undefined && { currency }),
          ...(taxRate !== undefined && { taxRate: effectiveTaxRate }),
          ...(discount !== undefined && { discount: effectiveDiscount }),
          ...(notes !== undefined && { notes: notes?.trim() || null }),
          ...(status !== undefined && { status }),
          ...(valid && { validUntil: valid }),
          ...(items !== undefined && {
            subtotal: newSubtotal,
            taxAmount: newTaxAmount,
            total: newTotal,
          }),
          ...(newItems && { items: { create: newItems } }),
        },
        include: { items: true },
      });
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "update",
      entity: "proforma",
      entityId: updated.id,
      details: `Updated proforma ${updated.number}${status ? ` — status: ${status}` : ""}`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PUT /api/proformas/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── DELETE /api/proformas/[id] ──────────────────────────────────────
// Allowed only when not converted (preserves the audit chain).
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    const existing = await prisma.proforma.findFirst({ where: { id, orgId: auth.orgId } });
    if (!existing) return NextResponse.json({ error: "Proforma not found" }, { status: 404 });
    if (existing.status === "converted") {
      return NextResponse.json(
        { error: "Cannot delete a converted proforma — it's linked to a tax invoice." },
        { status: 400 }
      );
    }

    await prisma.proforma.delete({ where: { id, orgId: auth.orgId } });
    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "delete",
      entity: "proforma",
      entityId: id,
      details: `Deleted proforma ${existing.number}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/proformas/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
