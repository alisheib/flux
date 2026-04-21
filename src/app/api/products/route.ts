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

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const categoryId = searchParams.get("categoryId");

    const where: Record<string, unknown> = { orgId: auth.orgId };
    if (categoryId) {
      where.categoryId = categoryId;
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
      orderBy: { name: "asc" },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("GET /api/products error:", error);
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
      categoryId,
      sku,
      name,
      description,
      unit,
      thickness,
      width,
      height,
      color,
      sqmPerUnit,
      costPrice,
      sellingPrice,
      stockQty,
      minStockQty,
      active,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Product name is required" }, { status: 400 });
    }

    if (costPrice !== undefined && costPrice !== null && costPrice < 0) {
      return NextResponse.json({ error: "Cost price cannot be negative" }, { status: 400 });
    }

    if (sellingPrice !== undefined && sellingPrice !== null && sellingPrice < 0) {
      return NextResponse.json({ error: "Selling price cannot be negative" }, { status: 400 });
    }

    if (stockQty !== undefined && stockQty !== null && stockQty < 0) {
      return NextResponse.json({ error: "Stock quantity cannot be negative" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        orgId: auth.orgId,
        categoryId: categoryId || null,
        sku: sku?.trim() || null,
        name: name.trim(),
        description: description?.trim() || null,
        unit: unit || "piece",
        thickness: thickness || null,
        width: width || null,
        height: height || null,
        color: color?.trim() || null,
        sqmPerUnit: sqmPerUnit != null ? Number(sqmPerUnit) : null,
        costPrice: Number(costPrice) || 0,
        sellingPrice: Number(sellingPrice) || 0,
        stockQty: Number(stockQty) || 0,
        minStockQty: Number(minStockQty) || 0,
        active: active !== undefined ? active : true,
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("POST /api/products error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
