import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { logAudit } from "@/lib/audit";
import { parseCurrencyEntry } from "@/lib/currency-entry";

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
    const where = { orgId: auth.orgId };

    const [total, purchaseOrders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true, sku: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json(paginatedResponse(purchaseOrders, total, pagination));
  } catch (error) {
    console.error("GET /api/purchase-orders error:", error);
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
    const { supplierId, items, expectedAt, notes, currency } = body;

    // ── Validate the entire payload BEFORE any DB calls ──
    // This gives us 400 for malformed input even if the DB is unreachable,
    // and means we never spend a supplier-lookup roundtrip on a doomed request.
    if (!supplierId) {
      return NextResponse.json({ error: "Supplier is required" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    const itemEntries: Array<{ entryCurrency: string | null; entryAmount: number | null; entryRate: number | null }> = [];
    for (const item of items) {
      if (!item.name?.trim()) {
        return NextResponse.json({ error: "Each item must have a name" }, { status: 400 });
      }
      if (typeof item.quantityOrdered !== "number" || !isFinite(item.quantityOrdered) || item.quantityOrdered <= 0) {
        return NextResponse.json({ error: `Item "${item.name}" must have a positive finite quantity` }, { status: 400 });
      }
      if (typeof item.unitCost !== "number" || !isFinite(item.unitCost) || item.unitCost < 0) {
        return NextResponse.json({ error: `Item "${item.name}" must have a non-negative finite unit cost` }, { status: 400 });
      }
      const parsed = parseCurrencyEntry(item.unitCostEntry, `Item "${item.name}" unit cost`);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      itemEntries.push(parsed.columns);
    }

    const supplier = await prisma.supplier.findFirst({
      where: { id: supplierId, orgId: auth.orgId },
    });
    if (!supplier) {
      return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
    }

    // Generate PO number
    const poCount = await prisma.purchaseOrder.count({
      where: { orgId: auth.orgId },
    });
    const poNumber = `PO-${String(poCount + 1).padStart(4, "0")}`;

    const subtotal = items.reduce(
      (sum: number, item: { quantityOrdered: number; unitCost: number }) =>
        sum + item.quantityOrdered * item.unitCost,
      0
    );

    const po = await prisma.purchaseOrder.create({
      data: {
        orgId: auth.orgId,
        supplierId,
        poNumber,
        status: "draft",
        expectedAt: expectedAt ? new Date(expectedAt) : null,
        notes: notes?.trim() || null,
        currency: currency || "USD",
        subtotal,
        total: subtotal,
        items: {
          create: items.map(
            (item: {
              productId?: string;
              name: string;
              unit?: string;
              quantityOrdered: number;
              unitCost: number;
              notes?: string;
            }, idx: number) => ({
              productId: item.productId || null,
              name: item.name,
              unit: item.unit || "piece",
              quantityOrdered: item.quantityOrdered,
              quantityReceived: 0,
              unitCost: item.unitCost,
              totalCost: item.quantityOrdered * item.unitCost,
              notes: item.notes?.trim() || null,
              entryCurrency: itemEntries[idx].entryCurrency,
              entryAmount: itemEntries[idx].entryAmount,
              entryRate: itemEntries[idx].entryRate,
            })
          ),
        },
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

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "create",
      entity: "purchase_order",
      entityId: po.id,
      details: `Created PO ${po.poNumber} for ${supplier.name} (${items.length} items, total: ${subtotal})`,
    });

    return NextResponse.json(po, { status: 201 });
  } catch (error) {
    console.error("POST /api/purchase-orders error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
