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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, expenseId } = await params;

    const shipment = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const existing = await prisma.shipmentExpense.findFirst({
      where: { id: expenseId, shipmentId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    const body = await request.json();
    const { category, description, amountLocal, amountUsd, notes } = body;

    if (amountLocal !== undefined && (typeof amountLocal !== "number" || amountLocal < 0 || !isFinite(amountLocal))) {
      return NextResponse.json({ error: "Local amount must be a non-negative finite number" }, { status: 400 });
    }
    if (amountUsd !== undefined && (typeof amountUsd !== "number" || amountUsd < 0 || !isFinite(amountUsd))) {
      return NextResponse.json({ error: "USD amount must be a non-negative finite number" }, { status: 400 });
    }

    const expense = await prisma.shipmentExpense.update({
      where: { id: expenseId },
      data: {
        ...(category !== undefined && { category }),
        ...(description !== undefined && { description }),
        ...(amountLocal !== undefined && { amountLocal }),
        ...(amountUsd !== undefined && { amountUsd }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json(expense);
  } catch (error) {
    console.error("PUT /api/shipments/[id]/expenses/[expenseId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, expenseId } = await params;

    const shipment = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const existing = await prisma.shipmentExpense.findFirst({
      where: { id: expenseId, shipmentId: id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Expense not found" }, { status: 404 });
    }

    await prisma.shipmentExpense.delete({ where: { id: expenseId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/shipments/[id]/expenses/[expenseId] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
