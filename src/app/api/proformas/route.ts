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

// ─── GET /api/proformas ──────────────────────────────────────────────
// List proformas for the current org.
// Side effect: auto-marks "sent" proformas as "expired" once validUntil
// has passed. This keeps the list view honest without a cron — every
// listing pass refreshes statuses.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const now = new Date();
    await prisma.proforma.updateMany({
      where: {
        orgId: auth.orgId,
        status: { in: ["draft", "sent", "accepted"] },
        validUntil: { lt: now },
      },
      data: { status: "expired" },
    });

    const pagination = parsePagination(request);
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const customerId = searchParams.get("customerId");

    const where: Record<string, unknown> = { orgId: auth.orgId };
    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    const [total, proformas] = await Promise.all([
      prisma.proforma.count({ where }),
      prisma.proforma.findMany({
        where,
        include: {
          items: true,
          customerRecord: { select: { id: true, name: true } },
          invoice: { select: { id: true, number: true } },
        },
        orderBy: { issuedAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json(paginatedResponse(proformas, total, pagination));
  } catch (error) {
    console.error("GET /api/proformas error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ─── POST /api/proformas ─────────────────────────────────────────────
// Create a new proforma. Body shape mirrors a sale's payload but with no
// stock side-effect — proformas are quotes, not transactions.
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      amountEntry, // optional foreign-currency entry for total
    } = body;

    // Validate BEFORE any DB work so malformed bodies are rejected at 400.
    if (!customer || typeof customer !== "string" || !customer.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
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
    if (taxRate !== undefined && (typeof taxRate !== "number" || !isFinite(taxRate) || taxRate < 0)) {
      return NextResponse.json({ error: "taxRate must be a non-negative finite number" }, { status: 400 });
    }
    if (discount !== undefined && (typeof discount !== "number" || !isFinite(discount) || discount < 0)) {
      return NextResponse.json({ error: "discount must be a non-negative finite number" }, { status: 400 });
    }

    const validStatuses = ["draft", "sent"];
    const initialStatus = status && validStatuses.includes(status) ? status : "draft";

    const parsedEntry = parseCurrencyEntry(amountEntry, "Proforma total");
    if (!parsedEntry.ok) return NextResponse.json({ error: parsedEntry.error }, { status: 400 });

    // Validate validUntil BEFORE any DB work so a malformed date doesn't
    // leak through to a 500 on the org lookup.
    if (validUntil !== undefined) {
      const v = new Date(validUntil);
      if (isNaN(v.getTime())) {
        return NextResponse.json({ error: "validUntil is not a valid date" }, { status: 400 });
      }
    }

    // Look up org settings for currency, prefix, and validity window.
    const [org, settings] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: auth.orgId },
        select: { currency: true },
      }),
      prisma.orgSettings.findUnique({
        where: { orgId: auth.orgId },
        select: { proformaPrefix: true, proformaNextNum: true, proformaValidityDays: true },
      }),
    ]);
    if (!org) return NextResponse.json({ error: "Organization not found" }, { status: 404 });

    const proformaCurrency = currency || org.currency;
    const prefix = settings?.proformaPrefix ?? "PRO";
    const nextNum = settings?.proformaNextNum ?? 1;
    const validityDays = settings?.proformaValidityDays ?? 14;

    // Compute totals server-side so the client can't lie about them.
    const subtotal = items.reduce((s: number, it: { quantity: number; unitPrice: number }) => s + it.quantity * it.unitPrice, 0);
    const safeDiscount = typeof discount === "number" ? discount : 0;
    const safeTaxRate = typeof taxRate === "number" ? taxRate : 0;
    const taxBase = Math.max(0, subtotal - safeDiscount);
    const taxAmount = Math.round(taxBase * (safeTaxRate / 100) * 100) / 100;
    const total = Math.round((taxBase + taxAmount) * 100) / 100;

    const valid = validUntil
      ? new Date(validUntil)
      : new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000);
    if (isNaN(valid.getTime())) {
      return NextResponse.json({ error: "validUntil is not a valid date" }, { status: 400 });
    }

    // Atomic create + counter increment.
    const proforma = await prisma.$transaction(async (tx) => {
      const number = `${prefix}-${String(nextNum).padStart(4, "0")}`;
      const created = await tx.proforma.create({
        data: {
          orgId: auth.orgId,
          customerId: customerId || null,
          number,
          customer: customer.trim(),
          customerPhone: customerPhone?.trim() || null,
          customerEmail: customerEmail?.trim() || null,
          customerAddress: customerAddress?.trim() || null,
          customerTin: customerTin?.trim() || null,
          subtotal: Math.round(subtotal * 100) / 100,
          taxRate: safeTaxRate,
          taxAmount,
          discount: safeDiscount,
          total,
          currency: proformaCurrency,
          status: initialStatus,
          validUntil: valid,
          notes: notes?.trim() || null,
          entryCurrency: parsedEntry.columns.entryCurrency,
          entryRate: parsedEntry.columns.entryRate,
          items: {
            create: items.map((it: { productId?: string; name: string; quantity: number; unitPrice: number; sellingUnit?: string; area?: number | null }) => ({
              productId: it.productId || null,
              name: it.name.trim(),
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: Math.round(it.quantity * it.unitPrice * 100) / 100,
              sellingUnit: it.sellingUnit || "unit",
              area: it.area ?? null,
            })),
          },
        },
        include: { items: true },
      });

      // Increment the counter for the next proforma.
      await tx.orgSettings.update({
        where: { orgId: auth.orgId },
        data: { proformaNextNum: nextNum + 1 },
      });

      return created;
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "create",
      entity: "proforma",
      entityId: proforma.id,
      details: `Created proforma ${proforma.number} for ${proforma.customer} — total ${total} ${proformaCurrency}, valid until ${valid.toISOString().slice(0, 10)}`,
    });

    return NextResponse.json(proforma, { status: 201 });
  } catch (error) {
    console.error("POST /api/proformas error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
