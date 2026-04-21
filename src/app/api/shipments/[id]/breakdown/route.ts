import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { calculateShipmentCosts } from "@/lib/calculations";

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
      include: {
        items: true,
        expenses: true,
      },
    });

    if (!shipment) {
      return NextResponse.json({ error: "Shipment not found" }, { status: 404 });
    }

    // Get org settings for default margins
    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: auth.orgId },
    });

    const defaultMargins = settings
      ? [settings.defaultMargin, settings.secondaryMargin, 5, 10, 15, 20, 25, 30]
      : [5, 10, 15, 20, 25, 30];

    // Deduplicate margins
    const uniqueMargins = Array.from(new Set(defaultMargins)).sort((a, b) => a - b);

    const items = shipment.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      totalCost: item.totalCost,
    }));

    const expenses = shipment.expenses.map((e) => ({
      amountUsd: e.amountUsd,
      category: e.category,
    }));

    const breakdown = calculateShipmentCosts(items, expenses, uniqueMargins);

    return NextResponse.json({
      shipment: {
        id: shipment.id,
        name: shipment.name,
        exchangeRate: shipment.exchangeRate,
      },
      ...breakdown,
    });
  } catch (error) {
    console.error("GET /api/shipments/[id]/breakdown error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
