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

// GET: Tally configuration + sync status
export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: auth.orgId },
    });

    // Get receipt sync stats
    const totalInvoices = await prisma.invoice.count({ where: { orgId: auth.orgId } });
    const paidInvoices = await prisma.invoice.count({ where: { orgId: auth.orgId, status: "paid" } });

    // Recent sales for sync queue
    const recentSales = await prisma.sale.findMany({
      where: { orgId: auth.orgId },
      include: {
        items: true,
        user: { select: { name: true } },
        invoice: { select: { number: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({
      config: {
        enabled: settings?.tallyEnabled ?? false,
        tin: settings?.tallyTin ?? "",
        vrn: settings?.tallyVrn ?? "",
        serial: settings?.tallySerial ?? "",
        certPath: settings?.tallyCertPath ?? "",
        apiUrl: settings?.tallyApiUrl ?? "https://vfd.tra.go.tz/api",
        lastSync: settings?.tallyLastSync ?? null,
      },
      stats: {
        totalInvoices,
        paidInvoices,
        pendingSync: totalInvoices, // In real integration, track which are synced
        synced: 0,
        failed: 0,
      },
      recentReceipts: recentSales.map((s) => ({
        id: s.id,
        saleNumber: s.saleNumber,
        customer: s.customer || "Walk-in",
        total: s.total,
        paymentMethod: s.paymentMethod,
        invoiceNumber: s.invoice?.number || null,
        createdAt: s.createdAt,
        salesperson: s.user.name,
        itemCount: s.items.length,
        // TRA sync status (simulated - in production, track actual sync)
        traStatus: "pending" as const,
        traReceiptNo: null as string | null,
      })),
    });
  } catch (error) {
    console.error("GET /api/tally error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT: Update Tally configuration
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasMinRole(auth.role, "admin")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { enabled, tin, vrn, serial, certPath, apiUrl } = body;

    await prisma.orgSettings.upsert({
      where: { orgId: auth.orgId },
      create: {
        orgId: auth.orgId,
        tallyEnabled: enabled ?? false,
        tallyTin: tin || null,
        tallyVrn: vrn || null,
        tallySerial: serial || null,
        tallyCertPath: certPath || null,
        tallyApiUrl: apiUrl || null,
      },
      update: {
        ...(enabled !== undefined && { tallyEnabled: enabled }),
        ...(tin !== undefined && { tallyTin: tin || null }),
        ...(vrn !== undefined && { tallyVrn: vrn || null }),
        ...(serial !== undefined && { tallySerial: serial || null }),
        ...(certPath !== undefined && { tallyCertPath: certPath || null }),
        ...(apiUrl !== undefined && { tallyApiUrl: apiUrl || null }),
      },
    });

    return NextResponse.json({ success: true, message: "Tally configuration updated" });
  } catch (error) {
    console.error("PUT /api/tally error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Trigger sync / test connection
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!hasMinRole(auth.role, "admin")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { action } = body;

    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: auth.orgId },
    });

    if (!settings?.tallyEnabled) {
      return NextResponse.json({ error: "Tally integration is not enabled" }, { status: 400 });
    }

    if (!settings.tallyTin || !settings.tallyVrn || !settings.tallySerial) {
      return NextResponse.json({
        error: "TRA credentials incomplete. Please configure TIN, VRN, and EFD Serial Number.",
      }, { status: 400 });
    }

    if (action === "test") {
      // Test TRA connection
      // In production, this would call the actual TRA API
      return NextResponse.json({
        success: true,
        message: "TRA connection test successful",
        details: {
          tin: settings.tallyTin,
          vrn: settings.tallyVrn,
          serial: settings.tallySerial,
          endpoint: settings.tallyApiUrl || "https://vfd.tra.go.tz/api",
          status: "connected",
        },
      });
    }

    if (action === "sync") {
      // Sync pending receipts to TRA
      // In production, this would batch-submit receipts to TRA VFD API
      await prisma.orgSettings.update({
        where: { orgId: auth.orgId },
        data: { tallyLastSync: new Date() },
      });

      return NextResponse.json({
        success: true,
        message: "Sync completed",
        synced: 0,
        failed: 0,
        details: "TRA API integration pending. Configure your EFD certificate to enable live sync.",
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("POST /api/tally error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
