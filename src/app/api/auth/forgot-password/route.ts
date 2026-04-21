import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user || !user.active) {
      return NextResponse.json({
        message:
          "If an account with that email exists, a reset link has been generated.",
      });
    }

    // Generate a secure random token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: { resetToken, resetTokenExpiry },
    });

    // In production, you would send an email here.
    // For now, return the token so the admin can share the link.
    return NextResponse.json({
      message:
        "If an account with that email exists, a reset link has been generated.",
      // Only include token in development for testing
      ...(process.env.NODE_ENV !== "production" && { resetToken }),
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
