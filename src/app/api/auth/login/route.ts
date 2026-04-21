import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createToken } from "@/lib/auth";
import { sendLoginNotification } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    // Find user by email, include org
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { org: true },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      );
    }

    // Check user is active
    if (!user.active) {
      return NextResponse.json(
        { error: "Your account has been deactivated. Contact your administrator." },
        { status: 403 }
      );
    }

    // Create JWT token
    const token = await createToken({
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    // Update lastLogin
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    // Send login notification (non-blocking)
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || undefined;
    sendLoginNotification(user.email, user.name, ip || undefined).catch((err) =>
      console.error("Failed to send login notification:", err)
    );

    // Set cookie and return user info
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        orgName: user.org.name,
      },
    });

    response.cookies.set("flux-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
