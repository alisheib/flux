"use client";

import React, { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  Loader2,
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
                id="chart-grad"
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
              fill="url(#chart-grad)"
            />
          </svg>
        </div>

        {/* Trusted by */}
        <div className="mt-10 flex items-center gap-3">
          <span className="text-xs text-white/40">
            Trusted by import &amp; distribution businesses across East Africa
          </span>
        </div>
      </div>

      {/* Kente stripe */}
      <div className="stripe-accent relative z-10 h-[3px] w-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Login form                                                        */
/* ------------------------------------------------------------------ */

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Login failed");
        return;
      }

      toast.success(`Welcome back, ${data.user.name}!`);
      router.push(redirect);
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Email */}
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

      {/* Password */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className="text-sm font-medium">
            Password
          </Label>
          <Link
            href="/forgot-password"
            className="text-xs font-medium text-[#d97706] hover:underline underline-offset-4"
          >
            Forgot password?
          </Link>
        </div>
        <InputGroup className="h-10">
          <InputGroupAddon align="inline-start">
            <Lock className="size-4 text-muted-foreground" />
          </InputGroupAddon>
          <InputGroupInput
            id="password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            autoComplete="current-password"
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

      {/* Submit */}
      <Button
        type="submit"
        disabled={loading}
        className="btn-brand h-10 w-full rounded-lg text-sm font-semibold"
      >
        {loading ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            Sign in
            <ArrowRight className="size-4" />
          </>
        )}
      </Button>

      {/* Divider */}
      <div className="relative flex items-center py-1">
        <div className="flex-1 border-t border-border" />
        <span className="px-3 text-xs font-medium text-muted-foreground">OR</span>
        <div className="flex-1 border-t border-border" />
      </div>

      {/* Google */}
      <Button
        type="button"
        variant="outline"
        className="h-10 w-full rounded-lg text-sm font-medium"
        disabled={loading}
        onClick={() => {
          window.location.href = "/api/auth/google";
        }}
      >
        <svg className="size-4" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        Continue with Google
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* LEFT — Form side */}
      <div className="flex flex-col px-6 py-8 sm:px-12 lg:px-16">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <FluxLockup size={36} tone="on-light" className="dark:hidden" />
          <FluxLockup size={36} tone="on-dark" className="hidden dark:inline-flex" />
          <p className="text-sm text-muted-foreground">
            New to Flux?{" "}
            <Link
              href="/register"
              className="font-semibold text-[#d97706] underline-offset-4 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>

        {/* Center — form */}
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center">
          {/* Badge */}
          <div className="mb-6">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/60 px-3 py-1 text-xs font-medium text-foreground">
              <span className="inline-block size-1.5 rounded-full bg-[#d97706]" />
              Welcome back
            </span>
          </div>

          <h1 className="mb-2 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Sign in to your workspace.
          </h1>
          <p className="mb-8 text-sm leading-relaxed text-muted-foreground">
            Flux powers import, inventory, and sales for distributors across
            Africa.
          </p>

          <Suspense
            fallback={
              <div className="flex items-center justify-center py-16">
                <Loader2 className="size-6 animate-spin text-muted-foreground" />
              </div>
            }
          >
            <LoginForm />
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
