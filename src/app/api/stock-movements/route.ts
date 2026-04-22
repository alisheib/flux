import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parsePagination, paginatedResponse } from "@/lib/pagination";

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

    if (!hasMinRole(auth.role, "accountant")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const pagination = parsePagination(request);
    const { searchParams } = request.nextUrl;
    const productId = searchParams.get("productId");
    const type = searchParams.get("type");
    const search = searchParams.get("search");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = { orgId: auth.orgId };
    if (productId) {
      where.productId = productId;
    }
    if (type) {
      where.type = type;
    }
    if (search) {
      where.product = {
        name: { contains: search, mode: "insensitive" },
      };
    }

    const [total, movements] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true } },
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json(paginatedResponse(movements, total, pagination));
  } catch (error) {
    console.error("GET /api/stock-movements error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
