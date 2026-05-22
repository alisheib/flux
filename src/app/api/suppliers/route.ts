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

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const suppliers = await prisma.supplier.findMany({
      where: { orgId: auth.orgId },
      include: {
        _count: { select: { purchaseOrders: true } },
        purchaseOrders: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const data = suppliers.map((s) => {
      const purchasesYTD = s.purchaseOrders
        .filter((po) => po.createdAt >= startOfYear && po.status !== "cancelled")
        .reduce((sum, po) => sum + po.total, 0);

      const outstanding = s.purchaseOrders
        .filter((po) => ["draft", "sent", "partial"].includes(po.status))
        .reduce((sum, po) => sum + po.total, 0);

      const lastOrder = s.purchaseOrders.length > 0 ? s.purchaseOrders[0].createdAt : null;

      const openPOs = s.purchaseOrders.filter((po) =>
        ["draft", "sent", "partial"].includes(po.status)
      ).length;

      return {
        id: s.id,
        name: s.name,
        country: s.country,
        city: s.city,
        contact: s.contact,
        phone: s.phone,
        email: s.email,
        address: s.address,
        paymentTerms: s.paymentTerms,
        notes: s.notes,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        ordersCount: s._count.purchaseOrders,
        purchasesYTD,
        outstanding,
        lastOrder,
        openPOs,
      };
    });

    return NextResponse.json(data);
  } catch (error) {
    console.error("GET /api/suppliers error:", error);
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
    const { name, country, city, contact, phone, email, address, paymentTerms, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Supplier name is required" }, { status: 400 });
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 });
    }

    const supplier = await prisma.supplier.create({
      data: {
        orgId: auth.orgId,
        name: name.trim(),
        country: country?.trim() || null,
        city: city?.trim() || null,
        contact: contact?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        paymentTerms: paymentTerms?.trim() || null,
        notes: notes?.trim() || null,
      },
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "create",
      entity: "supplier",
      entityId: supplier.id,
      details: `Created supplier: ${supplier.name}`,
    });

    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    console.error("POST /api/suppliers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
