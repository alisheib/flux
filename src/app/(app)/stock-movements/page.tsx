"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormSelect } from "@/components/ui/form-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  ArrowUpDown,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Package,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface StockMovementEntry {
  id: string;
  productId: string;
  product: { id: string; name: string; sku: string | null };
  userId: string | null;
  user: { id: string; name: string } | null;
  type: string;
  quantity: number;
  balance: number;
  reference: string | null;
  notes: string | null;
  createdAt: string;
}

interface StockMovementsResponse {
  data: StockMovementEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface ProductOption {
  id: string;
  name: string;
  sku: string | null;
  stockQty: number;
}

// ── Type badge config ────────────────────────────────────────────────────────

const typeConfig: Record<
  string,
  { label: string; badgeBg: string; badgeText: string }
> = {
  sale: {
    label: "Sale",
    badgeBg: "bg-blue-500/12",
    badgeText: "text-blue-600 dark:text-blue-400",
  },
  refund: {
    label: "Refund",
    badgeBg: "bg-emerald-500/12",
    badgeText: "text-emerald-600 dark:text-emerald-400",
  },
  adjustment: {
    label: "Adjustment",
    badgeBg: "bg-amber-500/12",
    badgeText: "text-amber-600 dark:text-amber-400",
  },
  manual: {
    label: "Manual",
    badgeBg: "bg-purple-500/12",
    badgeText: "text-purple-600 dark:text-purple-400",
  },
  shipment_received: {
    label: "Shipment",
    badgeBg: "bg-cyan-500/12",
    badgeText: "text-cyan-600 dark:text-cyan-400",
  },
};

function TypeBadge({ type }: { type: string }) {
  const config = typeConfig[type] || {
    label: type,
    badgeBg: "bg-gray-500/12",
    badgeText: "text-gray-600 dark:text-gray-400",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeBg} ${config.badgeText}`}
    >
      {config.label}
    </span>
  );
}

// ── Type filter options ──────────────────────────────────────────────────────

const typeOptions = [
  { value: "", label: "All Types" },
  { value: "sale", label: "Sale" },
  { value: "refund", label: "Refund" },
  { value: "adjustment", label: "Adjustment" },
  { value: "manual", label: "Manual" },
  { value: "shipment_received", label: "Shipment Received" },
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function StockMovementsPage() {
  const { user } = useAuth();

  const [data, setData] = useState<StockMovementsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<ProductOption[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 30;

  // Adjust dialog
  const [showAdjustDialog, setShowAdjustDialog] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [adjustProductId, setAdjustProductId] = useState("");
  const [adjustQuantity, setAdjustQuantity] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");

  // ── Fetch products for the adjust dialog ───────────────────────────────

  const fetchProducts = useCallback(async () => {
    try {
      const res = await fetch("/api/products?limit=500");
      if (res.ok) {
        const json = await res.json();
        const list: ProductOption[] = (json.data || json.products || json).map(
          (p: { id: string; name: string; sku?: string | null; stockQty?: number }) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || null,
            stockQty: p.stockQty || 0,
          })
        );
        setProducts(list);
      }
    } catch {
      // non-critical
    }
  }, []);

  // ── Fetch movements ────────────────────────────────────────────────────

  const fetchMovements = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (typeFilter) params.set("type", typeFilter);
      if (searchQuery.trim()) params.set("search", searchQuery.trim());

      const res = await fetch(`/api/stock-movements?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch stock movements");
      }
      const json = await res.json();
      setData(json);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load stock movements";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, searchQuery]);

  useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [typeFilter, searchQuery]);

  // ── Adjust stock ───────────────────────────────────────────────────────

  const handleAdjustStock = async () => {
    if (!adjustProductId) {
      toast.error("Please select a product");
      return;
    }
    const qty = parseFloat(adjustQuantity);
    if (!qty || qty === 0) {
      toast.error("Please enter a non-zero quantity");
      return;
    }

    try {
      setAdjusting(true);
      const res = await fetch("/api/stock-movements/adjust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: adjustProductId,
          quantity: qty,
          notes: adjustNotes || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to adjust stock");
      }

      toast.success("Stock adjusted successfully");
      setShowAdjustDialog(false);
      setAdjustProductId("");
      setAdjustQuantity("");
      setAdjustNotes("");
      fetchMovements();
      fetchProducts();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to adjust stock";
      toast.error(message);
    } finally {
      setAdjusting(false);
    }
  };

  // ── Helpers ────────────────────────────────────────────────────────────

  function formatDate(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatQuantity(qty: number) {
    if (qty > 0) return `+${qty}`;
    return String(qty);
  }

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const movements = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const total = data?.pagination?.total || 0;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        description="Track all inventory changes across your products"
      >
        <button
          onClick={() => setShowAdjustDialog(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1813] shadow-sm hover:bg-[#c2410c] transition-colors"
        >
          <Plus className="size-4" />
          Adjust Stock
        </button>
      </PageHeader>

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          {/* Search */}
          <div className="relative flex-1 sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search by product name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Type filter */}
          <div className="w-48">
            <FormSelect
              value={typeFilter}
              onChange={setTypeFilter}
              options={typeOptions}
              placeholder="All Types"
            />
          </div>

          {/* Clear */}
          {(searchQuery || typeFilter) && (
            <button
              onClick={() => {
                setSearchQuery("");
                setTypeFilter("");
              }}
              className="text-xs font-medium text-[#d97706] hover:underline"
            >
              Clear filters
            </button>
          )}

          {/* Count */}
          <span className="text-xs text-muted-foreground sm:ml-auto">
            {total} {total === 1 ? "movement" : "movements"}
          </span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && (
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Date
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Product
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                    Quantity
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                    Balance
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    User
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Reference
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Notes
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movements.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Package className="size-10 opacity-30" />
                        <p className="text-sm font-medium">
                          No stock movements found
                        </p>
                        <p className="text-xs">
                          {searchQuery || typeFilter
                            ? "Try adjusting your filters"
                            : "Stock movements will appear here as inventory changes"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  movements.map((movement) => (
                    <TableRow
                      key={movement.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(movement.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground">
                        {movement.product.name}
                      </TableCell>
                      <TableCell>
                        <TypeBadge type={movement.type} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`text-sm font-semibold ${
                            movement.quantity > 0
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatQuantity(movement.quantity)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium text-foreground">
                        {movement.balance}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {movement.user?.name || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {movement.reference || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {movement.notes || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Stock Adjustment Dialog ───────────────────────────────────── */}
      <Dialog open={showAdjustDialog} onOpenChange={setShowAdjustDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
            <DialogDescription>
              Manually adjust the stock quantity for a product. Use positive
              numbers to add stock and negative numbers to remove stock.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Product */}
            <div className="space-y-1.5">
              <Label htmlFor="adjust-product">Product *</Label>
              <FormSelect
                id="adjust-product"
                value={adjustProductId}
                onChange={setAdjustProductId}
                options={products.map((p) => ({
                  value: p.id,
                  label: `${p.name}${p.sku ? ` (${p.sku})` : ""} - Stock: ${p.stockQty}`,
                }))}
                placeholder="Select a product..."
              />
            </div>

            {/* Quantity */}
            <div className="space-y-1.5">
              <Label htmlFor="adjust-quantity">
                Quantity (+/-)  *
              </Label>
              <Input
                id="adjust-quantity"
                type="number"
                step="1"
                placeholder="e.g., 10 or -5"
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Positive to add, negative to remove
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label htmlFor="adjust-notes">Notes</Label>
              <Textarea
                id="adjust-notes"
                placeholder="Reason for adjustment..."
                rows={3}
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
              />
            </div>

            {/* Preview */}
            {adjustProductId && adjustQuantity && (
              <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
                <span className="text-sm text-muted-foreground">
                  New balance:{" "}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {(
                    (products.find((p) => p.id === adjustProductId)?.stockQty ||
                      0) + (parseFloat(adjustQuantity) || 0)
                  ).toFixed(0)}
                </span>
              </div>
            )}
          </div>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setShowAdjustDialog(false);
                setAdjustProductId("");
                setAdjustQuantity("");
                setAdjustNotes("");
              }}
              className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAdjustStock}
              disabled={adjusting || !adjustProductId || !adjustQuantity}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97706] px-4 py-2 text-sm font-medium text-[#1a1813] shadow-sm hover:bg-[#c2410c] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {adjusting && <Loader2 className="size-4 animate-spin" />}
              Confirm Adjustment
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
