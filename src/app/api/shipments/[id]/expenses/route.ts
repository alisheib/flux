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

    // Validate body before hitting the DB — see comment on the items route.
    const body = await request.json();
    const { category, description, amountLocal, amountUsd, notes, entryCurrency, entryRate } = body;

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
      return NextResponse.json({ error: "Amount must be a non-negative finite number" }, { status: 400 });
    }

    // Foreign-currency entry — for expenses, only entryCurrency + entryRate
    // are needed because amountLocal already holds the original foreign value.
    let entryCurrencyNormalized: string | null = null;
    let entryRateChecked: number | null = null;
    if (entryCurrency !== undefined && entryCurrency !== null) {
      if (typeof entryCurrency !== "string" || !entryCurrency.trim()) {
        return NextResponse.json({ error: "entryCurrency must be a non-empty string" }, { status: 400 });
      }
      entryCurrencyNormalized = entryCurrency.trim().toUpperCase();
      if (entryCurrencyNormalized.length > 8) {
        return NextResponse.json({ error: "entryCurrency code too long" }, { status: 400 });
      }
    }
    if (entryRate !== undefined && entryRate !== null) {
      if (typeof entryRate !== "number" || !isFinite(entryRate) || entryRate <= 0) {
        return NextResponse.json({ error: "entryRate must be a positive finite number" }, { status: 400 });
      }
      entryRateChecked = entryRate;
    }
    // If one is given the other must be too (or both null).
    if ((entryCurrencyNormalized == null) !== (entryRateChecked == null)) {
      return NextResponse.json({ error: "entryCurrency and entryRate must be provided together" }, { status: 400 });
    }

    const shipment = await prisma.shipment.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    const expense = await prisma.shipmentExpense.create({
      data: {
        orgId: auth.orgId,
        shipmentId: id,
        category,
        description,
        amountLocal: amountLocal || 0,
        amountUsd: amountUsd || 0,
        entryCurrency: entryCurrencyNormalized,
        entryRate: entryRateChecked,
        notes: notes || null,
      },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (error) {
    console.error("POST /api/shipments/[id]/expenses error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
