"use client";

import { useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const WARNING_BEFORE = 2 * 60 * 1000; // Warn 2 minutes before

export function SessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const warningRef = useRef<NodeJS.Timeout | null>(null);
  const warningShownRef = useRef(false);

  const logout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    toast.error("Session expired", { description: "You've been logged out due to inactivity.", duration: 8000 });
    router.push("/login");
  }, [router]);

  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (warningRef.current) clearTimeout(warningRef.current);
    warningShownRef.current = false;

    // Set warning timer (28 min)
    warningRef.current = setTimeout(() => {
      if (!warningShownRef.current) {
        warningShownRef.current = true;
        toast.warning("Session expiring soon", {
          description: "You'll be logged out in 2 minutes due to inactivity. Move your mouse or press a key to stay signed in.",
          duration: 15000,
        });
      }
    }, INACTIVITY_TIMEOUT - WARNING_BEFORE);

    // Set logout timer (30 min)
    timerRef.current = setTimeout(logout, INACTIVITY_TIMEOUT);
  }, [logout]);

  useEffect(() => {
    const events = ["mousedown", "keydown", "scroll", "touchstart", "mousemove"];

    const handleActivity = () => {
      resetTimer();
    };

    // Start the timer
    resetTimer();

    // Listen for user activity
    events.forEach((event) => window.addEventListener(event, handleActivity, { passive: true }));

    // Also check JWT expiry periodically (every 5 min)
    const tokenCheckInterval = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          clearInterval(tokenCheckInterval);
          toast.error("Session expired", { description: "Your session has ended. Please sign in again.", duration: 8000 });
          router.push("/login");
        }
      } catch { /* network error, ignore */ }
    }, 5 * 60 * 1000);

    return () => {
      events.forEach((event) => window.removeEventListener(event, handleActivity));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      clearInterval(tokenCheckInterval);
    };
  }, [resetTimer, router]);

  return <>{children}</>;
}
