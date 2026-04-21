"use client";

import React, { useState } from "react";
import { AuthProvider, type AuthUser } from "@/components/auth-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";

interface AppShellProps {
  user: AuthUser;
  children: React.ReactNode;
}

export function AppShell({ user, children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AuthProvider user={user}>
      <div className="flex h-screen overflow-hidden">
        {/* Desktop sidebar */}
        <div className="hidden md:block">
          <AppSidebar />
        </div>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <>
            <div
              className="fixed inset-0 z-40 bg-black/50 md:hidden"
              onClick={() => setMobileMenuOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-50 md:hidden">
              <AppSidebar onNavigate={() => setMobileMenuOpen(false)} />
            </div>
          </>
        )}

        <div className="flex flex-1 flex-col overflow-hidden">
          <AppHeader onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </AuthProvider>
  );
}
