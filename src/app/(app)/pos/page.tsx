"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search,
  Plus,
  Minus,
  Trash2,
  ShoppingCart,
  X,
  Printer,
  MessageCircle,
  ChevronDown,
  ChevronUp,
  Package,
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
  ReceiptText,
  Loader2,
  ClipboardCheck,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  sku: string | null;
  categoryId: string | null;
  unit: string;
  sellingPrice: number;
  costPrice: number;
  stockQty: number;
  minStockQty: number;
  active: boolean;
  category?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
}

interface CartItem {
  productId: string;
  name: string;
  sku: string | null;
  unitPrice: number;
  quantity: number;
  maxStock: number;
  unit: string;
}

interface OrgSettings {
  taxRate: number;
  taxLabel: string;
  currency: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
}

interface SaleResult {
  id: string;
  saleNumber: string;
  customer: string | null;
  customerPhone: string | null;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  paymentMethod: string;
  items: { name: string; quantity: number; unitPrice: number; total: number }[];
  createdAt: string;
  invoice?: { id: string; number: string };
}

// ── Main POS Page ────────────────────────────────────────────────────────────

export default function POSPage() {
  const { user } = useAuth();

  // Data state
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings>({
    taxRate: 0,
    taxLabel: "Tax",
    currency: "USD",
    name: "",
    phone: null,
    email: null,
    address: null,
  });
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountValue, setDiscountValue] = useState<string>("");
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  );
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [notes, setNotes] = useState("");

  // Customer info
  const [customerExpanded, setCustomerExpanded] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");

  // Sale completion
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [completingSale, setCompletingSale] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [lastSale, setLastSale] = useState<SaleResult | null>(null);

  // Mobile view toggle
  const [mobileView, setMobileView] = useState<"products" | "cart">(
    "products"
  );

  // ── Data Fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, categoriesRes, settingsRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/categories"),
        fetch("/api/settings"),
      ]);

      if (productsRes.ok) {
        const data = await productsRes.json();
        setProducts(data.filter((p: Product) => p.active));
      }
      if (categoriesRes.ok) {
        setCategories(await categoriesRes.json());
      }
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        const org = settingsData.organization || settingsData;
        setOrgSettings({
          taxRate: org.taxRate ?? 0,
          taxLabel: org.taxLabel ?? "Tax",
          currency: org.currency ?? "USD",
          name: org.name ?? "",
          phone: org.phone ?? null,
          email: org.email ?? null,
          address: org.address ?? null,
        });
      }
    } catch {
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Keyboard shortcut (Cmd+K focuses search) ──────────────────────────

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        const el = document.getElementById("pos-search");
        if (el) el.focus();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Filtered Products ──────────────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        selectedCategory === "all" || p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // ── Cart Operations ────────────────────────────────────────────────────

  const addToCart = useCallback((product: Product) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.productId === product.id);
      if (existing) {
        return prev.map((item) =>
          item.productId === product.id
            ? {
                ...item,
                quantity: Math.min(item.quantity + 1, item.maxStock),
              }
            : item
        );
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          sku: product.sku,
          unitPrice: product.sellingPrice,
          quantity: 1,
          maxStock: product.stockQty,
          unit: product.unit,
        },
      ];
    });
  }, []);

  const updateCartQuantity = useCallback(
    (productId: string, quantity: number) => {
      if (quantity <= 0) {
        setCart((prev) => prev.filter((item) => item.productId !== productId));
        return;
      }
      setCart((prev) =>
        prev.map((item) =>
          item.productId === productId
            ? { ...item, quantity: Math.min(quantity, item.maxStock) }
            : item
        )
      );
    },
    []
  );

  const updateCartPrice = useCallback(
    (productId: string, price: number) => {
      setCart((prev) =>
        prev.map((item) =>
          item.productId === productId ? { ...item, unitPrice: price } : item
        )
      );
    },
    []
  );

  const removeFromCart = useCallback((productId: string) => {
    setCart((prev) => prev.filter((item) => item.productId !== productId));
  }, []);

  const clearCart = useCallback((silent = false) => {
    setCart([]);
    setDiscountValue("");
    setDiscountType("amount");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setNotes("");
    setPaymentMethod("cash");
    setCustomerExpanded(false);
    if (!silent) {
      toast.info("Cart cleared", { description: "All items have been removed." });
    }
  }, []);

  // ── Totals Calculation ─────────────────────────────────────────────────

  const subtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [cart]
  );

  const discountAmount = useMemo(() => {
    const val = parseFloat(discountValue) || 0;
    if (discountType === "percent") {
      return (subtotal * val) / 100;
    }
    return val;
  }, [subtotal, discountValue, discountType]);

  const taxableAmount = subtotal - discountAmount;
  const taxAmount = (taxableAmount * orgSettings.taxRate) / 100;
  const total = taxableAmount + taxAmount;

  // ── Confirm Sale (opens review dialog) ─────────────────────────────────

  const openConfirmSale = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    setConfirmDialogOpen(true);
  };

  // ── Complete Sale (called after confirmation) ────────────────────────

  const completeSale = async () => {
    setConfirmDialogOpen(false);
    setCompletingSale(true);
    try {
      const response = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.productId,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.quantity,
          })),
          customer: customerName || null,
          customerPhone: customerPhone || null,
          customerEmail: customerEmail || null,
          subtotal,
          taxRate: orgSettings.taxRate,
          taxAmount,
          discount: discountAmount,
          total,
          paymentMethod,
          notes: notes || null,
          currency: orgSettings.currency,
        }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to complete sale");
      }

      const saleData = await response.json();
      setLastSale({
        ...saleData,
        items: cart.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.unitPrice * item.quantity,
        })),
      });
      setReceiptDialogOpen(true);
      clearCart(true);
      fetchData(); // refresh stock
      toast.success("Sale completed!", { description: `Invoice #${saleData.saleNumber} generated • ${formatCurrency(total, orgSettings.currency)}` });
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to complete sale";
      toast.error("Sale failed", { description: message || "Please try again." });
    } finally {
      setCompletingSale(false);
    }
  };

  // ── WhatsApp Share ─────────────────────────────────────────────────────

  const generateReceiptText = (sale: SaleResult): string => {
    const cur = orgSettings.currency;
    const lines = [
      `Receipt #${sale.saleNumber}`,
      `Date: ${new Date(sale.createdAt).toLocaleDateString()}`,
      sale.customer ? `Customer: ${sale.customer}` : "",
      "",
      "Items:",
      ...sale.items.map(
        (item) =>
          `- ${item.name} x${item.quantity} = ${formatCurrency(item.total, cur)}`
      ),
      "",
      `Subtotal: ${formatCurrency(sale.subtotal, cur)}`,
      sale.taxRate > 0
        ? `${orgSettings.taxLabel} (${sale.taxRate}%): ${formatCurrency(sale.taxAmount, cur)}`
        : "",
      sale.discount > 0
        ? `Discount: -${formatCurrency(sale.discount, cur)}`
        : "",
      `Total: ${formatCurrency(sale.total, cur)}`,
      `Payment: ${sale.paymentMethod}`,
      "",
      "Thank you for your business!",
      orgSettings.name || "Flux Business Platform",
    ].filter(Boolean);
    return lines.join("\n");
  };

  const shareWhatsApp = (sale: SaleResult) => {
    const text = generateReceiptText(sale);
    const phone = sale.customerPhone
      ? sale.customerPhone.replace(/[^0-9+]/g, "").replace(/^\+/, "")
      : "";

    // Use api.whatsapp.com for better mobile compatibility
    const baseUrl = "https://api.whatsapp.com/send";
    const params = new URLSearchParams({ text });
    if (phone) params.set("phone", phone);

    const url = `${baseUrl}?${params.toString()}`;
    window.open(url, "_blank");
  };

  const router = useRouter();

  const handlePrint = () => {
    if (lastSale?.invoice?.id) {
      router.push(`/invoices/${lastSale.invoice.id}`);
    }
  };

  // ── Stock pill style ───────────────────────────────────────────────────

  const stockPillClass = (product: Product) => {
    if (product.stockQty <= 0) return "stock-out";
    if (product.stockQty <= product.minStockQty) return "stock-low";
    return "stock-good";
  };

  // ── Payment Methods ────────────────────────────────────────────────────

  const paymentMethods = [
    { value: "cash", label: "Cash", icon: Banknote },
    { value: "card", label: "Card", icon: CreditCard },
    { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
    { value: "mobile_money", label: "Mobile Money", icon: Smartphone },
  ];

  // ── Loading State ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading POS...</p>
        </div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-background">
      {/* ── Mobile Tab Switcher ──────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-border bg-card p-2 lg:hidden">
        <button
          type="button"
          onClick={() => setMobileView("products")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            mobileView === "products"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <Package className="size-4" />
          Products
        </button>
        <button
          type="button"
          onClick={() => setMobileView("cart")}
          className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
            mobileView === "cart"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent"
          }`}
        >
          <ShoppingCart className="size-4" />
          Cart
          {cart.length > 0 && (
            <span className="ml-1 inline-flex size-5 items-center justify-center rounded-full bg-[var(--flux-brand)] text-[10px] font-bold text-white">
              {cart.length}
            </span>
          )}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* ══════════════════════════════════════════════════════════════
            LEFT PANEL — Products (60%)
           ══════════════════════════════════════════════════════════════ */}
        <div
          className={`flex w-full flex-col lg:w-[60%] ${
            mobileView === "cart" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Search Bar */}
          <div className="border-b border-border bg-card p-4">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="pos-search"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-11 pl-10 pr-16 text-sm"
              />
              <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 select-none rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {typeof navigator !== "undefined" &&
                /Mac|iPhone/.test(navigator.userAgent)
                  ? "\u2318K"
                  : "Ctrl+K"}
              </kbd>
            </div>

            {/* Category Chips */}
            <ScrollArea className="mt-3 w-full">
              <div className="flex gap-2 pb-1">
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    selectedCategory === "all"
                      ? "bg-foreground text-background dark:bg-[var(--flux-brand)] dark:text-[var(--flux-brand-fg)]"
                      : "bg-secondary text-secondary-foreground hover:bg-accent"
                  }`}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                      selectedCategory === cat.id
                        ? "bg-foreground text-background dark:bg-[var(--flux-brand)] dark:text-[var(--flux-brand-fg)]"
                        : "bg-secondary text-secondary-foreground hover:bg-accent"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* Product Grid */}
          <ScrollArea className="flex-1">
            <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredProducts.length === 0 ? (
                <div className="col-span-full flex flex-col items-center justify-center py-20 text-muted-foreground">
                  <Package className="mb-3 size-12 opacity-40" />
                  <p className="text-sm font-medium">No products found</p>
                  <p className="text-xs">
                    Try adjusting your search or filters
                  </p>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const inCart = cart.find(
                    (item) => item.productId === product.id
                  );
                  const outOfStock = product.stockQty <= 0;

                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => {
                        if (outOfStock) {
                          toast.error("Out of stock");
                        } else {
                          addToCart(product);
                        }
                      }}
                      disabled={outOfStock}
                      className={`group relative flex flex-col rounded-xl border bg-card p-4 text-left transition-all ${
                        outOfStock
                          ? "cursor-not-allowed opacity-50"
                          : "cursor-pointer hover:shadow-md hover:border-[var(--flux-brand)]/40"
                      } ${
                        inCart
                          ? "ring-2 ring-[var(--flux-brand)]"
                          : "border-border"
                      }`}
                    >
                      {/* In-cart indicator */}
                      {inCart && (
                        <span className="absolute -right-1.5 -top-1.5 flex size-6 items-center justify-center rounded-full bg-[var(--flux-brand)] text-[11px] font-bold text-white shadow-sm">
                          {inCart.quantity}
                        </span>
                      )}

                      {/* Top: Name + SKU */}
                      <div className="mb-3 min-w-0">
                        <p className="truncate text-sm font-bold text-foreground">
                          {product.name}
                        </p>
                        {product.sku && (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {product.sku}
                          </p>
                        )}
                      </div>

                      {/* Bottom: Price + Stock */}
                      <div className="flex items-end justify-between">
                        <p className="text-base font-bold text-foreground">
                          {formatCurrency(
                            product.sellingPrice,
                            orgSettings.currency
                          )}
                        </p>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${stockPillClass(product)}`}
                        >
                          {outOfStock
                            ? "Out"
                            : `${formatNumber(product.stockQty, 0)} ${product.unit}`}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            RIGHT PANEL — Cart (40%)
           ══════════════════════════════════════════════════════════════ */}
        <div
          className={`flex w-full flex-col border-l border-border bg-card lg:w-[40%] lg:min-w-[380px] lg:max-w-[520px] ${
            mobileView === "products" ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* Cart Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <ShoppingCart className="size-5 text-foreground" />
              <h2 className="text-lg font-bold text-foreground">
                Current Sale
              </h2>
              {cart.length > 0 && (
                <Badge className="bg-[var(--flux-brand)] text-white hover:bg-[var(--flux-brand)]">
                  {cart.length} {cart.length === 1 ? "item" : "items"}
                </Badge>
              )}
            </div>
          </div>

          {/* Cart Items (scrollable) */}
          <ScrollArea className="flex-1">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <ShoppingCart className="mb-3 size-12 opacity-30" />
                <p className="text-sm font-medium">Cart is empty</p>
                <p className="text-xs">Click on products to add them</p>
              </div>
            ) : (
              <div className="space-y-2 p-3">
                {cart.map((item) => (
                  <div
                    key={item.productId}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    {/* Top row: name + remove */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {item.name}
                        </p>
                        {item.sku && (
                          <p className="text-xs text-muted-foreground">
                            {item.sku}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => removeFromCart(item.productId)}
                        className="shrink-0 text-muted-foreground hover:text-destructive"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>

                    {/* Bottom row: qty controls, price, line total */}
                    <div className="mt-2.5 flex items-center justify-between gap-2">
                      {/* Quantity controls */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="icon-xs"
                          className="size-7"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              item.quantity - 1
                            )
                          }
                        >
                          <Minus className="size-3" />
                        </Button>
                        <Input
                          type="number"
                          min={1}
                          max={item.maxStock}
                          value={item.quantity}
                          onChange={(e) =>
                            updateCartQuantity(
                              item.productId,
                              parseInt(e.target.value) || 1
                            )
                          }
                          className="h-7 w-12 text-center text-sm font-medium"
                        />
                        <Button
                          variant="outline"
                          size="icon-xs"
                          className="size-7"
                          onClick={() =>
                            updateCartQuantity(
                              item.productId,
                              item.quantity + 1
                            )
                          }
                          disabled={item.quantity >= item.maxStock}
                        >
                          <Plus className="size-3" />
                        </Button>
                      </div>

                      {/* Unit price (editable) */}
                      <div className="flex items-center gap-1">
                        <span className="text-xs text-muted-foreground">@</span>
                        <Input
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice}
                          onChange={(e) =>
                            updateCartPrice(
                              item.productId,
                              parseFloat(e.target.value) || 0
                            )
                          }
                          className="h-7 w-20 text-right text-sm font-medium"
                        />
                      </div>

                      {/* Line total */}
                      <p className="shrink-0 text-sm font-bold text-foreground tabular-nums">
                        {formatCurrency(
                          item.unitPrice * item.quantity,
                          orgSettings.currency
                        )}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>

          {/* ── Cart Footer: Totals & Checkout ──────────────────────── */}
          <div className="border-t border-border bg-card">
            {/* Totals */}
            <div className="space-y-2 px-4 pt-3">
              {/* Subtotal */}
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium text-foreground tabular-nums">
                  {formatCurrency(subtotal, orgSettings.currency)}
                </span>
              </div>

              {/* Tax */}
              {orgSettings.taxRate > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {orgSettings.taxLabel} ({orgSettings.taxRate}%)
                  </span>
                  <span className="text-muted-foreground">
                    {formatCurrency(taxAmount, orgSettings.currency)}
                  </span>
                </div>
              )}

              {/* Discount */}
              <div className="flex items-center justify-between gap-2">
                <span className="shrink-0 text-sm text-muted-foreground">
                  Discount
                </span>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    min={0}
                    step={0.01}
                    placeholder="0"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="h-7 w-20 text-right text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setDiscountType("amount")}
                    className={`flex h-7 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                      discountType === "amount"
                        ? "border-[var(--flux-brand)] bg-[var(--flux-brand)] text-white"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    $
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType("percent")}
                    className={`flex h-7 w-8 items-center justify-center rounded-md border text-xs font-medium transition-colors ${
                      discountType === "percent"
                        ? "border-[var(--flux-brand)] bg-[var(--flux-brand)] text-white"
                        : "border-border bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    %
                  </button>
                </div>
              </div>

              {discountAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    Discount (
                    {discountType === "percent"
                      ? `${discountValue}%`
                      : "fixed"}
                    )
                  </span>
                  <span className="font-medium text-red-500">
                    -{formatCurrency(discountAmount, orgSettings.currency)}
                  </span>
                </div>
              )}

              <Separator />

              {/* TOTAL */}
              <div className="flex items-center justify-between py-1">
                <span className="text-xl font-bold text-foreground">TOTAL</span>
                <span className="text-2xl font-bold text-[var(--flux-brand)]">
                  {formatCurrency(total, orgSettings.currency)}
                </span>
              </div>
            </div>

            {/* Customer Info (Collapsible) */}
            <div className="px-4 pt-2">
              <button
                type="button"
                className="flex w-full items-center justify-between py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setCustomerExpanded(!customerExpanded)}
              >
                <span>Customer (Optional)</span>
                {customerExpanded ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </button>
              {customerExpanded && (
                <div className="space-y-2 pb-2">
                  <Input
                    placeholder="Customer name (optional)"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="Phone number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="customer@email.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="px-4 pb-2">
              <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                Payment Method
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {paymentMethods.map((method) => {
                  const Icon = method.icon;
                  const isActive = paymentMethod === method.value;
                  return (
                    <button
                      key={method.value}
                      type="button"
                      onClick={() => setPaymentMethod(method.value)}
                      className={`flex flex-col items-center gap-0.5 rounded-lg border py-2 text-center transition-colors ${
                        isActive
                          ? "border-[var(--flux-brand)] bg-[var(--flux-brand)] text-white"
                          : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4" />
                      <span className="text-[10px] font-medium leading-tight">
                        {method.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="px-4 pb-2">
              <Textarea
                placeholder="Sale notes (optional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-10 resize-none text-xs"
                rows={1}
              />
            </div>

            {/* Complete Sale Button */}
            <div className="space-y-2 p-4 pt-2">
              <Button
                className="h-12 w-full bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
                onClick={openConfirmSale}
                disabled={cart.length === 0 || completingSale}
              >
                {completingSale ? (
                  <>
                    <Loader2 className="mr-2 size-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 size-5" />
                    Complete Sale -{" "}
                    {formatCurrency(total, orgSettings.currency)}
                  </>
                )}
              </Button>

              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => clearCart()}
                  className="flex w-full items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="size-3" />
                  Clear cart
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          Confirmation Dialog — Review before finalizing
         ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="size-5 text-[var(--flux-brand)]" />
              Confirm Sale
            </DialogTitle>
            <DialogDescription>
              Review the order details below. An invoice will be generated automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[55vh] overflow-y-auto space-y-4">
            {/* Customer */}
            {customerName && (
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <span className="text-muted-foreground">Customer: </span>
                <span className="font-medium text-foreground">{customerName}</span>
                {customerPhone && (
                  <span className="text-muted-foreground ml-2">({customerPhone})</span>
                )}
              </div>
            )}

            {/* Items */}
            <div className="rounded-lg border border-border overflow-hidden">
              <div className="bg-muted/50 px-3 py-2 flex justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <span>Item</span>
                <span>Total</span>
              </div>
              {cart.map((item) => (
                <div
                  key={item.productId}
                  className="flex justify-between gap-3 px-3 py-2 border-t border-border text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} x {formatCurrency(item.unitPrice, orgSettings.currency)}
                    </p>
                  </div>
                  <span className="font-semibold text-foreground shrink-0">
                    {formatCurrency(item.unitPrice * item.quantity, orgSettings.currency)}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="text-foreground">{formatCurrency(subtotal, orgSettings.currency)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-red-500">-{formatCurrency(discountAmount, orgSettings.currency)}</span>
                </div>
              )}
              {orgSettings.taxRate > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{orgSettings.taxLabel} ({orgSettings.taxRate}%)</span>
                  <span className="text-foreground">{formatCurrency(taxAmount, orgSettings.currency)}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between pt-1">
                <span className="text-lg font-bold text-foreground">TOTAL</span>
                <span className="text-lg font-bold text-[var(--flux-brand)]">
                  {formatCurrency(total, orgSettings.currency)}
                </span>
              </div>
            </div>

            {/* Payment method */}
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Payment:</span>
              <span className="font-medium capitalize text-foreground">{paymentMethod.replace(/_/g, " ")}</span>
            </div>

            {notes && (
              <div className="text-sm">
                <span className="text-muted-foreground">Notes: </span>
                <span className="text-foreground">{notes}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setConfirmDialogOpen(false)}
            >
              Go Back
            </Button>
            <Button
              onClick={completeSale}
              disabled={completingSale}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              {completingSale ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <ShoppingCart className="mr-2 size-4" />
                  Confirm & Generate Invoice
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════
          Receipt Dialog
         ══════════════════════════════════════════════════════════════════ */}
      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-lg" showCloseButton={false}>
          <DialogHeader className="sr-only">
            <DialogTitle>Sale Complete</DialogTitle>
            <DialogDescription>Receipt details</DialogDescription>
          </DialogHeader>

          {lastSale && (
            <div className="max-h-[70vh] overflow-y-auto -mx-6 -mt-6 px-6 pt-6">
              {/* Success badge */}
              <div className="flex items-center justify-center gap-2 mb-5">
                <div className="flex size-10 items-center justify-center rounded-full bg-emerald-500/12">
                  <ReceiptText className="size-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground">Sale Complete</p>
                  <p className="text-xs text-muted-foreground">Receipt #{lastSale.saleNumber}</p>
                </div>
              </div>

              {/* Company Info */}
              <div className="text-center mb-4">
                <p className="text-base font-bold text-foreground">
                  {orgSettings.name || "Flux Business"}
                </p>
                {orgSettings.address && (
                  <p className="text-xs text-muted-foreground">
                    {orgSettings.address}
                  </p>
                )}
                {orgSettings.phone && (
                  <p className="text-xs text-muted-foreground">
                    {orgSettings.phone}
                  </p>
                )}
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(lastSale.createdAt).toLocaleString()}
                </p>
              </div>

              <Separator className="mb-4" />

              {/* Receipt Info */}
              <div className="space-y-1.5 text-sm mb-4">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Sale #</span>
                  <span className="font-medium text-foreground truncate text-right">
                    {lastSale.saleNumber}
                  </span>
                </div>
                {lastSale.customer && (
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Customer</span>
                    <span className="text-foreground truncate text-right">{lastSale.customer}</span>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground shrink-0">Payment</span>
                  <span className="capitalize text-foreground">
                    {lastSale.paymentMethod.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <Separator className="mb-4" />

              {/* Items */}
              <div className="mb-4">
                <div className="flex justify-between text-xs font-medium text-muted-foreground mb-2">
                  <span>Item</span>
                  <span>Amount</span>
                </div>
                <div className="space-y-1.5">
                  {lastSale.items.map((item, i) => (
                    <div key={i} className="flex justify-between gap-3 text-sm">
                      <span className="text-foreground truncate">
                        {item.name}{" "}
                        <span className="text-muted-foreground">x{item.quantity}</span>
                      </span>
                      <span className="font-medium text-foreground shrink-0">
                        {formatCurrency(item.total, orgSettings.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="mb-4" />

              {/* Totals */}
              <div className="space-y-1.5 text-sm mb-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="text-foreground">
                    {formatCurrency(lastSale.subtotal, orgSettings.currency)}
                  </span>
                </div>
                {lastSale.discount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Discount</span>
                    <span className="text-red-500">
                      -{formatCurrency(lastSale.discount, orgSettings.currency)}
                    </span>
                  </div>
                )}
                {lastSale.taxRate > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">
                      {orgSettings.taxLabel} ({lastSale.taxRate}%)
                    </span>
                    <span className="text-foreground">
                      {formatCurrency(lastSale.taxAmount, orgSettings.currency)}
                    </span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between py-1">
                  <span className="text-lg font-bold text-foreground">TOTAL</span>
                  <span className="text-lg font-bold text-[var(--flux-brand)]">
                    {formatCurrency(lastSale.total, orgSettings.currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {lastSale && (
            <DialogFooter className="flex-row gap-2 pt-2 border-t border-border -mx-6 px-6 -mb-6 pb-4 mt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="gap-1.5"
              >
                <Printer className="size-4" />
                Print
              </Button>
              <Button
                size="sm"
                onClick={() => shareWhatsApp(lastSale)}
                className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              >
                <MessageCircle className="size-4" />
                WhatsApp
              </Button>
              <Button
                size="sm"
                onClick={() => setReceiptDialogOpen(false)}
                className="gap-1.5 ml-auto"
              >
                <Plus className="size-4" />
                New Sale
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
