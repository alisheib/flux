"use client";

import React, { useState } from "react";
import { AuthProvider, type AuthUser, type OrgContext } from "@/components/auth-provider";
import { AppSidebar } from "@/components/app-sidebar";
import { AppHeader } from "@/components/app-header";
import { SessionGuard } from "@/components/session-guard";
import { Mail, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AppShellProps {
  user: AuthUser;
  org: OrgContext;
  children: React.ReactNode;
}

function VerifyBanner({ email }: { email: string }) {
  const [dismissed, setDismissed] = useState(false);
  const [resending, setResending] = useState(false);

  if (dismissed) return null;

  async function resendVerification() {
    setResending(true);
    try {
      const res = await fetch("/api/auth/verify-email", { method: "POST" });
      if (res.ok) {
        toast.success("Verification email sent! Check your inbox.");
      } else {
        toast.error("Failed to send verification email");
      }
    } catch {
      toast.error("Something went wrong");
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-sm dark:bg-amber-900/20 dark:border-amber-800">
      <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300">
        <Mail className="size-4 shrink-0" />
        <span>
          Please verify your email <strong>{email}</strong> to activate all features.
        </span>
        <button
          onClick={resendVerification}
          disabled={resending}
          className="ml-1 font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200 disabled:opacity-50"
        >
          {resending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="size-3 animate-spin" />
              Sending...
            </span>
          ) : (
            "Resend email"
          )}
        </button>
      </div>
      <button
        onClick={() => setDismissed(true)}
        className="text-amber-600 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-200"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

export function AppShell({ user, org, children }: AppShellProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <AuthProvider user={user} org={org}>
      <SessionGuard>
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
          {user.emailVerified === false && <VerifyBanner email={user.email} />}
          <AppHeader onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />
          <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">{children}</main>
        </div>
      </div>
      </SessionGuard>
    </AuthProvider>
  );
}
