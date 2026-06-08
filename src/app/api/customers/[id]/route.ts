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

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const customer = await prisma.customer.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        sales: {
          include: {
            items: { select: { id: true, name: true, quantity: true, total: true } },
            user: { select: { name: true } },
            invoice: { select: { id: true, number: true, status: true, issuedAt: true, dueAt: true, total: true } },
            payments: { select: { id: true, amount: true, method: true, reference: true, date: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // Compute stats
    const totalSpent = customer.sales.reduce((s, sale) => s + sale.total, 0);
    const totalPaid = customer.sales.reduce((s, sale) => s + sale.payments.reduce((ps, p) => ps + p.amount, 0), 0);
    const outstanding = Math.max(0, Math.round((totalSpent - totalPaid) * 100) / 100);
    const salesCount = customer.sales.length;
    const avgOrder = salesCount > 0 ? Math.round(totalSpent / salesCount) : 0;
    const lastSaleAt = customer.sales.length > 0 ? customer.sales[0].createdAt : null;

    // Monthly revenue for chart (last 12 months)
    const now = new Date();
    const monthlyRevenue: number[] = [];
    for (let i = 11; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      const monthTotal = customer.sales
        .filter(s => new Date(s.createdAt) >= month && new Date(s.createdAt) < nextMonth)
        .reduce((s, sale) => s + sale.total, 0);
      monthlyRevenue.push(monthTotal);
    }

    // Flatten invoices and payments for tabs
    const invoices = customer.sales
      .filter(s => s.invoice)
      .map(s => ({
        ...s.invoice!,
        saleNumber: s.saleNumber,
      }));

    const payments = customer.sales.flatMap(s =>
      s.payments.map(p => ({
        ...p,
        saleNumber: s.saleNumber,
        recordedBy: s.user?.name || "Unknown",
      }))
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return NextResponse.json({
      ...customer,
      tags: (() => { try { return customer.tags ? JSON.parse(customer.tags) : []; } catch { return []; } })(),
      initials: getInitials(customer.name),
      stats: { totalSpent, outstanding, salesCount, avgOrder, lastSaleAt, monthlyRevenue },
      invoices,
      payments,
    });
  } catch (error) {
    console.error("GET /api/customers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.customer.findFirst({ where: { id, orgId: auth.orgId } });
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    const body = await request.json();
    const { name, company, tin, phone, email, address, tags, notes, status } = body;

    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "Customer name cannot be empty" }, { status: 400 });
    }

    const customer = await prisma.customer.update({
      where: { id, orgId: auth.orgId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(company !== undefined && { company: company?.trim() || null }),
        ...(tin !== undefined && { tin: tin?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(address !== undefined && { address: address?.trim() || null }),
        ...(tags !== undefined && { tags: Array.isArray(tags) ? JSON.stringify(tags) : null }),
        ...(notes !== undefined && { notes: notes?.trim() || null }),
        ...(status !== undefined && { status }),
      },
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "update",
      entity: "customer",
      entityId: customer.id,
      details: `Updated customer: ${customer.name}`,
    });

    return NextResponse.json({
      ...customer,
      tags: (() => { try { return customer.tags ? JSON.parse(customer.tags) : []; } catch { return []; } })(),
      initials: getInitials(customer.name),
    });
  } catch (error) {
    console.error("PUT /api/customers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const existing = await prisma.customer.findFirst({ where: { id, orgId: auth.orgId } });
    if (!existing) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

    // Don't hard delete — set to inactive instead (preserves history)
    await prisma.customer.update({
      where: { id, orgId: auth.orgId },
      data: { status: "inactive" },
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "update",
      entity: "customer",
      entityId: id,
      details: `Deactivated customer: ${existing.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/customers/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getInitials(name: string): string {
  return name.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}
