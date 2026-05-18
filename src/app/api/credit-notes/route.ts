import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { recordStockMovement } from "@/lib/stock";
import { logAudit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";

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

    if (!hasMinRole(auth.role, "accountant")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pagination = parsePagination(request);

    const where = { orgId: auth.orgId };

    const [total, creditNotes] = await Promise.all([
      prisma.creditNote.count({ where }),
      prisma.creditNote.findMany({
        where,
        include: {
          sale: {
            select: {
              id: true,
              saleNumber: true,
              customer: true,
              total: true,
              status: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json(paginatedResponse(creditNotes, total, pagination));
  } catch (error) {
    console.error("GET /api/credit-notes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

interface CreditNoteItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
  sellingUnit?: string;
  area?: number | null;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 10 credit note requests per minute per user
    const rateLimitKey = `credit-note:${auth.userId}`;
    const { allowed, resetIn } = rateLimit(rateLimitKey, { maxAttempts: 10, windowMs: 60 * 1000 });
    if (!allowed) {
      const seconds = Math.ceil(resetIn / 1000);
      return NextResponse.json(
        { error: `Too many credit note requests. Please try again in ${seconds} seconds.` },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { saleId, reason, items, restockItems } = body as {
      saleId: string;
      reason: string;
      items: CreditNoteItem[];
      restockItems: boolean;
    };

    if (!saleId || !reason || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "saleId, reason, and at least one item are required" },
        { status: 400 }
      );
    }

    // Validate sale exists and belongs to org
    const sale = await prisma.sale.findFirst({
      where: { id: saleId, orgId: auth.orgId },
      include: { items: true, creditNotes: true },
    });

    if (!sale) {
      return NextResponse.json({ error: "Sale not found" }, { status: 404 });
    }

    // Calculate totals from items
    const subtotal = items.reduce((sum, item) => sum + item.total, 0);

    // Get org for tax rate
    const org = await prisma.organization.findUnique({
      where: { id: auth.orgId },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const taxRate = sale.taxRate;
    const taxAmount = Math.round(subtotal * (taxRate / 100) * 100) / 100;
    const total = Math.round((subtotal + taxAmount) * 100) / 100;

    // Generate credit note number: CN-0001, CN-0002, ...
    const existingCount = await prisma.creditNote.count({
      where: { orgId: auth.orgId },
    });
    const creditNoteNumber = `CN-${String(existingCount + 1).padStart(4, "0")}`;

    // Determine if this is a full or partial refund
    const previouslyRefunded = sale.creditNotes.reduce((sum, cn) => {
      return sum + cn.total;
    }, 0);
    const totalRefundedAfter = previouslyRefunded + total;
    const newSaleStatus =
      totalRefundedAfter >= sale.total ? "refunded" : "partially_refunded";

    // Create credit note in a transaction
    const creditNote = await prisma.$transaction(async (tx) => {
      // Create the credit note
      const cn = await tx.creditNote.create({
        data: {
          orgId: auth.orgId,
          saleId,
          number: creditNoteNumber,
          reason,
          items: JSON.stringify(items),
          subtotal,
          taxAmount,
          total,
          restockItems: restockItems ?? true,
          status: "issued",
        },
      });

      // Restock items if requested
      if (restockItems) {
        // Fetch products to check sqmPerUnit for area-sold items
        const productIds = items.map((i) => i.productId);
        const refundProducts = await tx.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, sqmPerUnit: true },
        });
        const refundProductMap = new Map(refundProducts.map((p) => [p.id, p]));

        for (const item of items) {
          let restockQty: number;
          let movementNotes: string;

          if (item.sellingUnit === "sqm") {
            // Convert area back to sheet-equivalent for restocking
            const product = refundProductMap.get(item.productId);
            const sqmPerUnit = product?.sqmPerUnit || 0;
            const area = item.area ?? item.quantity;
            restockQty = sqmPerUnit > 0
              ? Math.round((area / sqmPerUnit) * 10000) / 10000
              : item.quantity;
            movementNotes = `Credit note refund ${area} m² (${restockQty} sheet equiv.) for sale ${sale.saleNumber}`;
          } else {
            restockQty = item.quantity;
            movementNotes = `Credit note refund for sale ${sale.saleNumber}`;
          }

          await recordStockMovement(tx, {
            orgId: auth.orgId,
            productId: item.productId,
            userId: auth.userId,
            type: "refund",
            quantity: +restockQty,
            reference: creditNoteNumber,
            notes: movementNotes,
          });
        }
      }

      // Update sale status
      await tx.sale.update({
        where: { id: saleId },
        data: { status: newSaleStatus },
      });

      return cn;
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "create",
      entity: "credit_note",
      entityId: creditNote.id,
      details: `Credit note ${creditNoteNumber} for sale ${sale.saleNumber}. Amount: ${total}. Restock: ${restockItems ? "yes" : "no"}`,
    });

    // Return the credit note with sale info
    const fullCreditNote = await prisma.creditNote.findUnique({
      where: { id: creditNote.id },
      include: {
        sale: {
          select: {
            id: true,
            saleNumber: true,
            customer: true,
            total: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json(fullCreditNote, { status: 201 });
  } catch (error) {
    console.error("POST /api/credit-notes error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
