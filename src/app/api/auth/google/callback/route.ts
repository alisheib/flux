import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { createToken, setSessionCookie, hashPassword } from "@/lib/auth";
import crypto from "crypto";

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      new URL("/login?error=google_not_configured", request.url)
    );
  }

  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(
      new URL("/login?error=google_denied", request.url)
    );
  }

  try {
    const origin = request.nextUrl.origin;
    const redirectUri = `${origin}/api/auth/google/callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=google_token_failed", request.url)
      );
    }

    const tokenData: GoogleTokenResponse = await tokenRes.json();

    // Get user info
    const userInfoRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } }
    );

    if (!userInfoRes.ok) {
      return NextResponse.redirect(
        new URL("/login?error=google_userinfo_failed", request.url)
      );
    }

    const googleUser: GoogleUserInfo = await userInfoRes.json();

    if (!googleUser.email) {
      return NextResponse.redirect(
        new URL("/login?error=no_email", request.url)
      );
    }

    // Find or create user
    let user = await prisma.user.findUnique({
      where: { email: googleUser.email },
      include: { org: true },
    });

    if (!user) {
      // Create new org + user for Google sign-in
      const randomPassword = crypto.randomBytes(32).toString("hex");
      const hashedPassword = await hashPassword(randomPassword);

      const result = await prisma.$transaction(async (tx) => {
        const org = await tx.organization.create({
          data: {
            name: `${googleUser.name}'s Organization`,
            currency: "USD",
          },
        });

        await tx.orgSettings.create({
          data: { orgId: org.id },
        });

        // Create default categories
        const defaultCategories = ["Glass", "Tools", "Accessories", "Other"];
        for (const catName of defaultCategories) {
          await tx.category.create({
            data: { orgId: org.id, name: catName },
          });
        }

        // Create subscription (free plan)
        await tx.subscription.create({
          data: {
            orgId: org.id,
            plan: "free",
            status: "active",
            maxUsers: 3,
            maxSalesMo: 50,
            features: JSON.stringify(["pos", "inventory", "invoices"]),
          },
        });

        const newUser = await tx.user.create({
          data: {
            orgId: org.id,
            email: googleUser.email,
            password: hashedPassword,
            name: googleUser.name || googleUser.email.split("@")[0],
            role: "admin",
            avatar: googleUser.picture || null,
            lastLogin: new Date(),
          },
          include: { org: true },
        });

        return newUser;
      });

      user = result;
    } else {
      if (!user.active) {
        return NextResponse.redirect(
          new URL("/login?error=account_disabled", request.url)
        );
      }

      // Update last login and avatar
      await prisma.user.update({
        where: { id: user.id },
        data: {
          lastLogin: new Date(),
          avatar: googleUser.picture || user.avatar,
        },
      });
    }

    // Create JWT and set session
    const token = await createToken({
      userId: user.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    await setSessionCookie(token);

    return NextResponse.redirect(new URL("/", request.url));
  } catch (error) {
    console.error("Google OAuth error:", error);
    return NextResponse.redirect(
      new URL("/login?error=google_failed", request.url)
    );
  }
}
