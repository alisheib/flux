"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  Menu,
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
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const pageTitles: Record<string, string> = {
  "/": "Dashboard",
  "/pos": "Point of Sale",
  "/inventory": "Inventory",
  "/shipments": "Shipments",
  "/invoices": "Invoices",
  "/accounting": "Accounting",
  "/reports": "Reports",
  "/tally": "TRA Tally",
  "/users": "Users",
  "/settings": "Settings",
};

function getPageTitle(pathname: string): string {
  if (pageTitles[pathname]) return pageTitles[pathname];
  // Try matching prefix for nested routes
  const base = "/" + pathname.split("/").filter(Boolean)[0];
  return pageTitles[base] || "Page";
}

/* ------------------------------------------------------------------ */
/*  Header                                                            */
/* ------------------------------------------------------------------ */

export function AppHeader({ onMenuToggle }: { onMenuToggle?: () => void } = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();

  const initials = user.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const pageTitle = getPageTitle(pathname);
  const orgName = user.orgName || "Workspace";

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      toast.error("Failed to log out");
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-border bg-background px-3 sm:px-6">
      {/* ── Left: Menu + Breadcrumb ──────────────────────────── */}
      <div className="flex items-center gap-2">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMenuToggle}
        >
          <Menu className="size-5" />
          <span className="sr-only">Toggle menu</span>
        </Button>
        <nav className="flex items-center gap-1.5 text-sm">
          <span className="hidden sm:inline font-medium text-muted-foreground">{orgName}</span>
          <ChevronRight className="hidden sm:block size-3.5 text-muted-foreground/50" />
          <span className="font-semibold text-foreground">{pageTitle}</span>
        </nav>
      </div>

      {/* Spacer */}
      <div className="hidden md:block" />

      {/* ── Right: Actions ───────────────────────────────────── */}
      <div className="flex items-center gap-1.5">
        {/* Theme toggle */}
        <ThemeToggle />

        {/* Notification bell */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="size-4" />
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel>Notifications</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="px-3 py-6 text-center">
              <Bell className="mx-auto mb-2 size-8 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">No recent notifications</p>
              <p className="text-xs text-muted-foreground/60 mt-1">You&apos;re all caught up</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-2.5 transition-colors hover:bg-accent"
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
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} variant="destructive">
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
