"use client";

import React, { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  CheckCircle,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import { FluxLockup } from "@/components/flux-logo";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupButton,
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
                id="chart-grad-rp"
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
              fill="url(#chart-grad-rp)"
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
/*  Reset form (needs Suspense for useSearchParams)                   */
/* ------------------------------------------------------------------ */

function ResetForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-500/12">
          <ShieldCheck className="size-8 text-red-500" />
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">
          Invalid link
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          This password reset link is invalid or has expired.
        </p>
        <div className="pt-4 text-center">
          <Link
            href="/forgot-password"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[#d97706] hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/12">
          <CheckCircle className="size-8 text-emerald-500" />
        </div>
        <h1 className="text-center text-2xl font-bold text-foreground">
          Password reset!
        </h1>
        <p className="text-center text-sm text-muted-foreground">
          Your password has been reset successfully. You can now sign in with
          your new password.
        </p>
        <div className="pt-4 text-center">
          <Button
            onClick={() => router.push("/login")}
            className="btn-brand h-10 rounded-lg text-sm font-semibold"
          >
            Go to sign in
          </Button>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!password || !confirmPassword) {
      toast.error("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to reset password");
        return;
      }

      setSuccess(true);
      toast.success("Password reset successfully!");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Badge */}
      <div className="mb-6">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-foreground">
          <span className="inline-block size-1.5 rounded-full bg-[#d97706]" />
          Secure reset
        </span>
      </div>

      <div className="mb-2 flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-full bg-[#d97706]/12">
          <ShieldCheck className="size-6 text-[#d97706]" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Set new password
        </h1>
      </div>
      <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
        Choose a strong password for your account. Make sure it&apos;s at least 8
        characters long.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium">
            New password
          </Label>
          <InputGroup className="h-10">
            <InputGroupAddon align="inline-start">
              <Lock className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              autoFocus
              className="h-10"
            />
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex={-1}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </InputGroupButton>
            </InputGroupAddon>
          </InputGroup>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirm" className="text-sm font-medium">
            Confirm password
          </Label>
          <InputGroup className="h-10">
            <InputGroupAddon align="inline-start">
              <Lock className="size-4 text-muted-foreground" />
            </InputGroupAddon>
            <InputGroupInput
              id="confirm"
              type={showPassword ? "text" : "password"}
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
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
              Resetting...
            </>
          ) : (
            "Reset password"
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
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function ResetPasswordPage() {
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
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <ResetForm />
          </Suspense>
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
