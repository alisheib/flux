"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/calculations";
import {
  Search,
  User,
  Plus,
  X,
  Loader2,
  AlertTriangle,
} from "lucide-react";

interface CustomerResult {
  id: string;
  name: string;
  company: string | null;
  tin: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  outstanding: number;
  initials: string;
}

interface CustomerTypeaheadProps {
  value: CustomerResult | null;
  onChange: (customer: CustomerResult | null) => void;
  onAddNew?: (searchText: string) => void;
  // Emits the raw search text on every keystroke. The POS page mirrors this
  // into its `customerName` state so a typed-but-not-selected name still
  // saves on the sale — fixing the "I can't enter a client name" bug where
  // users typed in this box, never clicked a dropdown result, and lost it.
  onQueryChange?: (query: string) => void;
  currency?: string;
  placeholder?: string;
}

const AVATAR_COLORS = ["#d97706", "#2563eb", "#16a34a", "#7c3aed", "#dc2626", "#0891b2", "#ca8a04", "#0f766e"];

function getAvatarColor(initials: string): string {
  const seed = (initials || "X").charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[seed];
}

export function CustomerTypeahead({ value, onChange, onAddNew, onQueryChange, currency = "TSH", placeholder }: CustomerTypeaheadProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback(async (q: string) => {
    if (q.length < 1) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
      if (res.ok) setResults(await res.json());
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.length >= 1) {
      debounceRef.current = setTimeout(() => search(query), 200);
    } else {
      setResults([]);
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSelect = (customer: CustomerResult) => {
    onChange(customer);
    setQuery("");
    // Do NOT call onQueryChange("") here — the parent's onChange handler
    // has already set customerName to the picked customer's name. Clearing
    // the query mirror would race-overwrite it inside the same React batch.
    setOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setQuery("");
    onQueryChange?.(""); // user explicitly removed the selection — wipe walk-in name too
  };

  // Selected state — show info card
  if (value) {
    const bg = getAvatarColor(value.initials);
    return (
      <div className="mt-1.5 p-3 rounded-[10px] border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0" style={{ background: `linear-gradient(135deg, ${bg}, color-mix(in oklab, ${bg} 70%, black))` }}>
          {value.initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{value.name}</div>
          <div className="text-xs text-muted-foreground">{value.phone}{value.tin ? ` · TIN ${value.tin}` : ""}</div>
        </div>
        {value.outstanding > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300">
            {formatCurrency(value.outstanding, currency)} owing
          </span>
        )}
        <button type="button" onClick={handleClear} className="p-1 rounded-md hover:bg-muted text-muted-foreground">
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={e => {
            const v = e.target.value;
            setQuery(v);
            onQueryChange?.(v);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder || "Search customer by name, phone, or TIN..."}
          className="pl-9 h-[42px] text-sm"
        />
        {loading && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-4 animate-spin text-amber-500" />}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-[10px] shadow-lg max-h-[380px] overflow-auto">
          {/* Walk-in always first */}
          <button
            type="button"
            onClick={() => { onChange(null); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-border/50 bg-amber-500/[0.03] hover:bg-amber-500/[0.08] transition-colors text-left"
          >
            <div className="w-9 h-9 rounded-full border-[1.5px] border-dashed border-amber-500/50 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <User className="size-3.5" />
            </div>
            <div className="flex-1">
              <div className="text-[13.5px] font-semibold">Walk-in customer</div>
              <div className="text-[11.5px] text-muted-foreground">Default — no customer record created</div>
            </div>
          </button>

          {/* Loading state */}
          {loading && query.length >= 1 && results.length === 0 && (
            <div className="py-8 text-center text-muted-foreground text-sm">
              <Loader2 className="size-5 animate-spin text-amber-500 mx-auto mb-2" />
              Searching customers...
            </div>
          )}

          {/* Results */}
          {!loading && results.map(c => {
            const bg = getAvatarColor(c.initials);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSelect(c)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-border/30 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0" style={{ background: `linear-gradient(135deg, ${bg}, color-mix(in oklab, ${bg} 70%, black))` }}>
                  {c.initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-[13.5px] font-semibold truncate">{c.name}</span>
                    {c.tin && <span className="text-[10px] font-mono text-muted-foreground px-1.5 py-0.5 rounded bg-muted">{c.tin}</span>}
                  </div>
                  <div className="text-[11.5px] text-muted-foreground font-mono truncate">
                    {c.phone}{c.company ? ` · ${c.company}` : ""}
                  </div>
                </div>
                {c.outstanding > 0 && (
                  <span className="text-[11px] text-amber-700 dark:text-amber-400 font-semibold font-mono whitespace-nowrap">
                    {formatCurrency(c.outstanding, currency)} owing
                  </span>
                )}
              </button>
            );
          })}

          {/* No results */}
          {!loading && query.length >= 1 && results.length === 0 && (
            <div className="py-6 text-center">
              <div className="text-sm text-muted-foreground mb-1">No customer found for <strong className="text-foreground">"{query}"</strong></div>
              <div className="text-xs text-muted-foreground">Use Walk-in or add a new customer below.</div>
            </div>
          )}

          {/* Add new footer */}
          {onAddNew && (
            <button
              type="button"
              onClick={() => { onAddNew(query); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <div className="w-9 h-9 rounded-full bg-amber-500 text-white flex items-center justify-center">
                <Plus className="size-3.5" strokeWidth={2.25} />
              </div>
              <div className="flex-1">
                <div className="text-[13.5px] font-semibold text-amber-700 dark:text-amber-400">Add new customer{query ? ` "${query}"` : ""}</div>
                <div className="text-[11.5px] text-muted-foreground">Save details for future invoices</div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Compact balance warning banner for invoice integration
export function CustomerBalanceWarning({ outstanding, currency = "TSH", invoiceCount }: { outstanding: number; currency?: string; invoiceCount?: number }) {
  if (outstanding <= 0) return null;
  return (
    <div className="mt-4 p-3.5 rounded-[10px] bg-amber-500/5 border border-amber-500/20 flex gap-2.5 items-start">
      <AlertTriangle className="size-4 text-amber-700 dark:text-amber-400 mt-0.5 shrink-0" />
      <div>
        <div className="font-semibold text-[13px] text-amber-700 dark:text-amber-400">Customer has outstanding balance</div>
        <div className="text-[12.5px] text-muted-foreground mt-0.5">
          {formatCurrency(outstanding, currency)}{invoiceCount ? ` across ${invoiceCount} unpaid invoices` : ""} — consider requesting partial payment before extending more credit.
        </div>
      </div>
    </div>
  );
}
