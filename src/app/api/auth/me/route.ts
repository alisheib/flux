import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get("flux-token")?.value;

    if (!token) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const payload = await verifyToken(token);

    if (!payload) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    // Fetch fresh emailVerified status from DB
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { emailVerified: true },
    });

    return NextResponse.json({
      user: {
        userId: payload.userId,
        orgId: payload.orgId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
        emailVerified: user?.emailVerified ?? false,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }
}
