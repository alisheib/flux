import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";

const jwtSecretRaw = process.env.JWT_SECRET || (process.env.NODE_ENV === "production" ? "" : "flux-dev-secret-key-not-for-production");
if (!jwtSecretRaw) {
  throw new Error("JWT_SECRET environment variable must be set in production");
}
const JWT_SECRET = new TextEncoder().encode(jwtSecretRaw);

const COOKIE_NAME = "flux-token";

export interface JWTPayload {
  userId: string;
  orgId: string;
  email: string;
  name: string;
  role: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createToken(payload: JWTPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(JWT_SECRET);
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<JWTPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// Role hierarchy: admin > manager > accountant > salesman
const roleHierarchy: Record<string, number> = {
  admin: 4,
  manager: 3,
  accountant: 2,
  salesman: 1,
};

export function hasMinRole(userRole: string, requiredRole: string): boolean {
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

export function canAccessModule(
  role: string,
  module: string,
  customPermissions?: Record<string, string[]> | null
): boolean {
  // Admin always has access to everything
  if (role === "admin") return true;

  const moduleAccess: Record<string, string[]> = customPermissions || {
    dashboard: ["admin", "manager", "accountant", "salesman"],
    shipments: ["admin", "manager"],
    inventory: ["admin", "manager", "salesman"],
    pos: ["admin", "manager", "salesman"],
    invoices: ["admin", "manager", "accountant"],
    accounting: ["admin", "accountant"],
    reports: ["admin", "manager", "accountant"],
    users: ["admin"],
    settings: ["admin"],
  };

  return moduleAccess[module]?.includes(role) ?? false;
}
