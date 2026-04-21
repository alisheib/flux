"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Mail, ArrowLeft, Loader2, CheckCircle, KeyRound } from "lucide-react";
import { FluxLockup } from "@/components/flux-logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [resetLink, setResetLink] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email) {
      toast.error("Please enter your email address");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Something went wrong");
        return;
      }

      setSent(true);

      // In dev mode, show the reset link directly
      if (data.resetToken) {
        const link = `${window.location.origin}/reset-password?token=${data.resetToken}`;
        setResetLink(link);
      }

      toast.success("Reset instructions sent!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <FluxLockup size={36} tone="on-light" className="dark:hidden" />
          <FluxLockup size={36} tone="on-dark" className="hidden dark:inline-flex" />
        </div>

        {sent ? (
          /* Success state */
          <div className="text-center space-y-4">
            <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/12">
              <CheckCircle className="size-8 text-emerald-500" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Check your email</h1>
            <p className="text-sm text-muted-foreground">
              If an account exists for <strong>{email}</strong>, we&apos;ve sent
              password reset instructions.
            </p>

            {/* Dev mode: show reset link */}
            {resetLink && (
              <div className="mt-6 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-left">
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2">
                  Dev Mode — Reset Link:
                </p>
                <Link
                  href={resetLink}
                  className="text-xs text-[#d97706] underline break-all"
                >
                  {resetLink}
                </Link>
              </div>
            )}

            <div className="pt-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-[#d97706] hover:underline"
              >
                <ArrowLeft className="size-4" />
                Back to sign in
              </Link>
            </div>
          </div>
        ) : (
          /* Form state */
          <>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[#d97706]/12">
                <KeyRound className="size-8 text-[#d97706]" />
              </div>
              <h1 className="text-2xl font-bold text-foreground">
                Forgot your password?
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email address
                </Label>
                <InputGroup className="h-10">
                  <InputGroupAddon align="inline-start">
                    <Mail className="size-4 text-muted-foreground" />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={loading}
                    autoComplete="email"
                    autoFocus
                    className="h-10"
                  />
                </InputGroup>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="btn-brand h-10 w-full rounded-lg text-sm font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send reset link"
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="size-4" />
                Back to sign in
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
