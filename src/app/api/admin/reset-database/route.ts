import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("flux-token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const auth = await verifyToken(token);
    if (!auth || auth.role !== "admin") {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { password } = await request.json();
    if (!password) {
      return NextResponse.json({ error: "Password is required for confirmation" }, { status: 400 });
    }

    // Verify the admin's password
    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await verifyPassword(password, user.password);
    if (!valid) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    const orgId = auth.orgId;

    // Delete all org data in order (respecting foreign keys)
    await prisma.$transaction([
      prisma.auditLog.deleteMany({ where: { orgId } }),
      prisma.saleItem.deleteMany({ where: { sale: { orgId } } }),
      prisma.invoice.deleteMany({ where: { orgId } }),
      prisma.sale.deleteMany({ where: { orgId } }),
      prisma.shipmentExpense.deleteMany({ where: { orgId } }),
      prisma.shipmentItem.deleteMany({ where: { shipment: { orgId } } }),
      prisma.shipment.deleteMany({ where: { orgId } }),
      prisma.product.deleteMany({ where: { orgId } }),
      prisma.category.deleteMany({ where: { orgId } }),
      // Reset invoice/receipt counters
      prisma.orgSettings.updateMany({
        where: { orgId },
        data: { invoiceNextNum: 1, receiptNextNum: 1 },
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: "All business data has been reset. Users and settings are preserved.",
    });
  } catch (error) {
    console.error("Reset database error:", error);
    return NextResponse.json({ error: "Failed to reset database" }, { status: 500 });
  }
}
