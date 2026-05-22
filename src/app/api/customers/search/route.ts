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

// Lightweight search endpoint for the customer typeahead component
// Returns just what the dropdown needs — no full sale history
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = request.nextUrl.searchParams.get("q") || "";
    if (q.length < 1) return NextResponse.json([]);

    // Normalize phone search: strip +255, leading 0, spaces, dashes
    const normalizedQ = q.replace(/^\+?255\s*0?/, "").replace(/[\s\-()]/g, "").toLowerCase();

    const customers = await prisma.customer.findMany({
      where: {
        orgId: auth.orgId,
        status: "active",
      },
      select: {
        id: true,
        name: true,
        company: true,
        tin: true,
        phone: true,
        email: true,
        address: true,
        sales: {
          select: { total: true, payments: { select: { amount: true } } },
        },
      },
      take: 20,
      orderBy: { name: "asc" },
    });

    // Filter and compute outstanding in-memory for search flexibility
    const results = customers
      .filter(c => {
        const searchable = `${c.name} ${c.company || ""} ${c.tin || ""} ${c.phone || ""} ${c.email || ""}`
          .replace(/[\s\-()]/g, "").toLowerCase();
        return searchable.includes(normalizedQ) ||
          `${c.name} ${c.company || ""} ${c.tin || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase().includes(q.toLowerCase());
      })
      .slice(0, 8)
      .map(c => {
        const totalSpent = c.sales.reduce((s, sale) => s + sale.total, 0);
        const totalPaid = c.sales.reduce((s, sale) => s + sale.payments.reduce((ps, p) => ps + p.amount, 0), 0);
        const outstanding = Math.max(0, Math.round((totalSpent - totalPaid) * 100) / 100);
        return {
          id: c.id,
          name: c.name,
          company: c.company,
          tin: c.tin,
          phone: c.phone,
          email: c.email,
          address: c.address,
          outstanding,
          initials: c.name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase(),
        };
      });

    return NextResponse.json(results);
  } catch (error) {
    console.error("GET /api/customers/search error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
