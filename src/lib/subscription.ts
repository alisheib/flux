// Subscription plan definitions
export const PLANS = {
  free: {
    name: "Free",
    price: 0,
    maxUsers: 1,
    maxSalesMo: 50,
    features: ["dashboard", "pos", "inventory", "invoices"],
    description: "For solo entrepreneurs getting started",
  },
  starter: {
    name: "Starter",
    price: 15,
    maxUsers: 3,
    maxSalesMo: 500,
    features: ["dashboard", "pos", "inventory", "invoices", "reports", "excel_export"],
    description: "For small teams with growing sales",
  },
  pro: {
    name: "Pro",
    price: 39,
    maxUsers: 10,
    maxSalesMo: -1, // unlimited
    features: [
      "dashboard", "pos", "inventory", "invoices", "reports",
      "excel_export", "shipments", "accounting", "tally", "whatsapp",
    ],
    description: "For established businesses with imports",
  },
  enterprise: {
    name: "Enterprise",
    price: 99,
    maxUsers: -1, // unlimited
    maxSalesMo: -1,
    features: [
      "dashboard", "pos", "inventory", "invoices", "reports",
      "excel_export", "shipments", "accounting", "tally", "whatsapp",
      "api_access", "custom_branding", "priority_support",
    ],
    description: "For large operations needing full control",
  },
} as const;

export type PlanId = keyof typeof PLANS;

export function getPlan(planId: string): (typeof PLANS)[PlanId] {
  return PLANS[planId as PlanId] || PLANS.free;
}

export function canUsePlanFeature(planId: string, feature: string): boolean {
  const plan = getPlan(planId);
  return (plan.features as readonly string[]).includes(feature);
}

export function getPlanLimits(planId: string) {
  const plan = getPlan(planId);
  return {
    maxUsers: plan.maxUsers,
    maxSalesMo: plan.maxSalesMo,
    unlimited: plan.maxSalesMo === -1,
  };
}
