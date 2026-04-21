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

    const product = await prisma.product.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
        saleItems: {
          take: 10,
          orderBy: { sale: { createdAt: "desc" } },
          include: { sale: { select: { id: true, saleNumber: true, createdAt: true } } },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error("GET /api/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.product.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
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

    const product = await prisma.product.update({
      where: { id },
      data: {
        ...(categoryId !== undefined && { categoryId }),
        ...(sku !== undefined && { sku }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(unit !== undefined && { unit }),
        ...(thickness !== undefined && { thickness }),
        ...(width !== undefined && { width }),
        ...(height !== undefined && { height }),
        ...(color !== undefined && { color }),
        ...(sqmPerUnit !== undefined && { sqmPerUnit }),
        ...(costPrice !== undefined && { costPrice }),
        ...(sellingPrice !== undefined && { sellingPrice }),
        ...(stockQty !== undefined && { stockQty }),
        ...(minStockQty !== undefined && { minStockQty }),
        ...(active !== undefined && { active }),
      },
      include: {
        category: { select: { id: true, name: true, icon: true, color: true } },
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("PUT /api/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const existing = await prisma.product.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Check if product has sale items
    const saleItemCount = await prisma.saleItem.count({
      where: { productId: id },
    });
    if (saleItemCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete product with existing sales. Deactivate it instead." },
        { status: 400 }
      );
    }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/products/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
