import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get org + settings together
    const org = await prisma.organization.findUnique({
      where: { id: auth.orgId },
      include: { settings: true },
    });

    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    const defaultSettings = {
      defaultMargin: 10,
      secondaryMargin: 5,
      exchangeRate: 2630,
      invoicePrefix: "INV",
      invoiceNextNum: 1,
      receiptPrefix: "RCP",
      receiptNextNum: 1,
      rolePermissions: null as string | null,
    };

    return NextResponse.json({
      organization: {
        id: org.id,
        name: org.name,
        logo: org.logo,
        currency: org.currency,
        locale: org.locale,
        taxRate: org.taxRate,
        taxLabel: org.taxLabel,
        address: org.address,
        phone: org.phone,
        email: org.email,
        website: org.website,
      },
      settings: org.settings || defaultSettings,
      tallyEnabled: org.settings?.tallyEnabled ?? false,
    });
  } catch (error) {
    console.error("GET /api/settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(auth.role, "admin")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const body = await request.json();
    const { organization, settings } = body;

    // Update organization fields
    if (organization) {
      const {
        name,
        logo,
        currency,
        locale,
        taxRate,
        taxLabel,
        address,
        phone,
        email,
        website,
      } = organization;

      await prisma.organization.update({
        where: { id: auth.orgId },
        data: {
          ...(name !== undefined && { name }),
          ...(logo !== undefined && { logo }),
          ...(currency !== undefined && { currency }),
          ...(locale !== undefined && { locale }),
          ...(taxRate !== undefined && { taxRate }),
          ...(taxLabel !== undefined && { taxLabel }),
          ...(address !== undefined && { address }),
          ...(phone !== undefined && { phone }),
          ...(email !== undefined && { email }),
          ...(website !== undefined && { website }),
        },
      });
    }

    // Upsert org settings
    if (settings) {
      const {
        defaultMargin,
        secondaryMargin,
        exchangeRate,
        invoicePrefix,
        invoiceNextNum,
        receiptPrefix,
        receiptNextNum,
        rolePermissions,
        tallyEnabled,
      } = settings;

      const updateData: Record<string, unknown> = {};
      if (defaultMargin !== undefined) updateData.defaultMargin = defaultMargin;
      if (secondaryMargin !== undefined) updateData.secondaryMargin = secondaryMargin;
      if (exchangeRate !== undefined) updateData.exchangeRate = exchangeRate;
      if (invoicePrefix !== undefined) updateData.invoicePrefix = invoicePrefix;
      if (invoiceNextNum !== undefined) updateData.invoiceNextNum = invoiceNextNum;
      if (receiptPrefix !== undefined) updateData.receiptPrefix = receiptPrefix;
      if (receiptNextNum !== undefined) updateData.receiptNextNum = receiptNextNum;
      if (rolePermissions !== undefined) {
        updateData.rolePermissions = typeof rolePermissions === "string"
          ? rolePermissions
          : JSON.stringify(rolePermissions);
      }
      if (tallyEnabled !== undefined) updateData.tallyEnabled = tallyEnabled;

      await prisma.orgSettings.upsert({
        where: { orgId: auth.orgId },
        create: {
          orgId: auth.orgId,
          ...updateData,
        },
        update: updateData,
      });
    }

    // Return updated data
    const org = await prisma.organization.findUnique({
      where: { id: auth.orgId },
      include: { settings: true },
    });

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "update", entity: "settings", details: "Updated organization settings" });

    return NextResponse.json({
      organization: {
        id: org!.id,
        name: org!.name,
        logo: org!.logo,
        currency: org!.currency,
        locale: org!.locale,
        taxRate: org!.taxRate,
        taxLabel: org!.taxLabel,
        address: org!.address,
        phone: org!.phone,
        email: org!.email,
        website: org!.website,
      },
      settings: org!.settings,
      tallyEnabled: org!.settings?.tallyEnabled ?? false,
    });
  } catch (error) {
    console.error("PUT /api/settings error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
