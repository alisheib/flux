import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { normalizeCurrencyCode } from "@/lib/currency";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

// ─── Provider config ──────────────────────────────────────────────────
// We use open.er-api.com — the free, no-API-key endpoint of exchangerate-api.com.
// It refreshes once per day and supports ~160 currencies including TZS, KES,
// NGN, UGX, ZAR, GHS, plus the major fiat (USD/EUR/GBP/CNY/JPY/INR/AED).
const PROVIDER_BASE = "https://open.er-api.com/v6/latest";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours — rates only refresh daily anyway

// ─── In-memory cache ──────────────────────────────────────────────────
// One entry per base currency. This survives across requests within a single
// serverless instance; Vercel may spin up new instances, in which case the
// next call simply re-fetches — that's acceptable.

interface RatesCacheEntry {
  fetchedAt: number;
  rates: Record<string, number>;
  baseCode: string;
}

const ratesCache = new Map<string, RatesCacheEntry>();

async function fetchRates(base: string): Promise<RatesCacheEntry> {
  const cached = ratesCache.get(base);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached;
  }

  const res = await fetch(`${PROVIDER_BASE}/${base}`, {
    // Next 14-day server cache as defense-in-depth in case the in-memory cache
    // is cold on a new lambda instance.
    next: { revalidate: 21600 },
  });
  if (!res.ok) {
    throw new Error(`FX provider returned ${res.status}`);
  }
  const data = await res.json();
  if (data.result !== "success" || !data.rates) {
    throw new Error("FX provider returned invalid payload");
  }

  const entry: RatesCacheEntry = {
    fetchedAt: Date.now(),
    rates: data.rates,
    baseCode: data.base_code || base,
  };
  ratesCache.set(base, entry);
  return entry;
}

// GET /api/fx/latest?from=USD&to=TZS
// Returns { rate: number, base: string, target: string, fetchedAt: number, source: string }
//
// The endpoint is auth-gated to prevent random callers using FLUX to hit the
// rate-limited free provider on our behalf.
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const rawFrom = searchParams.get("from");
    const rawTo = searchParams.get("to");

    // Validate the raw params BEFORE normalization — normalize() helpfully
    // falls back to "USD" on null, which would mask a missing-arg bug.
    if (!rawFrom || !rawTo) {
      return NextResponse.json(
        { error: "Both 'from' and 'to' currency codes are required" },
        { status: 400 }
      );
    }

    const from = normalizeCurrencyCode(rawFrom);
    const to = normalizeCurrencyCode(rawTo);

    if (from === to) {
      return NextResponse.json({
        rate: 1,
        base: from,
        target: to,
        fetchedAt: Date.now(),
        source: "identity",
      });
    }

    // The provider expects a USD base on the free tier; from any other base it
    // still works, but we always anchor on the requested `from` to keep the math
    // straight and avoid compounding rounding.
    const entry = await fetchRates(from);
    const rate = entry.rates[to];
    if (typeof rate !== "number" || !isFinite(rate) || rate <= 0) {
      return NextResponse.json(
        { error: `No rate available for ${to} from ${from}` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      rate,
      base: entry.baseCode,
      target: to,
      fetchedAt: entry.fetchedAt,
      source: "open.er-api.com",
    });
  } catch (error) {
    console.error("GET /api/fx/latest error:", error);
    // Soft failure — the UI falls back to manual rate entry when this fails.
    return NextResponse.json(
      { error: "Failed to fetch exchange rate" },
      { status: 502 }
    );
  }
}
