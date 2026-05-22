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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const shipment = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const expenses = await prisma.shipmentExpense.findMany({
      where: { shipmentId: id },
      orderBy: { category: "asc" },
    });

    return NextResponse.json(expenses);
  } catch (error) {
    console.error("GET /api/shipments/[id]/expenses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const shipment = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const body = await request.json();
    const { category, description, amountLocal, amountUsd, notes } = body;

    if (!category || !description) {
      return NextResponse.json(
        { error: "category and description are required" },
        { status: 400 }
      );
    }

    if (amountLocal !== undefined && (typeof amountLocal !== "number" || amountLocal < 0 || !isFinite(amountLocal))) {
      return NextResponse.json({ error: "Local amount must be a non-negative finite number" }, { status: 400 });
    }
    if (amountUsd !== undefined && (typeof amountUsd !== "number" || amountUsd < 0 || !isFinite(amountUsd))) {
      return NextResponse.json({ error: "USD amount must be a non-negative finite number" }, { status: 400 });
    }

    const expense = await prisma.shipmentExpense.create({
      data: {
        orgId: auth.orgId,
        shipmentId: id,
        category,
        description,
        amountLocal: amountLocal || 0,
        amountUsd: amountUsd || 0,
        notes: notes || null,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST /api/shipments/[id]/expenses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
