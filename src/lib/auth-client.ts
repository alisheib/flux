/**
 * Client-safe auth utilities.
 * These functions do NOT import next/headers and can be used in client components.
 */

// Role hierarchy: admin > manager > accountant > salesman
const roleHierarchy: Record<string, number> = {
  admin: 4,
  manager: 3,
  accountant: 2,
  salesman: 1,
};

export const ALL_ROLES = ["admin", "manager", "accountant", "salesman"] as const;

export const ALL_MODULES = [
  "dashboard",
  "pos",
  "inventory",
  "shipments",
  "invoices",
  "accounting",
  "reports",
  "tally",
  "users",
  "settings",
] as const;

export type RolePermissions = Record<string, string[]>;

// Default permissions (used when no custom permissions are set)
export const DEFAULT_PERMISSIONS: RolePermissions = {
  dashboard: ["admin", "manager", "accountant", "salesman"],
  shipments: ["admin", "manager"],
  inventory: ["admin", "manager", "salesman"],
  pos: ["admin", "manager", "salesman"],
  invoices: ["admin", "manager", "accountant"],
  accounting: ["admin", "accountant"],
  reports: ["admin", "manager", "accountant"],
  tally: ["admin", "accountant"],
  users: ["admin"],
  settings: ["admin"],
};

export function hasMinRole(userRole: string, requiredRole: string): boolean {
  return (roleHierarchy[userRole] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}

export function canAccessModule(
  role: string,
  module: string,
  customPermissions?: RolePermissions | null
): boolean {
  // Admin always has access to everything
  if (role === "admin") return true;

  const perms = customPermissions || DEFAULT_PERMISSIONS;
  return perms[module]?.includes(role) ?? false;
}
