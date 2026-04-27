import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
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

    if (!hasMinRole(auth.role, "accountant")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all sales for this org that have outstanding balances
    // A sale has an outstanding balance when total > sum(payments)
    const sales = await prisma.sale.findMany({
      where: { orgId: auth.orgId },
      include: {
        payments: true,
        items: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Group sales by customer and compute AR data
    const customerMap = new Map<
      string,
      {
        name: string;
        phone: string | null;
        email: string | null;
        sales: typeof sales;
        totalOwed: number;
        lastPayment: Date | null;
        oldestUnpaidDate: Date | null;
        transactionCount: number;
      }
    >();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    let totalOutstanding = 0;
    let overdueAmount = 0;
    let overdueCount = 0;
    let collectedThisMonth = 0;

    // Aging buckets: [0-30, 31-60, 61-90, 90+]
    const agingBuckets = [
      { label: "0-30 days", amount: 0, count: 0 },
      { label: "31-60 days", amount: 0, count: 0 },
      { label: "61-90 days", amount: 0, count: 0 },
      { label: "90+ days", amount: 0, count: 0 },
    ];

    for (const sale of sales) {
      const paidAmount = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      const outstanding = Math.round((sale.total - paidAmount) * 100) / 100;

      if (outstanding <= 0) continue; // Fully paid, skip for AR

      const customerKey = sale.customer || "Walk-in Customer";

      // Aging bucket calculation
      const daysSinceSale = Math.floor(
        (now.getTime() - sale.createdAt.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysSinceSale <= 30) {
        agingBuckets[0].amount += outstanding;
        agingBuckets[0].count += 1;
      } else if (daysSinceSale <= 60) {
        agingBuckets[1].amount += outstanding;
        agingBuckets[1].count += 1;
      } else if (daysSinceSale <= 90) {
        agingBuckets[2].amount += outstanding;
        agingBuckets[2].count += 1;
      } else {
        agingBuckets[3].amount += outstanding;
        agingBuckets[3].count += 1;
      }

      totalOutstanding += outstanding;

      // Overdue = more than 30 days since sale with outstanding balance
      const isOverdue = daysSinceSale > 30;
      if (isOverdue) {
        overdueAmount += outstanding;
        overdueCount += 1;
      }

      // Build customer map
      if (!customerMap.has(customerKey)) {
        customerMap.set(customerKey, {
          name: customerKey,
          phone: sale.customerPhone,
          email: sale.customerEmail,
          sales: [],
          totalOwed: 0,
          lastPayment: null,
          oldestUnpaidDate: null,
          transactionCount: 0,
        });
      }

      const entry = customerMap.get(customerKey)!;
      entry.sales.push(sale);
      entry.totalOwed += outstanding;
      entry.transactionCount += 1;

      // Track oldest unpaid sale date
      if (!entry.oldestUnpaidDate || sale.createdAt < entry.oldestUnpaidDate) {
        entry.oldestUnpaidDate = sale.createdAt;
      }

      // Track most recent payment for this customer
      for (const payment of sale.payments) {
        if (!entry.lastPayment || payment.date > entry.lastPayment) {
          entry.lastPayment = payment.date;
        }
      }

      // Update phone/email if available (prefer non-null)
      if (sale.customerPhone && !entry.phone) entry.phone = sale.customerPhone;
      if (sale.customerEmail && !entry.email) entry.email = sale.customerEmail;
    }

    // Calculate collected this month from all payments
    const monthPayments = await prisma.payment.findMany({
      where: {
        orgId: auth.orgId,
        date: { gte: startOfMonth },
      },
    });
    collectedThisMonth = monthPayments.reduce((sum, p) => sum + p.amount, 0);

    // Build customers array
    const customers = Array.from(customerMap.values()).map((entry) => {
      const oldestDays = entry.oldestUnpaidDate
        ? Math.floor(
            (now.getTime() - entry.oldestUnpaidDate.getTime()) /
              (1000 * 60 * 60 * 24)
          )
        : 0;

      // Determine status
      let status: "overdue" | "current" | "paid";
      if (entry.totalOwed <= 0) {
        status = "paid";
      } else if (oldestDays > 30) {
        status = "overdue";
      } else {
        status = "current";
      }

      return {
        name: entry.name,
        phone: entry.phone,
        email: entry.email,
        totalOwed: Math.round(entry.totalOwed * 100) / 100,
        lastPayment: entry.lastPayment,
        status,
        oldestDebt: oldestDays,
        transactionCount: entry.transactionCount,
      };
    });

    // Sort: overdue first, then by totalOwed descending
    customers.sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (b.status === "overdue" && a.status !== "overdue") return 1;
      return b.totalOwed - a.totalOwed;
    });

    // Round aging bucket amounts
    for (const bucket of agingBuckets) {
      bucket.amount = Math.round(bucket.amount * 100) / 100;
    }

    return NextResponse.json({
      customers,
      totals: {
        totalOutstanding: Math.round(totalOutstanding * 100) / 100,
        overdueAmount: Math.round(overdueAmount * 100) / 100,
        overdueCount,
        collectedThisMonth: Math.round(collectedThisMonth * 100) / 100,
      },
      agingBuckets,
    });
  } catch (error) {
    console.error("GET /api/receivables error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
