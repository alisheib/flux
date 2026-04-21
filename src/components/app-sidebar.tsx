"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Ship,
  FileText,
  Calculator,
  BarChart3,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { canAccessModule, type RolePermissions } from "@/lib/auth-client";
import { useAuth } from "@/components/auth-provider";
import { FluxMark } from "@/components/flux-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Navigation config                                                 */
/* ------------------------------------------------------------------ */

interface NavItem {
  label: string;
  icon: React.ElementType;
  href: string;
  module: string;
}

const navItems: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/", module: "dashboard" },
  { label: "POS", icon: ShoppingCart, href: "/pos", module: "pos" },
  { label: "Inventory", icon: Package, href: "/inventory", module: "inventory" },
  { label: "Shipments", icon: Ship, href: "/shipments", module: "shipments" },
  { label: "Invoices", icon: FileText, href: "/invoices", module: "invoices" },
  { label: "Accounting", icon: Calculator, href: "/accounting", module: "accounting" },
  { label: "Reports", icon: BarChart3, href: "/reports", module: "reports" },
  { label: "Tally (TRA)", icon: Zap, href: "/tally", module: "tally" },
  { label: "Users", icon: Users, href: "/users", module: "users" },
  { label: "Settings", icon: Settings, href: "/settings", module: "settings" },
];

/* ------------------------------------------------------------------ */
/*  Sidebar                                                           */
/* ------------------------------------------------------------------ */

export function AppSidebar({ onNavigate }: { onNavigate?: () => void } = {}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [customPermissions, setCustomPermissions] = useState<RolePermissions | null>(null);
  const [tallyEnabled, setTallyEnabled] = useState(false);

  useEffect(() => {
    fetch("/api/settings/permissions")
      .then((res) => res.json())
      .then((data) => {
        if (data.permissions) setCustomPermissions(data.permissions);
      })
      .catch(() => { /* use defaults */ });

    fetch("/api/settings")
      .then((res) => res.json())
      .then((data) => {
        if (data.tallyEnabled !== undefined) setTallyEnabled(data.tallyEnabled);
      })
      .catch(() => { /* use default (false) */ });
  }, []);

  const filteredNav = navItems.filter((item) => {
    if (item.module === "tally" && !tallyEnabled) return false;
    return canAccessModule(user.role, item.module, customPermissions);
  });

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      toast.error("Failed to log out");
    }
  }

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "relative flex h-screen flex-col bg-[#0f0e0a] transition-all duration-300",
          collapsed ? "w-[72px]" : "w-[244px]"
        )}
      >
        {/* ── Logo ─────────────────────────────────────────────── */}
        <div
          className={cn(
            "flex h-16 shrink-0 items-center gap-3 border-b border-white/[0.06] px-5",
            collapsed && "justify-center px-0"
          )}
        >
          <FluxMark size={32} tone="solid-accent" />
          {!collapsed && (
            <span className="text-[15px] font-bold tracking-[-0.04em] text-white">
              FLUX
            </span>
          )}
        </div>

        {/* ── Collapse toggle ──────────────────────────────────── */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-5 z-20 flex size-6 items-center justify-center rounded-full border border-white/10 bg-[#1b1810] text-white/60 shadow-md transition-colors hover:bg-[#2a271d] hover:text-white"
        >
          {collapsed ? (
            <ChevronRight className="size-3" />
          ) : (
            <ChevronLeft className="size-3" />
          )}
        </button>

        {/* ── Section label ────────────────────────────────────── */}
        {!collapsed && (
          <div className="px-5 pt-5 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">
              Workspace
            </span>
          </div>
        )}
        {collapsed && <div className="pt-4" />}

        {/* ── Navigation ───────────────────────────────────────── */}
        <ScrollArea className="flex-1 px-2">
          <nav className="flex flex-col gap-0.5">
            {filteredNav.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              const linkContent = (
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors",
                    active
                      ? "text-[#ecb467]"
                      : "text-white/50 hover:bg-white/[0.05] hover:text-white/80",
                    collapsed && "justify-center px-0"
                  )}
                >
                  {/* Left accent bar */}
                  {active && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#d97706]" />
                  )}
                  <Icon className={cn("size-[18px] shrink-0", active && "text-[#d97706]")} />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.href}>
                    <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                    <TooltipContent
                      side="right"
                      className="border-white/10 bg-[#1b1810] text-white"
                    >
                      {item.label}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <React.Fragment key={item.href}>{linkContent}</React.Fragment>
              );
            })}
          </nav>
        </ScrollArea>

        {/* ── User footer ──────────────────────────────────────── */}
        <div
          className={cn(
            "shrink-0 border-t border-white/[0.06] p-3",
            collapsed && "flex flex-col items-center"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-3",
              collapsed && "flex-col gap-2"
            )}
          >
            <Avatar size="sm">
              <AvatarFallback className="bg-[#d97706]/20 text-xs font-semibold text-[#ecb467]">
                {initials}
              </AvatarFallback>
            </Avatar>

            {!collapsed && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <span className="truncate text-sm font-medium text-white/90">
                  {user.name}
                </span>
                <span className="truncate text-[11px] capitalize text-white/30">
                  {user.role}
                </span>
              </div>
            )}

            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={handleLogout}
                    className="text-white/30 hover:bg-white/[0.05] hover:text-red-400"
                  >
                    <LogOut className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent
                  side="right"
                  className="border-white/10 bg-[#1b1810] text-white"
                >
                  Logout
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={handleLogout}
                className="text-white/30 hover:bg-white/[0.05] hover:text-red-400"
              >
                <LogOut className="size-3.5" />
              </Button>
            )}
          </div>
        </div>

        {/* ── Kente stripe ─────────────────────────────────────── */}
        <div className="stripe-accent h-[3px] w-full shrink-0" />
      </aside>
    </TooltipProvider>
  );
}
