import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { recordStockMovement } from "@/lib/stock";
import { checkSubscriptionLimit } from "@/lib/subscription-check";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// POST /api/proformas/[id]/convert
// Converts a proforma into a real tax Invoice (and its underlying Sale +
// SaleItems), atomically decrements stock, and stamps the proforma as
// converted. Idempotent: re-running on an already-converted proforma
// returns the existing invoice — never double-charges stock.
//
// Body (all optional):
//   paymentMethod  — defaults to "credit" (most B2B proformas go to invoice
//                    first, payment later). Allowed: cash | card |
//                    bank_transfer | mobile_money | credit.
//   dueAt          — payment due date for the resulting invoice. ISO string.
//                    Defaults to +30 days from now if not provided.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { id } = await params;

    // Validate the request body FIRST — before any DB-bound calls — so
    // malformed input returns 400 instead of a misleading 500 if the
    // subscription check fails for unrelated reasons.
    const body = await request.json().catch(() => ({}));
    const { paymentMethod, dueAt } = body;

    const VALID_PAYMENT_METHODS = ["cash", "card", "bank_transfer", "mobile_money", "credit"];
    const effectivePayment = paymentMethod || "credit";
    if (!VALID_PAYMENT_METHODS.includes(effectivePayment)) {
      return NextResponse.json(
        { error: `Invalid payment method. Allowed: ${VALID_PAYMENT_METHODS.join(", ")}` },
        { status: 400 }
      );
    }

    if (dueAt !== undefined) {
      const d = new Date(dueAt);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "dueAt is not a valid date" }, { status: 400 });
      }
    }

    // Fetch the proforma — 404 if not found. We do this BEFORE the
    // subscription check so callers learn about a bad ID even on orgs
    // with subscription issues.
    const proforma = await prisma.proforma.findFirst({
      where: { id, orgId: auth.orgId },
      include: { items: true, invoice: { select: { id: true, number: true } } },
    });
    if (!proforma) return NextResponse.json({ error: "Proforma not found" }, { status: 404 });

    // Idempotency — already converted? Return the existing invoice.
    if (proforma.status === "converted" && proforma.invoice) {
      return NextResponse.json({
        proforma,
        invoice: proforma.invoice,
        alreadyConverted: true,
      });
    }

    if (proforma.status === "declined") {
      return NextResponse.json({ error: "Cannot convert a declined proforma." }, { status: 400 });
    }

    // Subscription gate — converting a proforma still counts as creating a sale.
    const subCheck = await checkSubscriptionLimit(auth.orgId, "create_sale");
    if (!subCheck.allowed) return NextResponse.json({ error: subCheck.reason }, { status: 403 });

    // Every line item must reference a real product for the Sale model.
    // Free-text items on a proforma are allowed, but they have to be linked
    // to inventory before conversion.
    const linelessItems = proforma.items.filter((it) => !it.productId);
    if (linelessItems.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot convert: ${linelessItems.length} item(s) are not linked to inventory products. Edit the proforma and link each line to a product first.`,
          linelessItems: linelessItems.map((it) => ({ id: it.id, name: it.name })),
        },
        { status: 400 }
      );
    }

    const productIds = [...new Set(proforma.items.map((it) => it.productId!).filter(Boolean))];
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, orgId: auth.orgId },
    });
    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "One or more products on this proforma no longer exist. Edit the proforma before converting." },
        { status: 400 }
      );
    }

    const dueDate = dueAt ? new Date(dueAt) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (isNaN(dueDate.getTime())) {
      return NextResponse.json({ error: "dueAt is not a valid date" }, { status: 400 });
    }

    // Atomic: stock check + Sale + Invoice + Proforma status flip, all under
    // a single transaction so a stock failure rolls back everything.
    const result = await prisma.$transaction(async (tx) => {
      // Lock the proforma row to prevent double-conversion
      const lockedProforma = await tx.$queryRaw<Array<{ id: string; status: string; convertedToInvoiceId: string | null }>>`
        SELECT "id", "status", "convertedToInvoiceId" FROM "Proforma"
        WHERE "id" = ${id} AND "orgId" = ${auth.orgId}
        FOR UPDATE
      `;
      if (lockedProforma[0]?.status === "converted") {
        // Already converted by a concurrent request — return idempotent
        const existingInvoice = await tx.invoice.findFirst({
          where: { id: lockedProforma[0].convertedToInvoiceId || "" },
          select: { id: true, number: true },
        });
        return { alreadyConverted: true, invoice: existingInvoice };
      }

      // Lock product rows with FOR UPDATE to prevent concurrent overselling
      const fresh = await tx.$queryRaw<Array<{
        id: string; name: string; stockQty: number; sqmPerUnit: number | null;
      }>>`
        SELECT "id", "name", "stockQty", "sqmPerUnit"
        FROM "Product"
        WHERE "id" = ANY(${productIds}) AND "orgId" = ${auth.orgId}
        FOR UPDATE
      `;
      const freshMap = new Map(fresh.map((p) => [p.id, p]));

      // Aggregate stock needed per product, handling sqm items.
      const stockNeeded = new Map<string, number>();
      for (const item of proforma.items) {
        const product = freshMap.get(item.productId!);
        if (!product) throw new Error(`Product ${item.name} not found`);

        let needed: number;
        if (item.sellingUnit === "sqm" && product.sqmPerUnit && product.sqmPerUnit > 0 && item.area && item.area > 0) {
          needed = item.area / product.sqmPerUnit;
        } else if (item.sellingUnit === "sqm" && (!item.area || item.area <= 0)) {
          throw new Error(`Missing area for square-meter item: ${item.name}`);
        } else {
          needed = item.quantity;
        }
        stockNeeded.set(item.productId!, (stockNeeded.get(item.productId!) || 0) + needed);
      }

      // Stock guard
      for (const [pid, needed] of stockNeeded) {
        const product = freshMap.get(pid)!;
        if (product.stockQty < needed) {
          throw new Error(
            `Insufficient stock for ${product.name}. Proforma needs ${needed.toFixed(2)} but only ${product.stockQty} on hand.`
          );
        }
      }

      // Lock OrgSettings row for atomic invoice number generation
      const settingsRows = await tx.$queryRaw<Array<{
        invoicePrefix: string | null; invoiceNextNum: number | null;
      }>>`
        SELECT "invoicePrefix", "invoiceNextNum" FROM "OrgSettings"
        WHERE "orgId" = ${auth.orgId} FOR UPDATE
      `;
      const settings = settingsRows[0] || null;
      const invoicePrefix = settings?.invoicePrefix || "INV";
      const invoiceNextNum = settings?.invoiceNextNum || 1;
      const invoiceNumber = `${invoicePrefix}-${String(invoiceNextNum).padStart(4, "0")}`;
      const saleNumber = `SAL-${Date.now()}`;

      // Create the Sale
      const sale = await tx.sale.create({
        data: {
          orgId: auth.orgId,
          userId: auth.userId,
          customerId: proforma.customerId || null,
          saleNumber,
          customer: proforma.customer,
          customerPhone: proforma.customerPhone,
          customerEmail: proforma.customerEmail,
          subtotal: proforma.subtotal,
          taxRate: proforma.taxRate,
          taxAmount: proforma.taxAmount,
          discount: proforma.discount,
          total: proforma.total,
          currency: proforma.currency,
          paymentMethod: effectivePayment,
          status: effectivePayment === "credit" ? "credit" : "completed",
          notes: proforma.notes ? `Converted from proforma ${proforma.number}. ${proforma.notes}` : `Converted from proforma ${proforma.number}.`,
          items: {
            create: proforma.items.map((it) => ({
              productId: it.productId!,
              name: it.name,
              quantity: it.quantity,
              unitPrice: it.unitPrice,
              total: it.total,
              sellingUnit: it.sellingUnit,
              area: it.area,
            })),
          },
        },
        include: { items: true },
      });

      // Decrement stock per-product. recordStockMovement handles both the
      // Product.stockQty update and the StockMovement row in a single call;
      // we pass the negative quantity so it deducts.
      for (const [pid, needed] of stockNeeded) {
        await recordStockMovement(tx, {
          orgId: auth.orgId,
          productId: pid,
          userId: auth.userId,
          type: "sale",
          quantity: -needed,
          reference: saleNumber,
          notes: `Proforma ${proforma.number} converted`,
        });
      }

      // Create the Invoice
      const invoice = await tx.invoice.create({
        data: {
          orgId: auth.orgId,
          saleId: sale.id,
          customerId: proforma.customerId || null,
          number: invoiceNumber,
          customer: proforma.customer,
          customerPhone: proforma.customerPhone,
          customerEmail: proforma.customerEmail,
          customerAddress: proforma.customerAddress,
          customerTin: proforma.customerTin,
          subtotal: proforma.subtotal,
          taxRate: proforma.taxRate,
          taxAmount: proforma.taxAmount,
          discount: proforma.discount,
          total: proforma.total,
          currency: proforma.currency,
          status: effectivePayment === "credit" ? "issued" : "paid",
          dueAt: effectivePayment === "credit" ? dueDate : null,
          paidAt: effectivePayment === "credit" ? null : new Date(),
          notes: proforma.notes,
        },
      });

      // Stamp the proforma as converted
      const updatedProforma = await tx.proforma.update({
        where: { id: proforma.id },
        data: {
          status: "converted",
          convertedToInvoiceId: invoice.id,
          convertedAt: new Date(),
        },
        include: { items: true, invoice: { select: { id: true, number: true, status: true } } },
      });

      // Bump invoice counter
      await tx.orgSettings.update({
        where: { orgId: auth.orgId },
        data: { invoiceNextNum: invoiceNextNum + 1 },
      });

      return { proforma: updatedProforma, invoice, sale };
    });

    // Handle idempotent return from concurrent conversion
    if ("alreadyConverted" in result && result.alreadyConverted) {
      return NextResponse.json({ proforma, invoice: result.invoice, alreadyConverted: true });
    }

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "convert",
      entity: "proforma",
      entityId: proforma.id,
      details: `Converted proforma ${proforma.number} → invoice ${result.invoice?.number} (sale ${result.sale?.saleNumber}). Payment: ${effectivePayment}.`,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/proformas/[id]/convert error:", error);
    const msg = error instanceof Error ? error.message : "Internal server error";
    // Stock-shortage and similar business-rule errors get 400; everything
    // else stays as 500.
    const status = /insufficient stock|not found/i.test(msg) ? 400 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
