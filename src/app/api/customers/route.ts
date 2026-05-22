import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = request.nextUrl;
    const q = searchParams.get("q") || "";
    const status = searchParams.get("status") || "";
    const hasBalance = searchParams.get("hasBalance") === "true";

    const where: Record<string, unknown> = { orgId: auth.orgId };
    if (status && status !== "all") {
      where.status = status;
    }

    const customers = await prisma.customer.findMany({
      where,
      include: {
        sales: {
          select: { id: true, total: true, status: true, createdAt: true, payments: { select: { amount: true } } },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    // Compute stats and apply search/balance filter in-memory for flexibility
    const now = new Date();
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 86400000);

    const enriched = customers.map(c => {
      const totalSpent = c.sales.reduce((s, sale) => s + sale.total, 0);
      const totalPaid = c.sales.reduce((s, sale) => s + sale.payments.reduce((ps, p) => ps + p.amount, 0), 0);
      const outstanding = Math.round((totalSpent - totalPaid) * 100) / 100;
      const salesCount = c.sales.length;
      const lastSaleAt = c.sales.length > 0 ? c.sales[0].createdAt : null;
      const isActive = lastSaleAt ? new Date(lastSaleAt) >= ninetyDaysAgo : false;
      const tags = c.tags ? JSON.parse(c.tags) : [];

      return {
        id: c.id,
        name: c.name,
        company: c.company,
        tin: c.tin,
        phone: c.phone,
        email: c.email,
        address: c.address,
        tags,
        notes: c.notes,
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        totalSpent,
        outstanding: Math.max(0, outstanding),
        salesCount,
        lastSaleAt,
        isActive,
        initials: getInitials(c.name),
      };
    }).filter(c => {
      // Search filter
      if (q) {
        const searchStr = `${c.name} ${c.company || ""} ${c.tin || ""} ${c.phone || ""} ${c.email || ""}`.toLowerCase();
        const normalizedQ = q.replace(/^\+?255\s*0?/, "").replace(/[\s\-]/g, "").toLowerCase();
        const normalizedSearch = searchStr.replace(/[\s\-]/g, "");
        if (!normalizedSearch.includes(normalizedQ) && !searchStr.includes(q.toLowerCase())) return false;
      }
      // Balance filter
      if (hasBalance && c.outstanding <= 0) return false;
      return true;
    });

    // Aggregate KPIs
    const totalCustomers = enriched.length;
    const activeCount = enriched.filter(c => c.isActive).length;
    const totalRevenue = enriched.reduce((s, c) => s + c.totalSpent, 0);
    const totalOutstanding = enriched.reduce((s, c) => s + c.outstanding, 0);
    const withBalanceCount = enriched.filter(c => c.outstanding > 0).length;

    return NextResponse.json({
      customers: enriched,
      stats: { totalCustomers, activeCount, totalRevenue, totalOutstanding, withBalanceCount },
    });
  } catch (error) {
    console.error("GET /api/customers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, company, tin, phone, email, address, tags, notes } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
    }

    const customer = await prisma.customer.create({
      data: {
        orgId: auth.orgId,
        name: name.trim(),
        company: company?.trim() || null,
        tin: tin?.trim() || null,
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        tags: tags && Array.isArray(tags) ? JSON.stringify(tags) : null,
        notes: notes?.trim() || null,
      },
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "create",
      entity: "customer",
      entityId: customer.id,
      details: `Created customer: ${customer.name}${customer.tin ? ` (TIN: ${customer.tin})` : ""}`,
    });

    return NextResponse.json({
      ...customer,
      tags: customer.tags ? JSON.parse(customer.tags) : [],
      initials: getInitials(customer.name),
      totalSpent: 0,
      outstanding: 0,
      salesCount: 0,
      lastSaleAt: null,
      isActive: false,
    }, { status: 201 });
  } catch (error) {
    console.error("POST /api/customers error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
