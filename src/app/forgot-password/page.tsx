"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Mail,
  ArrowLeft,
  Loader2,
  CheckCircle,
  KeyRound,
  TrendingUp,
} from "lucide-react";
import { FluxLockup } from "@/components/flux-logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { toast } from "sonner";

/* ------------------------------------------------------------------ */
/*  Hero panel (right side) — shared visual                           */
/* ------------------------------------------------------------------ */

function HeroPanel() {
  return (
    <div className="relative hidden h-screen flex-col justify-between overflow-hidden lg:flex">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0f0e0a] via-[#1a150a] to-[#2a1f0a]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_70%_40%,rgba(217,119,6,0.18),transparent_70%)]" />
      {/* Dot pattern */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-1 flex-col justify-center px-12 xl:px-16">
        <span className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-300/90">
          Built for Africa
        </span>
        <h2 className="mb-4 max-w-md text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
          The current that moves your business forward.
        </h2>
        <p className="mb-10 max-w-sm text-sm leading-relaxed text-white/50">
          From Dar to Dakar — import, warehouse, and sell with precision.
        </p>

        {/* Glass card */}
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium text-white/50">
              Today&apos;s revenue
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[11px] font-semibold text-emerald-400">
              <TrendingUp className="size-3" />
              +18.4%
            </span>
          </div>
          <p className="mb-3 text-2xl font-bold tracking-tight text-white">
            TSh 4,892,000
          </p>
          {/* Mini chart SVG */}
          <svg viewBox="0 0 200 40" className="h-10 w-full">
            <defs>
              <linearGradient
                id="chart-grad-fp"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop offset="0" stopColor="#d97706" stopOpacity="0.3" />
                <stop offset="1" stopColor="#d97706" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path
              d="M0 35 Q20 30 40 28 T80 20 T120 22 T160 12 T200 8"
              fill="none"
              stroke="#d97706"
              strokeWidth="2"
            />
            <path
              d="M0 35 Q20 30 40 28 T80 20 T120 22 T160 12 T200 8 V40 H0 Z"
              fill="url(#chart-grad-fp)"
            />
          </svg>
        </div>

        {/* Social proof */}
        <div className="mt-10 flex items-center gap-3">
          <div className="flex -space-x-2">
            {["bg-amber-500", "bg-emerald-500", "bg-sky-500", "bg-violet-500"].map(
              (bg, i) => (
                <div
                  key={i}
                  className={`flex size-7 items-center justify-center rounded-full ring-2 ring-[#0f0e0a] text-[10px] font-bold text-white ${bg}`}
                >
                  {["AK", "JM", "FO", "SN"][i]}
                </div>
              )
            )}
          </div>
          <span className="text-xs text-white/40">
            2,400+ businesses across 14 African markets
          </span>
        </div>
      </div>

      {/* Kente stripe */}
      <div className="stripe-accent relative z-10 h-[3px] w-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

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
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT — Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <FluxLockup size={36} tone="on-light" className="dark:hidden" />
          <FluxLockup size={36} tone="on-dark" className="hidden dark:inline-flex" />
          <p className="text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link
              href="/login"
              className="font-semibold text-[#d97706] underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>

        {/* Center — form */}
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-8">
          {sent ? (
            /* Success state */
            <div className="space-y-4">
              <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/12">
                <CheckCircle className="size-8 text-emerald-500" />
              </div>
              <h1 className="text-center text-2xl font-bold text-foreground">
                Check your email
              </h1>
              <p className="text-center text-sm text-muted-foreground">
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

              <div className="pt-4 text-center">
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
              {/* Badge */}
              <div className="mb-6">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-foreground">
                  <span className="inline-block size-1.5 rounded-full bg-[#d97706]" />
                  Password recovery
                </span>
              </div>

              <div className="mb-2 flex items-center gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-[#d97706]/12">
                  <KeyRound className="size-6 text-[#d97706]" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                  Forgot your password?
                </h1>
              </div>
              <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
                No worries — enter your email and we&apos;ll send you a link to
                reset your password.
              </p>

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

        {/* Footer */}
        <div className="flex items-center justify-between text-xs text-muted-foreground/60">
          <span>&copy; 2026 Flux Systems</span>
          <span>Powered by Ali Sheib</span>
        </div>
      </div>

      {/* RIGHT — Hero panel */}
      <HeroPanel />
    </div>
  );
}
