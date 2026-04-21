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
      <div className="text-center space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-red-500/12">
          <ShieldCheck className="size-8 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Invalid link</h1>
        <p className="text-sm text-muted-foreground">
          This password reset link is invalid or has expired.
        </p>
        <div className="pt-4">
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
      <div className="text-center space-y-4">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/12">
          <CheckCircle className="size-8 text-emerald-500" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Password reset!
        </h1>
        <p className="text-sm text-muted-foreground">
          Your password has been reset successfully. You can now sign in with
          your new password.
        </p>
        <div className="pt-4">
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

    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
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
      <div className="mb-6 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-[#d97706]/12">
          <ShieldCheck className="size-8 text-[#d97706]" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">
          Set new password
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your new password below.
        </p>
      </div>

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
              placeholder="At least 6 characters"
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

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12 bg-background">
      <div className="w-full max-w-[400px]">
        {/* Logo */}
        <div className="mb-8 flex justify-center">
          <FluxLockup size={36} tone="on-light" className="dark:hidden" />
          <FluxLockup size={36} tone="on-dark" className="hidden dark:inline-flex" />
        </div>

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
    </div>
  );
}
