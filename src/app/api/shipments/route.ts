import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    const shipments = await prisma.shipment.findMany({
      where: { orgId: auth.orgId },
      include: {
        _count: { select: { items: true, expenses: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(shipments);
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

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const shipment = await prisma.shipment.create({
      data: {
        orgId: auth.orgId,
        name,
        dossierNumber: dossierNumber || null,
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

    return NextResponse.json(shipment, { status: 201 });
  } catch (error) {
    console.error("POST /api/shipments error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
