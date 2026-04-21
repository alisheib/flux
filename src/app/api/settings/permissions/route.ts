import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("flux-token")?.value;
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const auth = await verifyToken(token);
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await prisma.orgSettings.findUnique({
      where: { orgId: auth.orgId },
      select: { rolePermissions: true },
    });

    if (settings?.rolePermissions) {
      try {
        const perms = JSON.parse(settings.rolePermissions);
        return NextResponse.json({ permissions: perms });
      } catch {
        // Invalid JSON, fall through to defaults
      }
    }

    // Return null to indicate "use defaults"
    return NextResponse.json({ permissions: null });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
