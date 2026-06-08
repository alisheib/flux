"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Package,
  UserCircle,
  FileText,
  ClipboardList,
  ShoppingCart,
  BarChart3,
  Settings,
  Ship,
  Calculator,
  Wallet,
  Users,
  ArrowUpDown,
} from "lucide-react";

interface SearchResults {
  products: Array<{ id: string; name: string; sku: string | null; sellingPrice: number; stockQty: number }>;
  customers: Array<{ id: string; name: string; phone: string | null; company: string | null }>;
  invoices: Array<{ id: string; number: string; customer: string; total: number; status: string }>;
  proformas: Array<{ id: string; number: string; customer: string; total: number; status: string }>;
}

const QUICK_ACTIONS = [
  { label: "Point of Sale", icon: ShoppingCart, href: "/pos" },
  { label: "Inventory", icon: Package, href: "/inventory" },
  { label: "Invoices", icon: FileText, href: "/invoices" },
  { label: "Customers", icon: UserCircle, href: "/customers" },
  { label: "Shipments", icon: Ship, href: "/shipments" },
  { label: "Proformas", icon: ClipboardList, href: "/proformas" },
  { label: "Receivables", icon: Wallet, href: "/receivables" },
  { label: "Accounting", icon: Calculator, href: "/accounting" },
  { label: "Reports", icon: BarChart3, href: "/reports" },
  { label: "Stock Movements", icon: ArrowUpDown, href: "/stock-movements" },
  { label: "Users", icon: Users, href: "/users" },
  { label: "Settings", icon: Settings, href: "/settings" },
];

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, onOpenChange]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.results);
        }
      } catch {
        // Silently fail — user sees empty state
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  const navigate = useCallback((href: string) => {
    onOpenChange(false);
    setQuery("");
    setResults(null);
    router.push(href);
  }, [router, onOpenChange]);

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) { setQuery(""); setResults(null); }
      }}
      title="Search"
      description="Search products, customers, invoices, or navigate anywhere"
    >
      <div className="flex flex-col">
        <CommandInput
          placeholder="Search products, customers, invoices…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[360px]">
          <CommandEmpty>
            {loading ? "Searching…" : query.length < 2 ? "Type to search…" : "No results found."}
          </CommandEmpty>

          {results?.products && results.products.length > 0 && (
            <CommandGroup heading="Products">
              {results.products.map((p) => (
                <CommandItem key={p.id} value={`product-${p.name}-${p.sku || ""}`} onSelect={() => navigate("/inventory")}>
                  <Package className="mr-2 size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{p.name}</span>
                  {p.sku && <span className="ml-2 font-mono text-xs text-muted-foreground">{p.sku}</span>}
                  <span className="ml-2 text-xs text-muted-foreground">Qty: {p.stockQty}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results?.customers && results.customers.length > 0 && (
            <CommandGroup heading="Customers">
              {results.customers.map((c) => (
                <CommandItem key={c.id} value={`customer-${c.name}-${c.phone || ""}`} onSelect={() => navigate(`/customers/${c.id}`)}>
                  <UserCircle className="mr-2 size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{c.name}</span>
                  {c.company && <span className="ml-2 text-xs text-muted-foreground">{c.company}</span>}
                  {c.phone && <span className="ml-2 font-mono text-xs text-muted-foreground">{c.phone}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results?.invoices && results.invoices.length > 0 && (
            <CommandGroup heading="Invoices">
              {results.invoices.map((inv) => (
                <CommandItem key={inv.id} value={`invoice-${inv.number}-${inv.customer}`} onSelect={() => navigate(`/invoices/${inv.id}`)}>
                  <FileText className="mr-2 size-4 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium">{inv.number}</span>
                  <span className="ml-2 flex-1 truncate text-muted-foreground">{inv.customer}</span>
                  <span className={`ml-2 text-xs ${inv.status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>{inv.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results?.proformas && results.proformas.length > 0 && (
            <CommandGroup heading="Proformas">
              {results.proformas.map((pf) => (
                <CommandItem key={pf.id} value={`proforma-${pf.number}-${pf.customer}`} onSelect={() => navigate("/proformas")}>
                  <ClipboardList className="mr-2 size-4 text-muted-foreground" />
                  <span className="font-mono text-sm font-medium">{pf.number}</span>
                  <span className="ml-2 flex-1 truncate text-muted-foreground">{pf.customer}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{pf.status}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {!query && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Navigate">
                {QUICK_ACTIONS.map((action) => (
                  <CommandItem key={action.href} value={action.label} onSelect={() => navigate(action.href)}>
                    <action.icon className="mr-2 size-4 text-muted-foreground" />
                    {action.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </div>
    </CommandDialog>
  );
}
