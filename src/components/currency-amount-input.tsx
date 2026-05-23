"use client";

// ─── CurrencyAmountInput ───────────────────────────────────────────────
// Reusable money-entry control used wherever the user inputs a price.
//
// What it does:
//   • Default state: a single amount field, interpreted as the organization's
//     base currency (org currency).
//   • A subtle "Enter in another currency" toggle lets the user expand a
//     foreign-currency entry block. They pick their source currency, fill in
//     the amount in that currency, and either:
//       (a) accept the auto-fetched exchange rate from /api/fx/latest, or
//       (b) override the rate manually.
//     The converted org-currency value is computed live and returned via
//     `onChange` — the parent only ever stores the converted (base-currency)
//     number, matching the existing DB schema (no migrations needed).
//
// Why this shape:
//   • Storing a single canonical amount in org currency keeps all downstream
//     reports, P&L math, and existing rows consistent. No double-bookkeeping.
//   • The two-input pattern (currency + rate) satisfies the user's "must be
//     mandatory if entering a foreign price" requirement without polluting
//     every API contract with currency metadata.
//   • Falling back to manual rate entry when the FX API is unreachable means
//     the form never blocks the user — the rate field becomes a required
//     numeric input instead.
//
// Validation contract (parent must enforce):
//   • If `isForeignCurrencyValid()` returns false, the form should not submit.
//     The component shows the inline error itself; the parent simply checks
//     `currencyMeta.valid` before posting.

import * as React from "react";
import { useState, useEffect, useCallback, useRef, useId } from "react";
import { Loader2, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/form-select";
import { CURRENCIES, getCurrency, normalizeCurrencyCode, convertAmount } from "@/lib/currency";
import { numbersOnly } from "@/lib/validate";
import { cn } from "@/lib/utils";

export interface CurrencyMeta {
  // True when either: (a) entry is in org currency, or (b) entry is in foreign
  // currency AND both a positive amount and a positive rate are filled in.
  valid: boolean;
  // The amount as the user originally typed it, before conversion.
  // null when the user is entering directly in org currency.
  originalAmount: number | null;
  originalCurrency: string | null;
  exchangeRate: number | null;
}

interface CurrencyAmountInputProps {
  label: string;
  // The converted amount, expressed in the org's base currency. This is what
  // gets persisted server-side.
  value: string;
  onChange: (orgCurrencyAmount: string, meta: CurrencyMeta) => void;
  orgCurrency: string;
  required?: boolean;
  step?: string;            // e.g. "0.01"
  placeholder?: string;
  helperText?: string;
  disabled?: boolean;
  className?: string;
  // Optional: persist the cross-currency entry state across re-mounts (e.g.
  // when editing). Caller controls initial values; the component manages
  // internal updates from there.
  initialOriginal?: {
    currency: string;
    amount: string;
    rate: string;
  };
}

export function CurrencyAmountInput({
  label,
  value,
  onChange,
  orgCurrency,
  required = false,
  step = "0.01",
  placeholder = "0.00",
  helperText,
  disabled = false,
  className,
  initialOriginal,
}: CurrencyAmountInputProps) {
  const fieldId = useId();
  const orgCode = normalizeCurrencyCode(orgCurrency);
  const orgDef = getCurrency(orgCode);

  // Foreign-entry state
  const [expanded, setExpanded] = useState<boolean>(!!initialOriginal);
  const [foreignCurrency, setForeignCurrency] = useState<string>(
    initialOriginal?.currency ?? (orgCode === "USD" ? "EUR" : "USD")
  );
  const [foreignAmount, setForeignAmount] = useState<string>(initialOriginal?.amount ?? "");
  const [rate, setRate] = useState<string>(initialOriginal?.rate ?? "");
  const [rateLoading, setRateLoading] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);
  const [rateSource, setRateSource] = useState<"auto" | "manual" | null>(
    initialOriginal ? "manual" : null
  );

  // Track the last currency pair we successfully fetched a rate for, so
  // editing the rate doesn't re-trigger an auto-fetch loop.
  const lastFetchedPair = useRef<string | null>(null);

  const isForeign = expanded && foreignCurrency !== orgCode;

  // ── Auto-fetch rate when foreign currency changes ────────────────────
  const fetchRate = useCallback(
    async (from: string, to: string) => {
      setRateLoading(true);
      setRateError(null);
      try {
        const res = await fetch(`/api/fx/latest?from=${from}&to=${to}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Could not fetch rate");
        }
        const data = await res.json();
        if (typeof data.rate === "number" && isFinite(data.rate) && data.rate > 0) {
          setRate(data.rate.toString());
          setRateSource("auto");
          lastFetchedPair.current = `${from}->${to}`;
        } else {
          throw new Error("Invalid rate from provider");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Rate fetch failed";
        setRateError(msg);
        // We don't clear the rate field — user can type a manual one.
      } finally {
        setRateLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isForeign) return;
    const pair = `${foreignCurrency}->${orgCode}`;
    if (lastFetchedPair.current === pair) return;
    fetchRate(foreignCurrency, orgCode);
  }, [isForeign, foreignCurrency, orgCode, fetchRate]);

  // ── Conversion ───────────────────────────────────────────────────────
  // When foreign-mode is active, derive the org-currency amount from
  // foreignAmount * rate. We push the result up via onChange.
  useEffect(() => {
    if (!expanded) return;

    // Defensive case: the user opened the foreign-entry block but picked the
    // SAME currency as the org. There's no conversion to do here, and submitting
    // in this state would be ambiguous — block it. The UI already shows an
    // inline amber warning instructing the user to either change the currency
    // or collapse the section.
    if (foreignCurrency === orgCode) {
      onChange(value, {
        valid: false,
        originalAmount: null,
        originalCurrency: foreignCurrency,
        exchangeRate: null,
      });
      return;
    }

    const amt = parseFloat(foreignAmount);
    const r = parseFloat(rate);
    if (isFinite(amt) && amt >= 0 && isFinite(r) && r > 0) {
      const converted = convertAmount(amt, r);
      const meta: CurrencyMeta = {
        valid: true,
        originalAmount: amt,
        originalCurrency: foreignCurrency,
        exchangeRate: r,
      };
      onChange(converted.toString(), meta);
    } else {
      // Bubble up that we're foreign-but-incomplete so parent can block submit.
      onChange("", {
        valid: false,
        originalAmount: isFinite(amt) ? amt : null,
        originalCurrency: foreignCurrency,
        exchangeRate: isFinite(r) ? r : null,
      });
    }
    // We intentionally exclude onChange and value from deps — parents often
    // inline onChange, and value is the controlled output we just emitted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, foreignAmount, rate, foreignCurrency, orgCode]);

  // ── Org-currency direct entry ────────────────────────────────────────
  const handleOrgAmountChange = (next: string) => {
    onChange(next, {
      valid: !required || (parseFloat(next) >= 0 && next !== ""),
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
    });
  };

  const handleCollapse = () => {
    setExpanded(false);
    // Re-emit current value as a clean org-currency entry.
    onChange(value, {
      valid: !required || (parseFloat(value) >= 0 && value !== ""),
      originalAmount: null,
      originalCurrency: null,
      exchangeRate: null,
    });
  };

  // ── Render ───────────────────────────────────────────────────────────
  const currencyOptions = CURRENCIES.map((c) => ({
    value: c.code,
    label: `${c.code} — ${c.name}`,
  }));

  // When in foreign mode, the main input is read-only and shows the converted preview.
  const previewValue = (() => {
    if (!isForeign) return value;
    const amt = parseFloat(foreignAmount);
    const r = parseFloat(rate);
    if (isFinite(amt) && amt >= 0 && isFinite(r) && r > 0) {
      return convertAmount(amt, r).toFixed(orgDef.decimals);
    }
    return "";
  })();

  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={fieldId} className="flex items-center justify-between">
        <span>
          {label} {required && <span className="text-red-500">*</span>}
          <span className="ml-1 text-xs font-normal text-muted-foreground">({orgCode})</span>
        </span>
        <button
          type="button"
          onClick={() => (expanded ? handleCollapse() : setExpanded(true))}
          disabled={disabled}
          className="text-[11px] font-medium text-[#d97706] hover:underline disabled:opacity-50"
        >
          {expanded ? (
            <span className="inline-flex items-center gap-0.5">
              <ChevronUp className="size-3" />
              Hide conversion
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5">
              <ChevronDown className="size-3" />
              Enter in another currency
            </span>
          )}
        </button>
      </Label>

      {/* Primary org-currency input (or read-only preview when foreign-mode) */}
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          {orgDef.symbol.trim()}
        </span>
        <Input
          id={fieldId}
          type="number"
          step={step}
          min={0}
          value={isForeign ? previewValue : value}
          onChange={(e) => handleOrgAmountChange(e.target.value)}
          onKeyDown={numbersOnly}
          placeholder={placeholder}
          disabled={disabled || isForeign}
          readOnly={isForeign}
          className={cn(
            "pl-9 tabular-nums",
            isForeign && "bg-muted/40 cursor-not-allowed"
          )}
        />
      </div>

      {helperText && !isForeign && (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      )}

      {/* Foreign-currency entry block */}
      {expanded && (
        <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Source currency *
              </Label>
              <FormSelect
                value={foreignCurrency}
                onChange={(v) => {
                  setForeignCurrency(v);
                  setRateSource(null);
                  setRateError(null);
                }}
                options={currencyOptions}
                disabled={disabled}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Amount in {foreignCurrency} *
              </Label>
              <Input
                type="number"
                step={step}
                min={0}
                value={foreignAmount}
                onChange={(e) => setForeignAmount(e.target.value)}
                onKeyDown={numbersOnly}
                placeholder="0.00"
                disabled={disabled}
              />
            </div>
          </div>

          {foreignCurrency === orgCode ? (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Source currency matches your organization currency. Pick a different currency or collapse this section.
            </p>
          ) : (
            <>
              <div className="space-y-1">
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide flex items-center justify-between">
                  <span>Exchange rate: 1 {foreignCurrency} = ? {orgCode} *</span>
                  <button
                    type="button"
                    onClick={() => fetchRate(foreignCurrency, orgCode)}
                    disabled={disabled || rateLoading}
                    className="inline-flex items-center gap-1 text-[10px] font-medium text-[#d97706] hover:underline disabled:opacity-50"
                  >
                    {rateLoading ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3" />
                    )}
                    Refresh
                  </button>
                </Label>
                <Input
                  type="number"
                  step="0.000001"
                  min={0}
                  value={rate}
                  onChange={(e) => {
                    setRate(e.target.value);
                    setRateSource("manual");
                  }}
                  onKeyDown={numbersOnly}
                  placeholder={rateLoading ? "Fetching..." : "Enter rate"}
                  disabled={disabled || rateLoading}
                />
                {rateError && (
                  <p className="text-xs text-red-500">
                    {rateError}. Enter the rate manually to continue.
                  </p>
                )}
                {!rateError && rateSource === "auto" && (
                  <p className="text-xs text-muted-foreground">
                    Live rate from open.er-api.com — you can override above.
                  </p>
                )}
                {!rateError && rateSource === "manual" && !rateLoading && (
                  <p className="text-xs text-muted-foreground">Using manually entered rate.</p>
                )}
              </div>

              <div className="rounded-md border border-border bg-card p-2.5 text-sm flex items-center justify-between">
                <span className="text-muted-foreground">Converts to:</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {previewValue
                    ? `${orgDef.symbol}${parseFloat(previewValue).toLocaleString("en-US", {
                        minimumFractionDigits: orgDef.decimals,
                        maximumFractionDigits: orgDef.decimals,
                      })}`
                    : "—"}
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
