import { prisma } from "@/lib/db";

interface SubLimits {
  allowed: boolean;
  reason?: string;
}

/**
 * Check if org can perform an action based on subscription limits.
 */
export async function checkSubscriptionLimit(
  orgId: string,
  action: "create_user" | "create_sale"
): Promise<SubLimits> {
  const sub = await prisma.subscription.findUnique({ where: { orgId } });

  // No subscription = allow (legacy orgs / migration)
  if (!sub) return { allowed: true };

  // Cancelled or expired
  if (sub.status === "cancelled") {
    return { allowed: false, reason: "Subscription is cancelled. Please renew to continue." };
  }
  if (sub.expiresAt && sub.expiresAt < new Date()) {
    return { allowed: false, reason: "Subscription has expired. Please renew to continue." };
  }

  if (action === "create_user") {
    const userCount = await prisma.user.count({ where: { orgId, active: true } });
    if (userCount >= sub.maxUsers) {
      return {
        allowed: false,
        reason: `User limit reached (${sub.maxUsers}). Upgrade your plan to add more users.`,
      };
    }
  }

  if (action === "create_sale") {
    // Count sales this month
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const salesThisMonth = await prisma.sale.count({
      where: { orgId, createdAt: { gte: startOfMonth } },
    });
    if (salesThisMonth >= sub.maxSalesMo) {
      return {
        allowed: false,
        reason: `Monthly sales limit reached (${sub.maxSalesMo}). Upgrade your plan for unlimited sales.`,
      };
    }
  }

  return { allowed: true };
}
