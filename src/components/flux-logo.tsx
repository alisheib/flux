"use client";

import { cn } from "@/lib/utils";

interface FluxMarkProps {
  size?: number;
  tone?: "on-light" | "on-dark" | "solid-accent" | "mono-light";
  className?: string;
}

export function FluxMark({ size = 40, tone = "on-light", className }: FluxMarkProps) {
  const palettes = {
    "on-light": { bg: "#0f0e0a", stroke: "#d97706", glow: "#e39340" },
    "on-dark": { bg: "#d97706", stroke: "#0f0e0a", glow: "#2a271d" },
    "solid-accent": { bg: "#d97706", stroke: "#ffffff", glow: "#faead0" },
    "mono-light": { bg: "#ffffff", stroke: "#0f0e0a", glow: "#0f0e0a" },
  };
  const p = palettes[tone];
  const r = size * 0.28;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden="true"
    >
      <rect x="2" y="2" width="60" height="60" rx={r * 64 / size} ry={r * 64 / size} fill={p.bg} />
      <rect x="2" y="2" width="60" height="60" rx={r * 64 / size} ry={r * 64 / size}
        fill="url(#flux-sheen)" />
      <defs>
        <linearGradient id="flux-sheen" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,0.08)" />
          <stop offset="1" stopColor="rgba(0,0,0,0.08)" />
        </linearGradient>
      </defs>
      <g fill="none" stroke={p.stroke} strokeLinecap="round" strokeLinejoin="round" strokeWidth="7">
        <path d="M20 15 L20 49" />
        <path d="M20 15 L44 15" />
        <path d="M20 32 Q 32 32 38 32 T 50 40" />
      </g>
      <circle cx="50" cy="40" r="3" fill={p.glow} />
    </svg>
  );
}

export function FluxWordmark({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn("font-semibold tracking-[-0.04em] leading-none", className)}
      style={{ fontSize: size }}
    >
      FLUX
    </span>
  );
}

interface FluxLockupProps {
  size?: number;
  tone?: "on-light" | "on-dark" | "solid-accent" | "mono-light";
  tagline?: boolean | string;
  vertical?: boolean;
  className?: string;
}

export function FluxLockup({
  size = 40,
  tone = "on-light",
  tagline = false,
  vertical = false,
  className,
}: FluxLockupProps) {
  const wordSize = size * 0.5;
  const tagSize = size * 0.22;

  if (vertical) {
    return (
      <div className={cn("inline-flex flex-col items-center gap-2.5", className)}>
        <FluxMark size={size} tone={tone} />
        <FluxWordmark size={wordSize} />
        {tagline && (
          <span
            className="text-muted-foreground font-medium uppercase tracking-[0.12em]"
            style={{ fontSize: tagSize }}
          >
            {typeof tagline === "string" ? tagline : "Business Management Platform"}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("inline-flex items-center", className)} style={{ gap: size * 0.28 }}>
      <FluxMark size={size} tone={tone} />
      <div className="flex flex-col gap-0.5 leading-none">
        <FluxWordmark size={wordSize} />
        {tagline && (
          <span
            className="text-muted-foreground font-medium uppercase tracking-[0.10em] mt-0.5"
            style={{ fontSize: tagSize }}
          >
            {typeof tagline === "string" ? tagline : "Business Management Platform"}
          </span>
        )}
      </div>
    </div>
  );
}
