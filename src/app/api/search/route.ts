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

    const q = request.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    const query = `%${q.toLowerCase()}%`;

    // Search across products, customers, invoices, and proformas in parallel
    const [products, customers, invoices, proformas] = await Promise.all([
      prisma.product.findMany({
        where: {
          orgId: auth.orgId,
          active: true,
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, sku: true, sellingPrice: true, stockQty: true },
        take: 5,
        orderBy: { name: "asc" },
      }),
      prisma.customer.findMany({
        where: {
          orgId: auth.orgId,
          status: "active",
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q, mode: "insensitive" } },
            { tin: { contains: q, mode: "insensitive" } },
            { company: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true, phone: true, company: true },
        take: 5,
        orderBy: { name: "asc" },
      }),
      prisma.invoice.findMany({
        where: {
          orgId: auth.orgId,
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { customer: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, number: true, customer: true, total: true, status: true },
        take: 5,
        orderBy: { issuedAt: "desc" },
      }),
      prisma.proforma.findMany({
        where: {
          orgId: auth.orgId,
          OR: [
            { number: { contains: q, mode: "insensitive" } },
            { customer: { contains: q, mode: "insensitive" } },
          ],
        },
        select: { id: true, number: true, customer: true, total: true, status: true },
        take: 3,
        orderBy: { createdAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      results: {
        products,
        customers,
        invoices,
        proformas,
      },
    });
  } catch (error) {
    console.error("GET /api/search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
