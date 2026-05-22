import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { logAudit } from "@/lib/audit";
import { checkSubscriptionLimit } from "@/lib/subscription-check";
import { recordStockMovement } from "@/lib/stock";

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

    const [total, sales] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true } },
          items: { include: { product: { select: { id: true, name: true } } } },
          invoice: { select: { id: true, number: true, status: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json(paginatedResponse(sales, total, pagination));
  } catch (error) {
    console.error("GET /api/sales error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subCheck = await checkSubscriptionLimit(auth.orgId, "create_sale");
    if (!subCheck.allowed) return NextResponse.json({ error: subCheck.reason }, { status: 403 });

    const body = await request.json();
    const {
      customerId,
      customer,
      customerPhone,
      customerEmail,
      items,
      discount,
      paymentMethod,
      currency,
      notes,
    } = body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "At least one item is required" },
        { status: 400 }
      );
    }

    // Validate each item has positive quantity and unitPrice
    for (const item of items) {
      if (!item.productId || typeof item.productId !== "string") {
        return NextResponse.json(
          { error: "Each item must have a valid productId" },
          { status: 400 }
        );
      }
      if (typeof item.quantity !== "number" || item.quantity <= 0) {
        return NextResponse.json(
          { error: "Each item must have a quantity greater than 0" },
          { status: 400 }
        );
      }
      if (typeof item.unitPrice !== "number" || item.unitPrice <= 0) {
        return NextResponse.json(
          { error: "Each item must have a unitPrice greater than 0" },
          { status: 400 }
        );
      }
      // Validate sqm items have area
      if (item.sellingUnit === "sqm") {
        if (typeof item.area !== "number" || item.area <= 0) {
          return NextResponse.json(
            { error: "Area-sold items must have a positive area value" },
            { status: 400 }
          );
        }
      }
      // Sanitize: if sellingUnit is not "sqm", force it to "unit"
      if (item.sellingUnit && item.sellingUnit !== "sqm") {
        item.sellingUnit = "unit";
      }
    }

    const VALID_PAYMENT_METHODS = ["cash", "card", "bank_transfer", "mobile_money", "credit"];
    if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { error: `Invalid payment method. Allowed: ${VALID_PAYMENT_METHODS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate all products exist and belong to org
    const productIds = items.map((item: { productId: string }) => item.productId);
    const uniqueProductIds = [...new Set(productIds)];
    const products = await prisma.product.findMany({
      where: { id: { in: uniqueProductIds }, orgId: auth.orgId },
    });

    if (products.length !== uniqueProductIds.length) {
      return NextResponse.json(
        { error: "One or more products not found" },
        { status: 400 }
      );
    }

    // Pre-validate sqm configuration (doesn't need transaction)
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) continue;

      // Reject sqm sales on products without sqmPerUnit configured
      if (item.sellingUnit === "sqm" && (!product.sqmPerUnit || product.sqmPerUnit <= 0)) {
        return NextResponse.json(
          { error: `Product "${product.name}" is not configured for area selling (missing m²/unit).` },
          { status: 400 }
        );
      }
    }

    // Get org for tax rate
    const org = await prisma.organization.findUnique({
      where: { id: auth.orgId },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Calculate totals
    const subtotal = items.reduce(
      (sum: number, item: { quantity: number; unitPrice: number }) =>
        sum + item.quantity * item.unitPrice,
      0
    );
    const discountAmount = Math.max(0, Math.min(discount || 0, subtotal));
    const taxableAmount = subtotal - discountAmount;
    const taxRate = org.taxRate;
    const taxAmount = Math.round(taxableAmount * (taxRate / 100) * 100) / 100;
    const total = Math.round((taxableAmount + taxAmount) * 100) / 100;

    // Generate sale number
    const saleNumber = `SAL-${Date.now()}`;

    // Create sale + items + invoice in a transaction, decrement stock
    const sale = await prisma.$transaction(async (tx) => {
      // Re-check stock INSIDE transaction to prevent race conditions
      const freshProducts = await tx.product.findMany({
        where: { id: { in: uniqueProductIds }, orgId: auth.orgId },
      });
      const freshProductMap = new Map(freshProducts.map((p) => [p.id, p]));

      // Aggregate total stock needed per product (handles duplicate productIds in items)
      const stockNeededMap = new Map<string, number>();
      for (const item of items) {
        const product = freshProductMap.get(item.productId);
        if (!product) throw new Error(`Product ${item.productId} not found`);

        let stockNeeded: number;
        if (item.sellingUnit === "sqm" && product.sqmPerUnit && product.sqmPerUnit > 0) {
          stockNeeded = item.area / product.sqmPerUnit;
        } else {
          stockNeeded = item.quantity;
        }
        stockNeededMap.set(item.productId, (stockNeededMap.get(item.productId) || 0) + stockNeeded);
      }

      // Check aggregated stock per product
      for (const [productId, totalNeeded] of stockNeededMap) {
        const product = freshProductMap.get(productId)!;
        if (product.stockQty < totalNeeded) {
          throw new Error(`Insufficient stock for ${product.name}. Need ${totalNeeded.toFixed(2)} but only ${product.stockQty} available`);
        }
      }

      // Get org settings INSIDE transaction to prevent invoice number race
      const settings = await tx.orgSettings.findUnique({
        where: { orgId: auth.orgId },
      });

      const invoicePrefix = settings?.invoicePrefix || "INV";
      const invoiceNextNum = settings?.invoiceNextNum || 1;
      const invoiceNumber = `${invoicePrefix}-${String(invoiceNextNum).padStart(4, "0")}`;
      // Create the sale
      const newSale = await tx.sale.create({
        data: {
          orgId: auth.orgId,
          userId: auth.userId,
          customerId: customerId || null,
          saleNumber,
          customer: customer || null,
          customerPhone: customerPhone || null,
          customerEmail: customerEmail || null,
          subtotal,
          taxRate,
          taxAmount,
          discount: discountAmount,
          total,
          currency: currency || org.currency,
          paymentMethod,
          status: paymentMethod === "credit" ? "credit" : "completed",
          notes: notes || null,
          items: {
            create: items.map(
              (item: { productId: string; quantity: number; unitPrice: number; sellingUnit?: string; area?: number }) => {
                const product = productMap.get(item.productId)!;
                return {
                  productId: item.productId,
                  name: product.name,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: Math.round(item.quantity * item.unitPrice * 100) / 100,
                  sellingUnit: item.sellingUnit || "unit",
                  area: item.sellingUnit === "sqm" ? item.area : null,
                };
              }
            ),
          },
        },
        include: {
          items: true,
          user: { select: { id: true, name: true, email: true } },
        },
      });

      // If customerId provided, fetch TIN for invoice
      let customerTin: string | null = null;
      if (customerId) {
        const custRecord = await tx.customer.findUnique({
          where: { id: customerId },
          select: { tin: true },
        });
        customerTin = custRecord?.tin || null;
      }

      // Create invoice linked to sale
      await tx.invoice.create({
        data: {
          orgId: auth.orgId,
          saleId: newSale.id,
          customerId: customerId || null,
          number: invoiceNumber,
          customer: customer || "Walk-in Customer",
          customerPhone: customerPhone || null,
          customerEmail: customerEmail || null,
          customerTin,
          subtotal,
          taxRate,
          taxAmount,
          discount: discountAmount,
          total,
          currency: currency || org.currency,
          status: "issued",
          notes: notes || null,
        },
      });

      // Decrement stock for each product (with stock movement tracking)
      // For sqm sales, convert area to sheet-equivalent for stock deduction
      for (const item of items) {
        const product = freshProductMap.get(item.productId)!;
        let stockDecrement: number;
        let movementNotes: string | undefined;

        if (item.sellingUnit === "sqm" && product.sqmPerUnit && product.sqmPerUnit > 0) {
          // Convert m² to sheets: area / sqmPerUnit
          stockDecrement = Math.round((item.area / product.sqmPerUnit) * 10000) / 10000;
          movementNotes = `Sold ${item.area} m² (${stockDecrement} sheet equiv.)`;
        } else {
          stockDecrement = item.quantity;
        }

        await recordStockMovement(tx, {
          orgId: auth.orgId,
          productId: item.productId,
          userId: auth.userId,
          type: "sale",
          quantity: -stockDecrement,
          reference: saleNumber,
          notes: movementNotes,
        });
      }

      // Increment invoice counter
      if (settings) {
        await tx.orgSettings.update({
          where: { orgId: auth.orgId },
          data: { invoiceNextNum: invoiceNextNum + 1 },
        });
      }

      return newSale;
    });

    // Refetch with invoice
    const fullSale = await prisma.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: { include: { product: { select: { id: true, name: true } } } },
        invoice: { select: { id: true, number: true, status: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "create", entity: "sale", entityId: sale.id, details: `Created sale: ${saleNumber}, total: ${total}` });

    return NextResponse.json(fullSale, { status: 201 });
  } catch (error) {
    // Handle stock validation errors thrown from inside the transaction
    if (error instanceof Error && error.message.startsWith("Insufficient stock")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/sales error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
