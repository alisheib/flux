"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { FormSelect } from "@/components/ui/form-select";
import { toast } from "sonner";
import { validateRequired, validateNumber, validateSKU, numbersOnly } from "@/lib/validate";
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  Tags,
  DollarSign,
  Download,
  Pencil,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Filter,
  FolderOpen,
  MoreHorizontal,
  Layers,
  Power,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: string;
  name: string;
  sku: string | null;
  description: string | null;
  categoryId: string | null;
  unit: string;
  thickness: number | null;
  width: number | null;
  height: number | null;
  color: string | null;
  costPrice: number;
  sellingPrice: number;
  stockQty: number;
  minStockQty: number;
  active: boolean;
  createdAt: string;
  category?: { id: string; name: string } | null;
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  fields: string | null; // JSON array: ["thickness","width","height","color"]
  _count?: { products: number };
}

// Optional product fields that can be toggled per category
const OPTIONAL_PRODUCT_FIELDS = [
  { key: "thickness", label: "Thickness" },
  { key: "width", label: "Width" },
  { key: "height", label: "Height" },
  { key: "color", label: "Color" },
] as const;

type OptionalFieldKey = (typeof OPTIONAL_PRODUCT_FIELDS)[number]["key"];

function parseCategoryFields(fields: string | null): OptionalFieldKey[] {
  if (!fields) return [];
  try { return JSON.parse(fields); }
  catch { return []; }
}

interface OrgSettings {
  currency: string;
}

type SortField =
  | "name"
  | "sku"
  | "stockQty"
  | "costPrice"
  | "sellingPrice"
  | "margin";
type SortDir = "asc" | "desc";

// ── Product Form Initial ─────────────────────────────────────────────────────

const emptyProductForm = {
  name: "",
  sku: "",
  description: "",
  categoryId: "",
  unit: "piece",
  thickness: "",
  width: "",
  height: "",
  color: "",
  costPrice: "",
  sellingPrice: "",
  stockQty: "",
  minStockQty: "",
};

const unitOptions = [
  { value: "piece", label: "Piece (pc)" },
  { value: "sheet", label: "Sheet" },
  { value: "meter", label: "Meter (m)" },
  { value: "cm", label: "Centimeter (cm)" },
  { value: "mm", label: "Millimeter (mm)" },
  { value: "inch", label: "Inch (in)" },
  { value: "foot", label: "Foot (ft)" },
  { value: "yard", label: "Yard (yd)" },
  { value: "sqm", label: "Sq Meter (m²)" },
  { value: "sqft", label: "Sq Foot (ft²)" },
  { value: "kg", label: "Kilogram (kg)" },
  { value: "gram", label: "Gram (g)" },
  { value: "lb", label: "Pound (lb)" },
  { value: "liter", label: "Liter (L)" },
  { value: "ml", label: "Milliliter (mL)" },
  { value: "gallon", label: "Gallon (gal)" },
  { value: "box", label: "Box" },
  { value: "carton", label: "Carton" },
  { value: "pallet", label: "Pallet" },
  { value: "roll", label: "Roll" },
  { value: "bundle", label: "Bundle" },
  { value: "pair", label: "Pair" },
  { value: "set", label: "Set" },
  { value: "dozen", label: "Dozen" },
  { value: "pack", label: "Pack" },
  { value: "bag", label: "Bag" },
  { value: "bottle", label: "Bottle" },
  { value: "tube", label: "Tube" },
  { value: "can", label: "Can" },
];

// ── Category accent colors ───────────────────────────────────────────────────

const CATEGORY_ACCENTS = [
  "bg-blue-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-purple-500",
  "bg-rose-500",
  "bg-cyan-500",
  "bg-orange-500",
  "bg-indigo-500",
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function InventoryPage() {
  const { user } = useAuth();

  // Data
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [orgSettings, setOrgSettings] = useState<OrgSettings>({
    currency: "USD",
  });
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Product dialog
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState(emptyProductForm);
  const [savingProduct, setSavingProduct] = useState(false);

  // Delete dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Category dialog
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryName, setCategoryName] = useState("");
  const [categoryFields, setCategoryFields] = useState<OptionalFieldKey[]>([]);
  const [savingCategory, setSavingCategory] = useState(false);

  // Category delete
  const [deleteCategoryDialogOpen, setDeleteCategoryDialogOpen] =
    useState(false);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(
    null
  );

  // ── Data Fetching ────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const [productsRes, categoriesRes, settingsRes] = await Promise.all([
        fetch("/api/products?limit=500"),
        fetch("/api/categories"),
        fetch("/api/settings"),
      ]);

      if (productsRes.ok) {
        const productsJson = await productsRes.json();
        setProducts(productsJson.data || productsJson);
      }
      if (categoriesRes.ok) setCategories(await categoriesRes.json());
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setOrgSettings({ currency: data.currency || "USD" });
      }
    } catch {
      toast.error("Failed to load inventory data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── KPI Metrics ──────────────────────────────────────────────────────────

  const metrics = useMemo(() => {
    const totalProducts = products.length;
    const totalStockValue = products.reduce(
      (sum, p) => sum + p.costPrice * p.stockQty,
      0
    );
    const lowStockCount = products.filter(
      (p) => p.stockQty <= p.minStockQty && p.active
    ).length;
    const categoryCount = categories.length;
    return { totalProducts, totalStockValue, lowStockCount, categoryCount };
  }, [products, categories]);

  // ── Filtered & Sorted Products ───────────────────────────────────────────

  const filteredProducts = useMemo(() => {
    let filtered = products.filter((p) => {
      const matchesSearch =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesCategory =
        filterCategory === "all" || p.categoryId === filterCategory;
      return matchesSearch && matchesCategory;
    });

    filtered.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = a.name.localeCompare(b.name);
          break;
        case "sku":
          cmp = (a.sku || "").localeCompare(b.sku || "");
          break;
        case "stockQty":
          cmp = a.stockQty - b.stockQty;
          break;
        case "costPrice":
          cmp = a.costPrice - b.costPrice;
          break;
        case "sellingPrice":
          cmp = a.sellingPrice - b.sellingPrice;
          break;
        case "margin": {
          const mA =
            a.costPrice > 0
              ? ((a.sellingPrice - a.costPrice) / a.costPrice) * 100
              : 0;
          const mB =
            b.costPrice > 0
              ? ((b.sellingPrice - b.costPrice) / b.costPrice) * 100
              : 0;
          cmp = mA - mB;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [products, searchQuery, filterCategory, sortField, sortDir]);

  const lowStockProducts = useMemo(
    () =>
      products.filter(
        (p) => p.stockQty <= p.minStockQty && p.active
      ),
    [products]
  );

  // ── Sort Handler ─────────────────────────────────────────────────────────

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 size-3 opacity-40" />;
    return sortDir === "asc" ? (
      <ArrowUp className="ml-1 size-3" />
    ) : (
      <ArrowDown className="ml-1 size-3" />
    );
  };

  // ── Stock Badge ────────────────────────────────────────────────────────

  const stockBadge = (product: Product) => {
    if (product.stockQty <= 0) {
      return (
        <span className="stock-out inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
          Out of stock
        </span>
      );
    }
    if (product.stockQty <= product.minStockQty) {
      return (
        <span className="stock-low inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
          Low: {formatNumber(product.stockQty, 0)}
        </span>
      );
    }
    return (
      <span className="stock-good inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium">
        {formatNumber(product.stockQty, 0)}
      </span>
    );
  };

  // ── Product CRUD ─────────────────────────────────────────────────────────

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setProductDialogOpen(true);
  };

  const openEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      sku: product.sku || "",
      description: product.description || "",
      categoryId: product.categoryId || "",
      unit: product.unit,
      thickness: product.thickness?.toString() || "",
      width: product.width?.toString() || "",
      height: product.height?.toString() || "",
      color: product.color || "",
      costPrice: product.costPrice.toString(),
      sellingPrice: product.sellingPrice.toString(),
      stockQty: product.stockQty.toString(),
      minStockQty: product.minStockQty.toString(),
    });
    setProductDialogOpen(true);
  };

  const handleSaveProduct = async () => {
    if (!validateRequired(productForm.name, "Product name")) return;
    if (productForm.sku && !validateSKU(productForm.sku)) return;
    if ((parseFloat(productForm.costPrice) || 0) < 0) { toast.error("Invalid cost price", { description: "Cost price cannot be negative." }); return; }
    if ((parseFloat(productForm.sellingPrice) || 0) < 0) { toast.error("Invalid selling price", { description: "Selling price cannot be negative." }); return; }
    if ((parseFloat(productForm.stockQty) || 0) < 0) { toast.error("Invalid stock", { description: "Stock quantity cannot be negative." }); return; }

    setSavingProduct(true);
    try {
      const payload = {
        name: productForm.name.trim(),
        sku: productForm.sku.trim() || null,
        description: productForm.description.trim() || null,
        categoryId: productForm.categoryId || null,
        unit: productForm.unit,
        thickness: productForm.thickness ? parseFloat(productForm.thickness) : null,
        width: productForm.width ? parseFloat(productForm.width) : null,
        height: productForm.height ? parseFloat(productForm.height) : null,
        color: productForm.color.trim() || null,
        costPrice: parseFloat(productForm.costPrice) || 0,
        sellingPrice: parseFloat(productForm.sellingPrice) || 0,
        stockQty: parseFloat(productForm.stockQty) || 0,
        minStockQty: parseFloat(productForm.minStockQty) || 0,
      };

      const url = editingProduct
        ? `/api/products/${editingProduct.id}`
        : "/api/products";
      const method = editingProduct ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save product");
      }

      toast.success(
        editingProduct ? "Product updated" : "Product created",
        { description: editingProduct ? `"${productForm.name}" has been saved.` : `"${productForm.name}" has been added to inventory.` }
      );
      setProductDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save product";
      toast.error(message);
    } finally {
      setSavingProduct(false);
    }
  };

  const toggleProductActive = async (product: Product) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !product.active }),
      });
      if (!res.ok) throw new Error("Failed to update product");
      toast.success(product.active ? "Product deactivated" : "Product reactivated");
      fetchData();
    } catch {
      toast.error("Failed to update product status");
    }
  };

  const openDeleteProduct = (product: Product) => {
    setDeletingProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteProduct = async () => {
    if (!deletingProduct) return;
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/products/${deletingProduct.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete product");
      }
      toast.success("Product deleted");
      setDeleteDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete product";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Category CRUD ────────────────────────────────────────────────────────

  const openAddCategory = () => {
    setEditingCategory(null);
    setCategoryName("");
    setCategoryFields([]);
    setCategoryDialogOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCategoryName(cat.name);
    setCategoryFields(parseCategoryFields(cat.fields));
    setCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!categoryName.trim()) {
      toast.error("Category name is required");
      return;
    }

    setSavingCategory(true);
    try {
      const url = editingCategory
        ? `/api/categories/${editingCategory.id}`
        : "/api/categories";
      const method = editingCategory ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: categoryName.trim(), fields: categoryFields }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to save category");
      }

      toast.success(
        editingCategory ? "Category updated" : "Category created"
      );
      setCategoryDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to save category";
      toast.error(message);
    } finally {
      setSavingCategory(false);
    }
  };

  const openDeleteCategory = (cat: Category) => {
    setDeletingCategory(cat);
    setDeleteCategoryDialogOpen(true);
  };

  const handleDeleteCategory = async () => {
    if (!deletingCategory) return;
    setIsDeleting(true);
    try {
      const response = await fetch(
        `/api/categories/${deletingCategory.id}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to delete category");
      }
      toast.success("Category deleted");
      setDeleteCategoryDialogOpen(false);
      fetchData();
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to delete category";
      toast.error(message);
    } finally {
      setIsDeleting(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────

  const handleExport = async () => {
    const { exportToExcel } = await import("@/lib/excel-export");

    const totalStockValue = filteredProducts.reduce(
      (s, p) => s + p.costPrice * p.stockQty, 0
    );
    const totalSellingValue = filteredProducts.reduce(
      (s, p) => s + p.sellingPrice * p.stockQty, 0
    );

    await exportToExcel({
      sheetName: "Inventory",
      title: "Inventory Report",
      subtitle: `${filteredProducts.length} products | ${filterCategory !== "all" ? `Category filter active | ` : ""}Generated ${new Date().toLocaleDateString()}`,
      currency: orgSettings.currency,
      filename: `inventory-${new Date().toISOString().split("T")[0]}`,
      columns: [
        { header: "Product Name", key: "name", width: 28, type: "string" },
        { header: "SKU", key: "sku", width: 16, type: "string" },
        { header: "Category", key: "category", width: 16, type: "string" },
        { header: "Stock Qty", key: "stockQty", width: 12, type: "number" },
        { header: "Unit", key: "unit", width: 10, type: "string" },
        { header: "Cost Price", key: "costPrice", width: 14, type: "currency" },
        { header: "Sell Price", key: "sellingPrice", width: 14, type: "currency" },
        { header: "Stock Value", key: "stockValue", width: 14, type: "currency" },
        { header: "Margin %", key: "margin", width: 11, type: "percent" },
        { header: "Status", key: "status", width: 10, type: "string" },
      ],
      data: filteredProducts.map((p) => ({
        name: p.name,
        sku: p.sku || "",
        category: p.category?.name || "Uncategorized",
        stockQty: p.stockQty,
        unit: p.unit,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        stockValue: p.costPrice * p.stockQty,
        margin: p.costPrice > 0
          ? ((p.sellingPrice - p.costPrice) / p.costPrice) * 100
          : 0,
        status: p.active ? "Active" : "Inactive",
      })),
      totalsRow: {
        name: "TOTALS",
        stockQty: filteredProducts.reduce((s, p) => s + p.stockQty, 0),
        stockValue: totalStockValue,
        sellingPrice: totalSellingValue,
      },
    });

    toast.success("Excel report downloaded");
  };

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ── Product Table Row ──────────────────────────────────────────────────

  const ProductRow = ({ product }: { product: Product }) => {
    const margin =
      product.costPrice > 0
        ? ((product.sellingPrice - product.costPrice) / product.costPrice) * 100
        : 0;

    return (
      <TableRow className="hover:bg-muted/40 transition-colors">
        <TableCell>
          <div>
            <p className="font-medium text-foreground">{product.name}</p>
            {product.description && (
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {product.description}
              </p>
            )}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground font-mono text-sm">
          {product.sku || "-"}
        </TableCell>
        <TableCell>
          {product.category ? (
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
              {product.category.name}
            </span>
          ) : (
            <span className="text-muted-foreground">-</span>
          )}
        </TableCell>
        <TableCell>{stockBadge(product)}</TableCell>
        <TableCell className="text-muted-foreground capitalize text-sm">
          {product.unit}
        </TableCell>
        <TableCell className="text-muted-foreground text-sm">
          {formatCurrency(product.costPrice, orgSettings.currency)}
        </TableCell>
        <TableCell className="font-medium text-foreground text-sm">
          {formatCurrency(product.sellingPrice, orgSettings.currency)}
        </TableCell>
        <TableCell>
          <span
            className={`text-sm font-semibold ${
              margin >= 20
                ? "text-emerald-600 dark:text-emerald-400"
                : margin >= 10
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-500"
            }`}
          >
            {margin.toFixed(1)}%
          </span>
        </TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
              product.active
                ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {product.active ? "Active" : "Inactive"}
          </span>
        </TableCell>
        <TableCell>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEditProduct(product)}>
                <Pencil className="mr-2 size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => toggleProductActive(product)}>
                <Power className="mr-2 size-4" />
                {product.active ? "Deactivate" : "Reactivate"}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => openDeleteProduct(product)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory"
        description="Manage your products and stock levels"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors">
              <Filter className="size-4 text-muted-foreground" />
              {filterCategory === "all"
                ? "All Categories"
                : categories.find((c) => c.id === filterCategory)?.name}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setFilterCategory("all")}>
              All Categories
            </DropdownMenuItem>
            {categories.map((cat) => (
              <DropdownMenuItem
                key={cat.id}
                onClick={() => setFilterCategory(cat.id)}
              >
                {cat.name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors"
        >
          <Download className="size-4 text-muted-foreground" />
          Export Excel
        </button>
        <button
          onClick={openAddProduct}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1813] shadow-sm hover:bg-[#c2410c] transition-colors"
        >
          <Plus className="size-4" />
          Add Product
        </button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {/* Total Products */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/12">
              <Package className="size-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Total Products
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {metrics.totalProducts}
              </p>
            </div>
          </div>
        </div>

        {/* Total Stock Value */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-500/12">
              <DollarSign className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Stock Value
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {formatCurrency(metrics.totalStockValue, orgSettings.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Low Stock Alerts */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-red-500/12">
              <AlertTriangle className="size-5 text-red-600 dark:text-red-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Low Stock
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {metrics.lowStockCount}
              </p>
            </div>
          </div>
        </div>

        {/* Categories */}
        <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-purple-500/12">
              <Layers className="size-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Categories
              </p>
              <p className="text-2xl font-semibold tracking-tight text-foreground">
                {metrics.categoryCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Products</TabsTrigger>
          <TabsTrigger value="low-stock">
            Low Stock
            {metrics.lowStockCount > 0 && (
              <span className="ml-1.5 inline-flex items-center rounded-full bg-red-500/12 px-1.5 py-0.5 text-xs font-medium text-red-600 dark:text-red-400">
                {metrics.lowStockCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        {/* ── All Products Tab ────────────────────────────────────────── */}
        <TabsContent value="all" className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search products by name or SKU..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>
                      <button
                        className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        onClick={() => toggleSort("name")}
                      >
                        Name
                        <SortIcon field="name" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        onClick={() => toggleSort("sku")}
                      >
                        SKU
                        <SortIcon field="sku" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Category
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        onClick={() => toggleSort("stockQty")}
                      >
                        Stock
                        <SortIcon field="stockQty" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Unit
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        onClick={() => toggleSort("costPrice")}
                      >
                        Cost
                        <SortIcon field="costPrice" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        onClick={() => toggleSort("sellingPrice")}
                      >
                        Sell Price
                        <SortIcon field="sellingPrice" />
                      </button>
                    </TableHead>
                    <TableHead>
                      <button
                        className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
                        onClick={() => toggleSort("margin")}
                      >
                        Margin
                        <SortIcon field="margin" />
                      </button>
                    </TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Status
                    </TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Package className="size-10 opacity-30" />
                          <p className="text-sm font-medium">
                            No products found
                          </p>
                          <p className="text-xs">
                            {searchQuery
                              ? "Try a different search term"
                              : "Add your first product to get started"}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredProducts.map((product) => (
                      <ProductRow key={product.id} product={product} />
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Low Stock Tab ───────────────────────────────────────────── */}
        <TabsContent value="low-stock" className="space-y-4">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SKU</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Current Stock</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Min Stock</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lowStockProducts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <AlertTriangle className="size-10 opacity-30" />
                          <p className="text-sm font-medium">
                            No low stock items
                          </p>
                          <p className="text-xs">
                            All products are above minimum stock levels
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    lowStockProducts.map((product) => (
                      <TableRow key={product.id} className="hover:bg-muted/40 transition-colors">
                        <TableCell className="font-medium text-foreground">
                          {product.name}
                        </TableCell>
                        <TableCell className="text-muted-foreground font-mono text-sm">
                          {product.sku || "-"}
                        </TableCell>
                        <TableCell>
                          {product.category ? (
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                              {product.category.name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`font-semibold ${
                              product.stockQty <= 0
                                ? "text-red-500"
                                : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {formatNumber(product.stockQty, 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatNumber(product.minStockQty, 0)}
                        </TableCell>
                        <TableCell>{stockBadge(product)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => openEditProduct(product)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Categories Tab ──────────────────────────────────────────── */}
        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={openAddCategory}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1813] shadow-sm hover:bg-[#c2410c] transition-colors"
            >
              <Plus className="size-4" />
              Add Category
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {categories.length === 0 ? (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                <FolderOpen className="mb-3 size-12 opacity-30" />
                <p className="text-sm font-medium">No categories yet</p>
                <p className="text-xs mt-1">Create your first category</p>
              </div>
            ) : (
              categories.map((cat, idx) => (
                <div
                  key={cat.id}
                  className="group relative bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden"
                >
                  {/* Colored accent stripe at top */}
                  <div className={`h-1 w-full ${CATEGORY_ACCENTS[idx % CATEGORY_ACCENTS.length]}`} />
                  <div className="p-4">
                    <h3 className="text-base font-semibold text-foreground">
                      {cat.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {cat._count?.products ?? 0} product
                      {(cat._count?.products ?? 0) !== 1 ? "s" : ""}
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => openEditCategory(cat)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <Pencil className="size-3" />
                        Edit
                      </button>
                      <button
                        onClick={() => openDeleteCategory(cat)}
                        className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 className="size-3" />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Add/Edit Product Dialog ──────────────────────────────────── */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              {editingProduct ? "Edit Product" : "Add Product"}
            </DialogTitle>
            <DialogDescription>
              {editingProduct
                ? "Update the product details below."
                : "Fill in the details to create a new product."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Section: Basic Info */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Basic Information</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Name *</Label>
                  <Input
                    value={productForm.name}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, name: e.target.value }))
                    }
                    placeholder="Product name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>SKU</Label>
                  <Input
                    value={productForm.sku}
                    onChange={(e) =>
                      setProductForm((f) => ({ ...f, sku: e.target.value }))
                    }
                    placeholder="SKU code"
                  />
                </div>
              </div>
              <div className="space-y-1.5 mt-3">
                <Label>Description</Label>
                <Textarea
                  value={productForm.description}
                  onChange={(e) =>
                    setProductForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  placeholder="Product description"
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div className="space-y-1.5">
                  <Label>Category</Label>
                  <FormSelect
                    value={productForm.categoryId}
                    onChange={(val) =>
                      setProductForm((f) => ({ ...f, categoryId: val }))
                    }
                    placeholder="Select category"
                    options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <FormSelect
                    value={productForm.unit}
                    onChange={(val) =>
                      setProductForm((f) => ({ ...f, unit: val }))
                    }
                    options={unitOptions}
                  />
                </div>
              </div>
            </div>

            {(() => {
              const selectedCat = categories.find((c) => c.id === productForm.categoryId);
              const enabledFields = selectedCat ? parseCategoryFields(selectedCat.fields) : [];
              if (enabledFields.length === 0) return null;
              return (
                <>
                  <Separator />
                  <div>
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Dimensions & Appearance</h4>
                    <div className={`grid gap-3 ${enabledFields.length <= 2 ? "grid-cols-2" : "grid-cols-4"}`}>
                      {enabledFields.includes("thickness") && (
                        <div className="space-y-1.5">
                          <Label>Thickness</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={productForm.thickness}
                            onChange={(e) =>
                              setProductForm((f) => ({ ...f, thickness: e.target.value }))
                            }
                            placeholder="mm"
                          />
                        </div>
                      )}
                      {enabledFields.includes("width") && (
                        <div className="space-y-1.5">
                          <Label>Width</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={productForm.width}
                            onChange={(e) =>
                              setProductForm((f) => ({ ...f, width: e.target.value }))
                            }
                            placeholder="mm"
                          />
                        </div>
                      )}
                      {enabledFields.includes("height") && (
                        <div className="space-y-1.5">
                          <Label>Height</Label>
                          <Input
                            type="number"
                            step="0.1"
                            value={productForm.height}
                            onChange={(e) =>
                              setProductForm((f) => ({ ...f, height: e.target.value }))
                            }
                            placeholder="mm"
                          />
                        </div>
                      )}
                      {enabledFields.includes("color") && (
                        <div className="space-y-1.5">
                          <Label>Color</Label>
                          <Input
                            value={productForm.color}
                            onChange={(e) =>
                              setProductForm((f) => ({ ...f, color: e.target.value }))
                            }
                            placeholder="Color"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}

            <Separator />

            {/* Section: Pricing & Stock */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Pricing & Stock</h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Cost Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productForm.costPrice}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        costPrice: e.target.value,
                      }))
                    }
                    onKeyDown={numbersOnly}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Selling Price</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={productForm.sellingPrice}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        sellingPrice: e.target.value,
                      }))
                    }
                    onKeyDown={numbersOnly}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Stock Quantity</Label>
                  <Input
                    type="number"
                    step="1"
                    value={productForm.stockQty}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        stockQty: e.target.value,
                      }))
                    }
                    onKeyDown={numbersOnly}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Min Stock Qty</Label>
                  <Input
                    type="number"
                    step="1"
                    value={productForm.minStockQty}
                    onChange={(e) =>
                      setProductForm((f) => ({
                        ...f,
                        minStockQty: e.target.value,
                      }))
                    }
                    onKeyDown={numbersOnly}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <button
              onClick={() => setProductDialogOpen(false)}
              className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProduct}
              disabled={savingProduct}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {savingProduct && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {editingProduct ? "Update" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Product Dialog ────────────────────────────────────── */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete Product</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingProduct?.name}&quot;?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteDialogOpen(false)}
              className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              Cancel
            </button>
            <Button
              variant="destructive"
              onClick={handleDeleteProduct}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Category Dialog ─────────────────────────────────── */}
      <Dialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
      >
        <DialogContent className="sm:max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Edit Category" : "Add Category"}
            </DialogTitle>
            <DialogDescription>
              {editingCategory
                ? "Update the category and choose which fields its products need."
                : "Create a category and choose which fields its products need."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Category name"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveCategory();
                }}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Product Fields</Label>
              <p className="text-xs text-muted-foreground/70">Choose which fields products in this category need.</p>
              <div className="grid grid-cols-2 gap-2">
                {OPTIONAL_PRODUCT_FIELDS.map((field) => {
                  const active = categoryFields.includes(field.key);
                  return (
                    <button
                      key={field.key}
                      type="button"
                      onClick={() =>
                        setCategoryFields((prev) =>
                          active
                            ? prev.filter((f) => f !== field.key)
                            : [...prev, field.key]
                        )
                      }
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                        active
                          ? "border-[#d97706] bg-[#d97706]/10 text-foreground"
                          : "border-border text-muted-foreground hover:border-foreground/30"
                      }`}
                    >
                      <span className={`size-3.5 rounded border-2 flex items-center justify-center ${
                        active ? "border-[#d97706] bg-[#d97706]" : "border-muted-foreground/40"
                      }`}>
                        {active && <span className="text-white text-[10px] font-bold leading-none">✓</span>}
                      </span>
                      {field.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <button
              onClick={() => setCategoryDialogOpen(false)}
              className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCategory}
              disabled={savingCategory}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {savingCategory && (
                <Loader2 className="size-4 animate-spin" />
              )}
              {editingCategory ? "Update" : "Create"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Category Dialog ───────────────────────────────────── */}
      <Dialog
        open={deleteCategoryDialogOpen}
        onOpenChange={setDeleteCategoryDialogOpen}
      >
        <DialogContent className="sm:max-w-sm rounded-xl">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingCategory?.name}&quot;?
              Products in this category will become uncategorized.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              onClick={() => setDeleteCategoryDialogOpen(false)}
              className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
            >
              Cancel
            </button>
            <Button
              variant="destructive"
              onClick={handleDeleteCategory}
              disabled={isDeleting}
            >
              {isDeleting && (
                <Loader2 className="mr-1.5 size-4 animate-spin" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
