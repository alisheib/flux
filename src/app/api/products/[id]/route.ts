import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { parseCurrencyEntry, formatEntryForAudit } from "@/lib/currency-entry";

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

    const product = await prisma.product.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        saleItems: {
          take: 10,
          orderBy: { sale: { createdAt: "desc" } },
          include: { sale: { select: { id: true, saleNumber: true, createdAt: true } } },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);
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

    const existing = await prisma.product.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      categoryId,
      sku,
      name,
      description,
      unit,
      thickness,
      width,
      height,
      color,
      sqmPerUnit,
      costPrice,
      sellingPrice,
      pricePerSqm,
      stockQty,
      minStockQty,
      active,
      // See POST route for shape. Optional foreign-currency audit metadata.
      costEntry,
      sellingEntry,
      pricePerSqmEntry,
    } = body;

    // Validate fields if provided
    if (name !== undefined && (!name || !name.trim())) {
      return NextResponse.json({ error: "Product name cannot be empty" }, { status: 400 });
    }
    if (costPrice !== undefined && costPrice !== null && (typeof costPrice !== "number" || costPrice < 0 || !isFinite(costPrice))) {
      return NextResponse.json({ error: "Cost price must be a non-negative finite number" }, { status: 400 });
    }
    if (sellingPrice !== undefined && sellingPrice !== null && (typeof sellingPrice !== "number" || sellingPrice < 0 || !isFinite(sellingPrice))) {
      return NextResponse.json({ error: "Selling price must be a non-negative finite number" }, { status: 400 });
    }
    if (pricePerSqm !== undefined && pricePerSqm !== null && (typeof pricePerSqm !== "number" || pricePerSqm < 0 || !isFinite(pricePerSqm))) {
      return NextResponse.json({ error: "Price per m² must be a non-negative finite number" }, { status: 400 });
    }
    if (stockQty !== undefined && stockQty !== null && (typeof stockQty !== "number" || stockQty < 0 || !isFinite(stockQty))) {
      return NextResponse.json({ error: "Stock quantity must be a non-negative finite number" }, { status: 400 });
    }
    if (minStockQty !== undefined && minStockQty !== null && (typeof minStockQty !== "number" || minStockQty < 0 || !isFinite(minStockQty))) {
      return NextResponse.json({ error: "Min stock quantity must be a non-negative finite number" }, { status: 400 });
    }

    // Parse the foreign-currency entry payloads. For PUT, undefined means
    // "don't touch the existing entry columns" so we only write to the row
    // when the client provided an entry key explicitly. An explicit null
    // clears the entry (the user collapsed the foreign-entry block).
    const wantsCostEntry = body.costEntry !== undefined;
    const wantsSellingEntry = body.sellingEntry !== undefined;
    const wantsSqmEntry = body.pricePerSqmEntry !== undefined;

    const costParsed = parseCurrencyEntry(costEntry, "Cost price");
    if (!costParsed.ok) return NextResponse.json({ error: costParsed.error }, { status: 400 });
    const sellingParsed = parseCurrencyEntry(sellingEntry, "Selling price");
    if (!sellingParsed.ok) return NextResponse.json({ error: sellingParsed.error }, { status: 400 });
    const sqmParsed = parseCurrencyEntry(pricePerSqmEntry, "Price per m²");
    if (!sqmParsed.ok) return NextResponse.json({ error: sqmParsed.error }, { status: 400 });

    const product = await prisma.product.update({
      where: { id, orgId: auth.orgId },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(sku !== undefined && { sku }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(unit !== undefined && { unit }),
        ...(thickness !== undefined && { thickness }),
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(color !== undefined && { color }),
        ...(sqmPerUnit !== undefined && { sqmPerUnit }),
        ...(costPrice !== undefined && { costPrice }),
        ...(sellingPrice !== undefined && { sellingPrice }),
        ...(pricePerSqm !== undefined && { pricePerSqm }),
        ...(stockQty !== undefined && { stockQty }),
        ...(minStockQty !== undefined && { minStockQty }),
        ...(active !== undefined && { active }),
        ...(wantsCostEntry && {
          costEntryCurrency: costParsed.columns.entryCurrency,
          costEntryAmount: costParsed.columns.entryAmount,
          costEntryRate: costParsed.columns.entryRate,
        }),
        ...(wantsSellingEntry && {
          sellingEntryCurrency: sellingParsed.columns.entryCurrency,
          sellingEntryAmount: sellingParsed.columns.entryAmount,
          sellingEntryRate: sellingParsed.columns.entryRate,
        }),
        ...(wantsSqmEntry && {
          pricePerSqmEntryCurrency: sqmParsed.columns.entryCurrency,
          pricePerSqmEntryAmount: sqmParsed.columns.entryAmount,
          pricePerSqmEntryRate: sqmParsed.columns.entryRate,
        }),
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    });

    const auditParts: string[] = [`Updated product: ${product.name}`];
    if (wantsCostEntry) {
      const a = formatEntryForAudit("Cost price", costParsed.columns);
      if (a) auditParts.push(a);
      else if (costEntry === null) auditParts.push("Cost price reverted to direct org-currency entry");
    }
    if (wantsSellingEntry) {
      const a = formatEntryForAudit("Selling price", sellingParsed.columns);
      if (a) auditParts.push(a);
      else if (sellingEntry === null) auditParts.push("Selling price reverted to direct org-currency entry");
    }
    if (wantsSqmEntry) {
      const a = formatEntryForAudit("Price per m²", sqmParsed.columns);
      if (a) auditParts.push(a);
      else if (pricePerSqmEntry === null) auditParts.push("Price per m² reverted to direct org-currency entry");
    }

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "update", entity: "product", entityId: product.id, details: auditParts.join(" | ") });

    return NextResponse.json(product);
  } catch (error) {
    console.error("PUT /api/products/[id] error:", error);
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

    const existing = await prisma.product.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if product has sale items
    const saleItemCount = await prisma.saleItem.count({
      where: { productId: id },
    });
    if (saleItemCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete product with existing sales. Deactivate it instead." },
        { status: 400 }
      );
    }

    await prisma.product.delete({ where: { id, orgId: auth.orgId } });

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "delete", entity: "product", entityId: id, details: `Deleted product: ${existing.name}` });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
