import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePagination, paginatedResponse } from "@/lib/pagination";
import { logAudit } from "@/lib/audit";

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

    const [total, shipments] = await Promise.all([
      prisma.shipment.count({ where }),
      prisma.shipment.findMany({
        where,
        include: {
          _count: { select: { items: true, expenses: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json(paginatedResponse(shipments, total, pagination));
  } catch (error) {
    console.error("GET /api/shipments error:", error);
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
      name,
      dossierNumber,
      invoiceNumber,
      containerNumber,
      containerType,
      containerCount,
      supplier,
      origin,
      exchangeRate,
      status,
      notes,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (exchangeRate !== undefined && (typeof exchangeRate !== "number" || !isFinite(exchangeRate) || exchangeRate <= 0)) {
      return NextResponse.json({ error: "Exchange rate must be a positive finite number" }, { status: 400 });
    }
    if (containerCount !== undefined && (typeof containerCount !== "number" || containerCount < 1)) {
      return NextResponse.json({ error: "Container count must be at least 1" }, { status: 400 });
    }

    const shipment = await prisma.shipment.create({
      data: {
        orgId: auth.orgId,
        name: name.trim(),
        dossierNumber: dossierNumber?.trim() || null,
        invoiceNumber: invoiceNumber || null,
        containerNumber: containerNumber || null,
        containerType: containerType || "20HC",
        containerCount: containerCount || 1,
        supplier: supplier || null,
        origin: origin || "China",
        exchangeRate: exchangeRate || 2630,
        status: status || "clearing",
        notes: notes || null,
      },
      include: {
        _count: { select: { items: true, expenses: true } },
      },
    });

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "create", entity: "shipment", entityId: shipment.id, details: `Created shipment: ${shipment.name}` });

    return NextResponse.json(shipment, { status: 201 });
  } catch (error) {
    console.error("POST /api/shipments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
