import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { sendVerificationEmail } from "@/lib/email";

// POST: Send verification email (or in dev mode, return token)
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("flux-token")?.value;
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const auth = await verifyToken(token);
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await prisma.user.findUnique({ where: { id: auth.userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    if (user.emailVerified) {
      return NextResponse.json({ message: "Email already verified" });
    }

    const verificationToken = crypto.randomBytes(32).toString("hex");

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationToken },
    });

    // Send verification email
    await sendVerificationEmail(user.email, user.name, verificationToken).catch((err) =>
      console.error("Failed to send verification email:", err)
    );

    return NextResponse.json({
      message: "Verification email sent",
    });
  } catch (error) {
    console.error("Verify email error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// GET: Verify email with token
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("token");
    if (!token) {
      return NextResponse.json({ error: "Token is required" }, { status: 400 });
    }

    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid verification token" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { emailVerified: true, verificationToken: null },
    });

    // Redirect to login with success message
    return NextResponse.redirect(new URL("/login?verified=true", request.url));
  } catch (error) {
    console.error("Email verification error:", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
