"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  LogOut,
  User,
  Settings,
  ChevronRight,
  ChevronDown,
  Menu,
  Search,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/pos": "Point of Sale",
  "/inventory": "Inventory",
  "/shipments": "Shipments",
  "/invoices": "Invoices",
  "/proformas": "Proformas",
  "/accounting": "Accounting",
  "/receivables": "Receivables",
  "/customers": "Customers",
  "/suppliers": "Suppliers",
  "/purchase-orders": "Purchase Orders",
  "/reports": "Reports",
  "/tally": "TRA Tally",
  "/users": "Users",
  "/settings": "Settings",
  "/profile": "Profile",
  "/activity": "Activity",
  "/stock-movements": "Stock Movements",
  "/imports/templates": "Excel Import",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Try matching prefix for nested routes
  const base = "/" + pathname.split("/").filter(Boolean)[0];
  return pageTitles[base] || "Page";
}

/* ------------------------------------------------------------------ */
/*  Notification Bell                                                 */
/* ------------------------------------------------------------------ */

interface LowStockProduct {
  id: string;
  name: string;
  sku: string | null;
  stockQty: number;
  minStockQty: number;
  unit: string | null;
}

function NotificationBell() {
  const [lowStock, setLowStock] = useState<LowStockProduct[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.lowStockProducts) {
          setLowStock(data.lowStockProducts);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const count = lowStock.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-9">
          <Bell className="size-4" />
          {count > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-[#d97706] text-[10px] font-bold text-[#1a1813]">
              {count > 9 ? "9+" : count}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
          {count > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {count} alert{count !== 1 ? "s" : ""}
            </Badge>
          )}
        </div>
        {!loaded ? (
          <div className="flex items-center justify-center py-8">
            <div className="size-5 animate-spin rounded-full border-2 border-muted-foreground/20 border-t-muted-foreground" />
          </div>
        ) : count === 0 ? (
          <div className="px-4 py-8 text-center">
            <Bell className="mx-auto mb-3 size-10 text-muted-foreground/20" />
            <p className="text-sm font-medium text-muted-foreground">You&apos;re all caught up</p>
            <p className="mt-1 text-xs text-muted-foreground/50">No low-stock alerts right now</p>
          </div>
        ) : (
          <>
            <div className="max-h-72 overflow-y-auto">
              {lowStock.map((product) => (
                <div
                  key={product.id}
                  className="flex items-start gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-red-500/12">
                    <AlertTriangle className="size-4 text-red-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {product.name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {product.stockQty} {product.unit || "units"} remaining (min: {product.minStockQty})
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className="shrink-0 bg-red-500/12 text-red-600 dark:text-red-400 text-[10px]"
                  >
                    Low stock
                  </Badge>
                </div>
              ))}
            </div>
            <div className="border-t border-border px-4 py-2.5">
              <Link
                href="/inventory"
                className="block text-center text-xs font-medium text-[#d97706] hover:underline"
              >
                View all inventory
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

/* ------------------------------------------------------------------ */
/*  Header                                                            */
/* ------------------------------------------------------------------ */

export function AppHeader({ onMenuToggle, onSearch }: { onMenuToggle?: () => void; onSearch?: () => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const initials = (user.name || "?")
    .split(" ")
    .map((n) => n[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2) || "?";

  const pageTitle = getPageTitle(pathname);
  const orgName = user.orgName || "Workspace";

  async function handleLogout() {
    try {
      // Clear user-scoped cart data
      if (user?.userId) {
        try { localStorage.removeItem(`flux-pos-cart-${user.userId}`); } catch {}
      }
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      toast.error("Failed to log out");
      router.push("/login");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-border bg-background px-4 sm:px-6">
      {/* ── Left: Menu + Breadcrumb ──────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden size-9"
          onClick={onMenuToggle}
        >
          <Menu className="size-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>

        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm">
          <span className="hidden sm:inline text-[13px] text-muted-foreground">{orgName}</span>
          <ChevronRight className="hidden sm:block size-3.5 text-muted-foreground/40" />
          <span className="text-[16px] font-semibold tracking-tight text-foreground">{pageTitle}</span>
        </nav>
      </div>

      {/* ── Right: Actions ───────────────────────────────────── */}
      <div className="flex items-center gap-1">
        {/* Search button */}
        <Button
          variant="ghost"
          className="hidden sm:inline-flex h-9 gap-2 rounded-lg border border-border bg-muted/40 px-3 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          onClick={() => onSearch?.()}
        >
          <Search className="size-4" />
          <span className="text-xs">Search...</span>
          <kbd className="pointer-events-none ml-2 hidden select-none rounded border border-border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
            {typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent) ? "⌘K" : "Ctrl+K"}
          </kbd>
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="sm:hidden size-9"
          onClick={() => onSearch?.()}
        >
          <Search className="size-4" />
          <span className="sr-only">Search</span>
        </Button>

        {/* Notification bell */}
        <NotificationBell />

        {/* Theme toggle */}
        <ThemeToggle />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2.5 transition-colors hover:bg-accent ml-1"
            >
              <Avatar size="sm">
                <AvatarFallback className="bg-[#d97706]/15 text-xs font-semibold text-[#d97706]">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium text-foreground md:inline">
                {user.name}
              </span>
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1.5">
                <p className="text-sm font-medium leading-none">{user.name}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user.email}
                </p>
                <Badge
                  variant="secondary"
                  className="w-fit text-[10px] capitalize"
                >
                  {user.role}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <User className="size-4" />
                My Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push("/settings")}>
                <Settings className="size-4" />
                Settings
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} variant="destructive">
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
