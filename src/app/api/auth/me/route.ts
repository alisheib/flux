import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

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

    return NextResponse.json({
      user: {
        userId: payload.userId,
        orgId: payload.orgId,
        email: payload.email,
        name: payload.name,
        role: payload.role,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Not authenticated" },
      { status: 401 }
    );
  }
}
