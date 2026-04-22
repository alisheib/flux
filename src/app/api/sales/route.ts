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

    const VALID_PAYMENT_METHODS = ["cash", "card", "bank_transfer", "mobile_money"];
    if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return NextResponse.json(
        { error: `Invalid payment method. Allowed: ${VALID_PAYMENT_METHODS.join(", ")}` },
        { status: 400 }
      );
    }

    // Validate all products exist and belong to org
    const productIds = items.map((item: { productId: string }) => item.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds }, orgId: auth.orgId },
    });

    if (products.length !== productIds.length) {
      return NextResponse.json(
        { error: "One or more products not found" },
        { status: 400 }
      );
    }

    // Check stock availability
    const productMap = new Map(products.map((p) => [p.id, p]));
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) continue;
      if (product.stockQty < item.quantity) {
        return NextResponse.json(
          { error: `Insufficient stock for ${product.name}. Available: ${product.stockQty}` },
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

    // Get org settings for invoice number
    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: auth.orgId },
    });

    const invoicePrefix = settings?.invoicePrefix || "INV";
    const invoiceNextNum = settings?.invoiceNextNum || 1;
    const invoiceNumber = `${invoicePrefix}-${String(invoiceNextNum).padStart(4, "0")}`;

    // Create sale + items + invoice in a transaction, decrement stock
    const sale = await prisma.$transaction(async (tx) => {
      // Create the sale
      const newSale = await tx.sale.create({
        data: {
          orgId: auth.orgId,
          userId: auth.userId,
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
          status: "completed",
          notes: notes || null,
          items: {
            create: items.map(
              (item: { productId: string; quantity: number; unitPrice: number }) => {
                const product = productMap.get(item.productId)!;
                return {
                  productId: item.productId,
                  name: product.name,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  total: Math.round(item.quantity * item.unitPrice * 100) / 100,
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

      // Create invoice linked to sale
      await tx.invoice.create({
        data: {
          orgId: auth.orgId,
          saleId: newSale.id,
          number: invoiceNumber,
          customer: customer || "Walk-in Customer",
          customerPhone: customerPhone || null,
          customerEmail: customerEmail || null,
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
      for (const item of items) {
        await recordStockMovement(tx, {
          orgId: auth.orgId,
          productId: item.productId,
          userId: auth.userId,
          type: "sale",
          quantity: -item.quantity,
          reference: saleNumber,
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
    console.error("POST /api/sales error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
