import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createToken } from "@/lib/auth";
import { sendVerificationEmail, sendWelcomeEmail } from "@/lib/email";
import crypto from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orgName, name, email, password, phone } = body;

    if (!orgName || !name || !email || !password) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }
    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain uppercase, lowercase, number, and special character" },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    // Check if email already in use
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create Organization, User, OrgSettings, and default Categories in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create Organization
      const org = await tx.organization.create({
        data: {
          name: orgName.trim(),
          phone: phone?.trim() || null,
        },
      });

      // Generate email verification token
      const verificationToken = crypto.randomBytes(32).toString("hex");

      // Create admin User
      const user = await tx.user.create({
        data: {
          orgId: org.id,
          email: email.toLowerCase().trim(),
          password: hashedPassword,
          name: name.trim(),
          role: "admin",
          emailVerified: false,
          verificationToken,
          lastLogin: new Date(),
        },
      });

      // Create default OrgSettings
      await tx.orgSettings.create({
        data: {
          orgId: org.id,
        },
      });

      // Create default categories
      const defaultCategories = ["Glass", "Tools", "Accessories", "Other"];
      for (const catName of defaultCategories) {
        await tx.category.create({
          data: {
            orgId: org.id,
            name: catName,
          },
        });
      }

      // Create free subscription
      await tx.subscription.create({
        data: {
          orgId: org.id,
          plan: "free",
          status: "active",
          maxUsers: 1,
          maxSalesMo: 50,
        },
      });

      return { org, user };
    });

    // Send verification email (non-blocking)
    const verificationToken = result.user.verificationToken;
    if (verificationToken) {
      sendVerificationEmail(result.user.email, result.user.name, verificationToken).catch((err) =>
        console.error("Failed to send verification email:", err)
      );
    }

    // Send welcome email (non-blocking)
    sendWelcomeEmail(result.user.email, result.user.name, result.org.name).catch((err) =>
      console.error("Failed to send welcome email:", err)
    );

    // Create JWT token — allow login immediately but mark as unverified
    const token = await createToken({
      userId: result.user.id,
      orgId: result.org.id,
      email: result.user.email,
      name: result.user.name,
      role: result.user.role,
    });

    // Set cookie and return success
    const response = NextResponse.json({
      success: true,
      emailVerified: false,
      user: {
        id: result.user.id,
        name: result.user.name,
        email: result.user.email,
        role: result.user.role,
        orgName: result.org.name,
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
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
