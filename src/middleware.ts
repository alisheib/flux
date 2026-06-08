import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const jwtSecretRaw = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "flux-dev-secret-key-not-for-production");
if (!jwtSecretRaw && typeof process !== "undefined" && process.env.NODE_ENV === "production") {
  console.error("FATAL: JWT_SECRET environment variable must be set in production");
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw || "flux-dev-secret-key-not-for-production");

const publicPaths = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/google",
  "/api/auth/google/callback",
  "/api/seed",
];

// ── Simple in-memory rate limiter for middleware (per-IP, mutation endpoints) ──
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 mutations per minute per IP

function checkRateLimit(ip: string): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const now = Date.now();
  const entry = rateLimitStore.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT_MAX;
}

// Cleanup every 2 minutes
if (typeof globalThis !== "undefined") {
  const cleanup = () => {
    const now = Date.now();
    for (const [k, v] of rateLimitStore) { if (now > v.resetAt) rateLimitStore.delete(k); }
  };
  setInterval(cleanup, 120_000);
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths (v2 - includes forgot/reset password + Google OAuth)
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return addSecurityHeaders(NextResponse.next());
  }
  // Also match exact paths
  if (publicPaths.includes(pathname)) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Allow static assets and _next
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return addSecurityHeaders(NextResponse.next());
  }

  // Rate limit mutation API requests (POST/PUT/DELETE)
  if (pathname.startsWith("/api/") && ["POST", "PUT", "DELETE", "PATCH"].includes(request.method)) {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }
  }

  // Check auth token
  const token = request.cookies.get("flux-token")?.value;

  if (!token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  try {
    await jwtVerify(token, JWT_SECRET);
    return addSecurityHeaders(NextResponse.next());
  } catch {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
