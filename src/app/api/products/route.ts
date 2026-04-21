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

    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: {
        orgId: auth.orgId,
        categoryId: categoryId || null,
        sku: sku || null,
        name,
        description: description || null,
        unit: unit || "piece",
        thickness: thickness || null,
        width: width || null,
        height: height || null,
        color: color || null,
        sqmPerUnit: sqmPerUnit || null,
        costPrice: costPrice || 0,
        sellingPrice: sellingPrice || 0,
        stockQty: stockQty || 0,
        minStockQty: minStockQty || 0,
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
