import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
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

    // Auto-mark overdue invoices (issued + past due date)
    const now = new Date();
    await prisma.invoice.updateMany({
      where: {
        orgId: auth.orgId,
        status: "issued",
        dueAt: { lt: now },
      },
      data: { status: "overdue" },
    });

    const pagination = parsePagination(request);
    const where = { orgId: auth.orgId };

    const [total, invoices] = await Promise.all([
      prisma.invoice.count({ where }),
      prisma.invoice.findMany({
        where,
        include: {
          sale: {
            select: {
              id: true,
              saleNumber: true,
              items: { select: { id: true, name: true, quantity: true, unitPrice: true, total: true, sellingUnit: true, area: true } },
              user: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { issuedAt: "desc" },
        skip: pagination.skip,
        take: pagination.limit,
      }),
    ]);

    return NextResponse.json(paginatedResponse(invoices, total, pagination));
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
