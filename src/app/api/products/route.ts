import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { logAudit } from "@/lib/audit";
import { parseCurrencyEntry, formatEntryForAudit } from "@/lib/currency-entry";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const pagination = parsePagination(request);
    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    const where: Record<string, unknown> = { orgId: auth.orgId };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: {
          category: { select: { id: true, name: true, icon: true, color: true } },
        },
        orderBy: { name: "asc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json(paginatedResponse(products, total, pagination));
  } catch (error) {
    console.error("GET /api/products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      // Optional foreign-currency audit metadata. When the user typed a price
      // in a non-org currency, the client posts the original amount + currency
      // + rate so the audit log can reconstruct what was entered. The price
      // columns store the converted org-currency value; this lives only in
      // AuditLog.details (no schema change required).
      costEntry,
      sellingEntry,
      pricePerSqmEntry,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
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

    // Parse the optional foreign-currency entry payloads. Each parse returns
    // {entryCurrency, entryAmount, entryRate} columns, all NULL if the user
    // didn't use the foreign-entry block. Partial entries (e.g. currency
    // without rate) are rejected here as a server-side defense.
    const costParsed = parseCurrencyEntry(costEntry, "Cost price");
    if (!costParsed.ok) return NextResponse.json({ error: costParsed.error }, { status: 400 });
    const sellingParsed = parseCurrencyEntry(sellingEntry, "Selling price");
    if (!sellingParsed.ok) return NextResponse.json({ error: sellingParsed.error }, { status: 400 });
    const sqmParsed = parseCurrencyEntry(pricePerSqmEntry, "Price per m²");
    if (!sqmParsed.ok) return NextResponse.json({ error: sqmParsed.error }, { status: 400 });

    const product = await prisma.product.create({
      data: {
        orgId: auth.orgId,
        categoryId: categoryId || null,
        sku: sku?.trim() || null,
        name: name.trim(),
        description: description?.trim() || null,
        unit: unit || "piece",
        thickness: thickness || null,
        width: width || null,
        height: height || null,
        color: color?.trim() || null,
        sqmPerUnit: sqmPerUnit != null ? Number(sqmPerUnit) : null,
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        pricePerSqm: pricePerSqm != null ? Number(pricePerSqm) : null,
        stockQty: Number(stockQty) || 0,
        minStockQty: Number(minStockQty) || 0,
        active: active !== undefined ? active : true,
        costEntryCurrency: costParsed.columns.entryCurrency,
        costEntryAmount: costParsed.columns.entryAmount,
        costEntryRate: costParsed.columns.entryRate,
        sellingEntryCurrency: sellingParsed.columns.entryCurrency,
        sellingEntryAmount: sellingParsed.columns.entryAmount,
        sellingEntryRate: sellingParsed.columns.entryRate,
        pricePerSqmEntryCurrency: sqmParsed.columns.entryCurrency,
        pricePerSqmEntryAmount: sqmParsed.columns.entryAmount,
        pricePerSqmEntryRate: sqmParsed.columns.entryRate,
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    });

    // Compose audit detail. With the entry columns now persisted on the row,
    // this is belt-and-braces — but it gives an at-a-glance trail in the
    // activity log without needing to query the entry columns.
    const auditParts: string[] = [`Created product: ${product.name}`];
    const costAudit = formatEntryForAudit("Cost price", costParsed.columns);
    if (costAudit) auditParts.push(costAudit);
    const sellingAudit = formatEntryForAudit("Selling price", sellingParsed.columns);
    if (sellingAudit) auditParts.push(sellingAudit);
    const sqmAudit = formatEntryForAudit("Price per m²", sqmParsed.columns);
    if (sqmAudit) auditParts.push(sqmAudit);

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "create", entity: "product", entityId: product.id, details: auditParts.join(" | ") });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
