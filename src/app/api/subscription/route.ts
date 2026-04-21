import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PLANS, type PlanId } from "@/lib/subscription";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// GET: Current subscription info
export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let sub = await prisma.subscription.findUnique({ where: { orgId: auth.orgId } });

    // Auto-create free subscription if none exists
    if (!sub) {
      sub = await prisma.subscription.create({
        data: {
          orgId: auth.orgId,
          plan: "free",
          status: "active",
          maxUsers: 1,
          maxSalesMo: 50,
        },
      });
    }

    const plan = PLANS[sub.plan as PlanId] || PLANS.free;
    const userCount = await prisma.user.count({ where: { orgId: auth.orgId, active: true } });

    // Count sales this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const salesThisMonth = await prisma.sale.count({
      where: { orgId: auth.orgId, createdAt: { gte: monthStart } },
    });

    return NextResponse.json({
      subscription: {
        id: sub.id,
        plan: sub.plan,
        planName: plan.name,
        status: sub.status,
        maxUsers: sub.maxUsers,
        maxSalesMo: sub.maxSalesMo,
        features: plan.features,
        expiresAt: sub.expiresAt,
        trialEndsAt: sub.trialEndsAt,
      },
      usage: {
        users: userCount,
        salesThisMonth,
      },
      plans: Object.entries(PLANS).map(([id, p]) => ({
        id,
        name: p.name,
        price: p.price,
        maxUsers: p.maxUsers,
        maxSalesMo: p.maxSalesMo,
        features: p.features,
        description: p.description,
      })),
    });
  } catch (error) {
    console.error("GET /api/subscription error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Upgrade/change plan (admin only)
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasMinRole(auth.role, "admin")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { plan } = await request.json();
    if (!plan || !PLANS[plan as PlanId]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const planDef = PLANS[plan as PlanId];

    const sub = await prisma.subscription.upsert({
      where: { orgId: auth.orgId },
      create: {
        orgId: auth.orgId,
        plan,
        status: "active",
        maxUsers: planDef.maxUsers,
        maxSalesMo: planDef.maxSalesMo,
        features: JSON.stringify(planDef.features),
      },
      update: {
        plan,
        maxUsers: planDef.maxUsers,
        maxSalesMo: planDef.maxSalesMo,
        features: JSON.stringify(planDef.features),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Plan updated to ${planDef.name}`,
      subscription: sub,
    });
  } catch (error) {
    console.error("PUT /api/subscription error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
