"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Plus,
  Ship,
  Package,
  DollarSign,
  FileText,
  Pencil,
  Trash2,
  Loader2,
  ArrowLeft,
  ChevronRight,
  Calculator,
  BarChart3,
  X,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency, formatNumber } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSelect } from "@/components/ui/form-select";

// ─── Types ─────────────────────────────────────────────────────────────

interface Shipment {
  id: string;
  name: string;
  dossierNumber: string | null;
  invoiceNumber: string | null;
  containerNumber: string | null;
  containerType: string;
  containerCount: number;
  supplier: string | null;
  origin: string;
  exchangeRate: number;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { items: number; expenses: number };
  items?: ShipmentItem[];
  expenses?: ShipmentExpense[];
}

interface ShipmentItem {
  id: string;
  shipmentId: string;
  productId: string | null;
  name: string;
  thickness: number | null;
  width: number | null;
  height: number | null;
  color: string | null;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  notes: string | null;
  product?: { id: string; name: string; sku: string } | null;
}

interface ShipmentExpense {
  id: string;
  shipmentId: string;
  category: string;
  description: string;
  amountLocal: number;
  amountUsd: number;
  notes: string | null;
}

interface CostBreakdownProduct {
  itemId: string;
  name: string;
  totalQty: number;
  totalCost: number;
  valueShare: number;
  allocatedExpenses: number;
  landedCost: number;
  costPerUnit: number;
  margins: { percent: number; pricePerUnit: number }[];
}

interface CostBreakdown {
  totalFob: number;
  totalExpenses: number;
  totalLandedCost: number;
  avgCostPerUnit: number;
  totalQty: number;
  products: CostBreakdownProduct[];
  expensesByCategory: { category: string; total: number }[];
}

// ─── Status helpers ────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; dotColor: string; borderColor: string }> = {
  clearing: {
    label: "Clearing",
    dotColor: "bg-amber-500",
    borderColor: "border-l-amber-500",
  },
  in_transit: {
    label: "In Transit",
    dotColor: "bg-blue-500",
    borderColor: "border-l-blue-500",
  },
  in_warehouse: {
    label: "In Warehouse",
    dotColor: "bg-emerald-500",
    borderColor: "border-l-emerald-500",
  },
  completed: {
    label: "Completed",
    dotColor: "bg-gray-400",
    borderColor: "border-l-gray-400",
  },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.clearing;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground">
      <span className={`size-2 rounded-full ${config.dotColor}`} />
      {config.label}
    </span>
  );
}

const CONTAINER_TYPES = ["20HC", "40HC", "20GP", "40GP", "20OT", "40OT"];
const STATUSES = ["clearing", "in_transit", "in_warehouse", "completed"];
const EXPENSE_CATEGORIES = [
  "Shipping",
  "Customs",
  "Clearance",
  "Transport",
  "Inspection",
  "Tax",
  "Insurance",
  "Other",
];
const ITEM_UNITS = ["sheet", "piece", "box"];

// ─── Main Page Component ───────────────────────────────────────────────

export default function ShipmentsPage() {
  const { user } = useAuth();

  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [breakdown, setBreakdown] = useState<CostBreakdown | null>(null);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

  // Dialog states
  const [showNewShipment, setShowNewShipment] = useState(false);
  const [showEditShipment, setShowEditShipment] = useState(false);
  const [showDeleteShipment, setShowDeleteShipment] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [showEditItem, setShowEditItem] = useState(false);
  const [showDeleteItem, setShowDeleteItem] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [showDeleteExpense, setShowDeleteExpense] = useState(false);

  const [editingItem, setEditingItem] = useState<ShipmentItem | null>(null);
  const [editingExpense, setEditingExpense] = useState<ShipmentExpense | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Fetch shipments ──────────────────────────────────────────────

  const fetchShipments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/shipments?limit=500");
      if (!res.ok) throw new Error("Failed to fetch shipments");
      const data = await res.json();
      setShipments(data.data || data);
    } catch {
      toast.error("Failed to load shipments");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShipments();
  }, [fetchShipments]);

  // ─── Fetch detail ─────────────────────────────────────────────────

  const fetchShipmentDetail = useCallback(async (id: string) => {
    try {
      setDetailLoading(true);
      const res = await fetch(`/api/shipments/${id}`);
      if (!res.ok) throw new Error("Failed to fetch shipment");
      const data = await res.json();
      setSelectedShipment(data);
    } catch {
      toast.error("Failed to load shipment details");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  // ─── Fetch breakdown ─────────────────────────────────────────────

  const fetchBreakdown = useCallback(async (id: string) => {
    try {
      setBreakdownLoading(true);
      const res = await fetch(`/api/shipments/${id}/breakdown`);
      if (!res.ok) throw new Error("Failed to fetch breakdown");
      const data = await res.json();
      setBreakdown(data);
    } catch {
      toast.error("Failed to load cost breakdown");
    } finally {
      setBreakdownLoading(false);
    }
  }, []);

  // ─── Create shipment ─────────────────────────────────────────────

  const handleCreateShipment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      dossierNumber: form.get("dossierNumber") as string,
      invoiceNumber: form.get("invoiceNumber") as string,
      containerNumber: form.get("containerNumber") as string,
      containerType: form.get("containerType") as string,
      containerCount: parseInt(form.get("containerCount") as string) || 1,
      supplier: form.get("supplier") as string,
      origin: form.get("origin") as string,
      exchangeRate: parseFloat(form.get("exchangeRate") as string) || 2630,
      notes: form.get("notes") as string,
    };

    if (!body.name) {
      toast.error("Name is required");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch("/api/shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to create shipment");
      }
      toast.success("Shipment created");
      setShowNewShipment(false);
      fetchShipments();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to create shipment";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Update shipment ─────────────────────────────────────────────

  const handleUpdateShipment = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedShipment) return;
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      dossierNumber: form.get("dossierNumber") as string,
      invoiceNumber: form.get("invoiceNumber") as string,
      containerNumber: form.get("containerNumber") as string,
      containerType: form.get("containerType") as string,
      containerCount: parseInt(form.get("containerCount") as string) || 1,
      supplier: form.get("supplier") as string,
      origin: form.get("origin") as string,
      exchangeRate: parseFloat(form.get("exchangeRate") as string) || 2630,
      status: form.get("status") as string,
      notes: form.get("notes") as string,
    };

    try {
      setSaving(true);
      const res = await fetch(`/api/shipments/${selectedShipment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to update shipment");
      toast.success("Shipment updated");
      setShowEditShipment(false);
      fetchShipmentDetail(selectedShipment.id);
      fetchShipments();
    } catch {
      toast.error("Failed to update shipment");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete shipment ─────────────────────────────────────────────

  const handleDeleteShipment = async () => {
    if (!selectedShipment) return;
    try {
      setSaving(true);
      const res = await fetch(`/api/shipments/${selectedShipment.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete shipment");
      toast.success("Shipment deleted");
      setShowDeleteShipment(false);
      setSelectedShipment(null);
      fetchShipments();
    } catch {
      toast.error("Failed to delete shipment");
    } finally {
      setSaving(false);
    }
  };

  // ─── Create item ─────────────────────────────────────────────────

  const handleCreateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedShipment) return;
    const form = new FormData(e.currentTarget);
    const quantity = parseInt(form.get("quantity") as string) || 0;
    const unitCost = parseFloat(form.get("unitCost") as string) || 0;
    const body = {
      name: form.get("name") as string,
      thickness: parseFloat(form.get("thickness") as string) || null,
      width: parseFloat(form.get("width") as string) || null,
      height: parseFloat(form.get("height") as string) || null,
      color: form.get("color") as string,
      unit: form.get("unit") as string,
      quantity,
      unitCost,
    };

    if (!body.name || !quantity || !unitCost) {
      toast.error("Name, quantity, and unit cost are required");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/shipments/${selectedShipment.id}/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to add item");
      toast.success("Item added");
      setShowAddItem(false);
      fetchShipmentDetail(selectedShipment.id);
    } catch {
      toast.error("Failed to add item");
    } finally {
      setSaving(false);
    }
  };

  // ─── Update item ─────────────────────────────────────────────────

  const handleUpdateItem = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedShipment || !editingItem) return;
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      thickness: parseFloat(form.get("thickness") as string) || null,
      width: parseFloat(form.get("width") as string) || null,
      height: parseFloat(form.get("height") as string) || null,
      color: form.get("color") as string,
      unit: form.get("unit") as string,
      quantity: parseInt(form.get("quantity") as string) || 0,
      unitCost: parseFloat(form.get("unitCost") as string) || 0,
    };

    try {
      setSaving(true);
      const res = await fetch(
        `/api/shipments/${selectedShipment.id}/items/${editingItem.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("Failed to update item");
      toast.success("Item updated");
      setShowEditItem(false);
      setEditingItem(null);
      fetchShipmentDetail(selectedShipment.id);
    } catch {
      toast.error("Failed to update item");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete item ─────────────────────────────────────────────────

  const handleDeleteItem = async () => {
    if (!selectedShipment || !editingItem) return;
    try {
      setSaving(true);
      const res = await fetch(
        `/api/shipments/${selectedShipment.id}/items/${editingItem.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete item");
      toast.success("Item deleted");
      setShowDeleteItem(false);
      setEditingItem(null);
      fetchShipmentDetail(selectedShipment.id);
    } catch {
      toast.error("Failed to delete item");
    } finally {
      setSaving(false);
    }
  };

  // ─── Create expense ──────────────────────────────────────────────

  const handleCreateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedShipment) return;
    const form = new FormData(e.currentTarget);
    const body = {
      category: form.get("category") as string,
      description: form.get("description") as string,
      amountLocal: parseFloat(form.get("amountLocal") as string) || 0,
      amountUsd: parseFloat(form.get("amountUsd") as string) || 0,
    };

    if (!body.category || !body.description) {
      toast.error("Category and description are required");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/shipments/${selectedShipment.id}/expenses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed to add expense");
      toast.success("Expense added");
      setShowAddExpense(false);
      fetchShipmentDetail(selectedShipment.id);
    } catch {
      toast.error("Failed to add expense");
    } finally {
      setSaving(false);
    }
  };

  // ─── Update expense ──────────────────────────────────────────────

  const handleUpdateExpense = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedShipment || !editingExpense) return;
    const form = new FormData(e.currentTarget);
    const body = {
      category: form.get("category") as string,
      description: form.get("description") as string,
      amountLocal: parseFloat(form.get("amountLocal") as string) || 0,
      amountUsd: parseFloat(form.get("amountUsd") as string) || 0,
    };

    try {
      setSaving(true);
      const res = await fetch(
        `/api/shipments/${selectedShipment.id}/expenses/${editingExpense.id}`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) throw new Error("Failed to update expense");
      toast.success("Expense updated");
      setShowEditExpense(false);
      setEditingExpense(null);
      fetchShipmentDetail(selectedShipment.id);
    } catch {
      toast.error("Failed to update expense");
    } finally {
      setSaving(false);
    }
  };

  // ─── Delete expense ──────────────────────────────────────────────

  const handleDeleteExpense = async () => {
    if (!selectedShipment || !editingExpense) return;
    try {
      setSaving(true);
      const res = await fetch(
        `/api/shipments/${selectedShipment.id}/expenses/${editingExpense.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete expense");
      toast.success("Expense deleted");
      setShowDeleteExpense(false);
      setEditingExpense(null);
      fetchShipmentDetail(selectedShipment.id);
    } catch {
      toast.error("Failed to delete expense");
    } finally {
      setSaving(false);
    }
  };

  // ─── Select a shipment ───────────────────────────────────────────

  const openShipment = (shipment: Shipment) => {
    fetchShipmentDetail(shipment.id);
    setBreakdown(null);
  };

  // ─── Render ──────────────────────────────────────────────────────

  if (selectedShipment && !detailLoading) {
    const statusBorder = STATUS_CONFIG[selectedShipment.status]?.borderColor || "border-l-amber-500";

    return (
      <div className="flex flex-col gap-6">
        {/* Back to list */}
        <div className="flex items-center gap-4">
          <button
            onClick={() => setSelectedShipment(null)}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          >
            <ArrowLeft className="size-4" />
            Back to Shipments
          </button>
        </div>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {selectedShipment.name}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={selectedShipment.status} />
              <span className="text-sm text-muted-foreground">
                {selectedShipment.containerType} x{selectedShipment.containerCount}
              </span>
              {selectedShipment.supplier && (
                <span className="text-sm text-muted-foreground">
                  from {selectedShipment.supplier}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditShipment(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground shadow-sm hover:bg-muted/60 transition-colors"
            >
              <Pencil className="size-4" />
              Edit
            </button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteShipment(true)}
            >
              <Trash2 className="mr-1 size-4" />
              Delete
            </Button>
          </div>
        </div>

        {/* Tabs — underline style */}
        <Tabs defaultValue="overview">
          <div className="border-b border-border">
            <TabsList className="bg-transparent p-0 h-auto gap-0">
              <TabsTrigger
                value="overview"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#d97706] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
              >
                Overview
              </TabsTrigger>
              <TabsTrigger
                value="items"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#d97706] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
              >
                Items ({selectedShipment.items?.length || 0})
              </TabsTrigger>
              <TabsTrigger
                value="expenses"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#d97706] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
              >
                Expenses ({selectedShipment.expenses?.length || 0})
              </TabsTrigger>
              <TabsTrigger
                value="breakdown"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-[#d97706] data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 pb-2.5 pt-1 text-sm font-medium text-muted-foreground data-[state=active]:text-foreground"
                onClick={() => {
                  if (!breakdown) fetchBreakdown(selectedShipment.id);
                }}
              >
                Cost Breakdown
              </TabsTrigger>
            </TabsList>
          </div>

          {/* ── Overview Tab ───────────────────────────────────── */}
          <TabsContent value="overview" className="pt-6">
            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-5">
                <Ship className="size-5 text-muted-foreground" />
                <h2 className="text-base font-semibold text-foreground">Shipment Details</h2>
              </div>
              <div className="grid grid-cols-1 gap-y-4 gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                <InfoField label="Shipment Name" value={selectedShipment.name} />
                <InfoField
                  label="Dossier Number"
                  value={selectedShipment.dossierNumber || "-"}
                />
                <InfoField
                  label="Invoice Number"
                  value={selectedShipment.invoiceNumber || "-"}
                />
                <InfoField
                  label="Container Number"
                  value={selectedShipment.containerNumber || "-"}
                />
                <InfoField
                  label="Container Type"
                  value={`${selectedShipment.containerType} x${selectedShipment.containerCount}`}
                />
                <InfoField
                  label="Supplier"
                  value={selectedShipment.supplier || "-"}
                />
                <InfoField label="Origin" value={selectedShipment.origin} />
                <InfoField
                  label="Exchange Rate"
                  value={formatNumber(selectedShipment.exchangeRate, 2)}
                />
                <InfoField
                  label="Status"
                  value={
                    STATUS_CONFIG[selectedShipment.status]?.label ||
                    selectedShipment.status
                  }
                />
                <InfoField
                  label="Created"
                  value={format(
                    new Date(selectedShipment.createdAt),
                    "MMM dd, yyyy"
                  )}
                />
                <InfoField
                  label="Updated"
                  value={format(
                    new Date(selectedShipment.updatedAt),
                    "MMM dd, yyyy"
                  )}
                />
              </div>
              {selectedShipment.notes && (
                <div className="mt-5 pt-4 border-t border-border">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes</p>
                  <p className="mt-1.5 text-sm text-foreground">
                    {selectedShipment.notes}
                  </p>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Items Tab ──────────────────────────────────────── */}
          <TabsContent value="items" className="pt-6">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Package className="size-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-foreground">Shipment Items</h2>
                </div>
                <button
                  onClick={() => setShowAddItem(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1813] shadow-sm hover:bg-[#c2410c] transition-colors"
                >
                  <Plus className="size-4" />
                  Add Item
                </button>
              </div>
              <div className="overflow-x-auto">
                {selectedShipment.items && selectedShipment.items.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Name</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Thickness</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Color</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Unit</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Quantity</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Unit Cost</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Total Cost</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedShipment.items.map((item) => (
                        <TableRow key={item.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell className="font-medium text-foreground">
                            {item.name}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.thickness ? `${item.thickness}mm` : "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {item.color || "-"}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm capitalize">
                            {item.unit}
                          </TableCell>
                          <TableCell className="text-right text-foreground font-medium">
                            {formatNumber(item.quantity, 0)}
                          </TableCell>
                          <TableCell className="text-right text-foreground text-sm">
                            {formatCurrency(item.unitCost)}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {formatCurrency(item.totalCost)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  setEditingItem(item);
                                  setShowEditItem(true);
                                }}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  setEditingItem(item);
                                  setShowDeleteItem(true);
                                }}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={4} className="font-semibold text-foreground">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {formatNumber(
                            selectedShipment.items.reduce(
                              (s, i) => s + i.quantity,
                              0
                            ),
                            0
                          )}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right font-semibold text-foreground">
                          {formatCurrency(
                            selectedShipment.items.reduce(
                              (s, i) => s + i.totalCost,
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <Package className="mb-3 size-10 opacity-30" />
                    <p className="text-sm font-medium">No items yet</p>
                    <button
                      onClick={() => setShowAddItem(true)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                    >
                      Add First Item
                    </button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Expenses Tab ───────────────────────────────────── */}
          <TabsContent value="expenses" className="pt-6">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="flex items-center justify-between p-5 border-b border-border">
                <div className="flex items-center gap-2">
                  <DollarSign className="size-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-foreground">Shipment Expenses</h2>
                </div>
                <button
                  onClick={() => setShowAddExpense(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1813] shadow-sm hover:bg-[#c2410c] transition-colors"
                >
                  <Plus className="size-4" />
                  Add Expense
                </button>
              </div>
              <div className="overflow-x-auto">
                {selectedShipment.expenses &&
                selectedShipment.expenses.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50 hover:bg-muted/50">
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Category</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Local Amount</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">USD Amount</TableHead>
                        <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedShipment.expenses.map((expense) => (
                        <TableRow key={expense.id} className="hover:bg-muted/40 transition-colors">
                          <TableCell>
                            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                              {expense.category}
                            </span>
                          </TableCell>
                          <TableCell className="text-foreground text-sm">
                            {expense.description}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {formatCurrency(expense.amountLocal, "TSH")}
                          </TableCell>
                          <TableCell className="text-right font-medium text-foreground">
                            {formatCurrency(expense.amountUsd)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setShowEditExpense(true);
                                }}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => {
                                  setEditingExpense(expense);
                                  setShowDeleteExpense(true);
                                }}
                              >
                                <Trash2 className="size-3.5 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="bg-muted/30">
                        <TableCell colSpan={2} className="font-semibold text-foreground">
                          Total
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {formatCurrency(
                            selectedShipment.expenses.reduce(
                              (s, e) => s + e.amountLocal,
                              0
                            ),
                            "TSH"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          {formatCurrency(
                            selectedShipment.expenses.reduce(
                              (s, e) => s + e.amountUsd,
                              0
                            )
                          )}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <DollarSign className="mb-3 size-10 opacity-30" />
                    <p className="text-sm font-medium">No expenses yet</p>
                    <button
                      onClick={() => setShowAddExpense(true)}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                    >
                      Add First Expense
                    </button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* ── Cost Breakdown Tab ─────────────────────────────── */}
          <TabsContent value="breakdown" className="pt-6">
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 border-b border-border">
                <div className="flex items-center gap-2">
                  <Calculator className="size-5 text-muted-foreground" />
                  <h2 className="text-base font-semibold text-foreground">Cost Breakdown & Margin Analysis</h2>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Allocation of expenses across items with margin calculations
                </p>
              </div>
              <div className="p-5">
                {breakdownLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="size-8 animate-spin text-muted-foreground" />
                  </div>
                ) : breakdown ? (
                  <div className="space-y-6">
                    {/* Summary KPI cards */}
                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                      <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total FOB</p>
                        <p className="text-2xl font-semibold tracking-tight text-foreground mt-1">
                          {formatCurrency(breakdown.totalFob)}
                        </p>
                      </div>
                      <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Total Expenses
                        </p>
                        <p className="text-2xl font-semibold tracking-tight text-foreground mt-1">
                          {formatCurrency(breakdown.totalExpenses)}
                        </p>
                      </div>
                      <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Total Landed Cost
                        </p>
                        <p className="text-2xl font-semibold tracking-tight text-foreground mt-1">
                          {formatCurrency(breakdown.totalLandedCost)}
                        </p>
                      </div>
                      <div className="bg-card border border-border rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                          Avg Cost / Unit
                        </p>
                        <p className="text-2xl font-semibold tracking-tight text-foreground mt-1">
                          {formatCurrency(breakdown.avgCostPerUnit)}
                        </p>
                      </div>
                    </div>

                    {/* Expenses by category */}
                    {breakdown.expensesByCategory.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                          Expenses by Category
                        </h3>
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                          {breakdown.expensesByCategory.map((cat) => (
                            <div
                              key={cat.category}
                              className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                            >
                              <span className="text-sm text-muted-foreground">
                                {cat.category}
                              </span>
                              <span className="text-sm font-semibold text-foreground">
                                {formatCurrency(cat.total)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Allocation table */}
                    {breakdown.products.length > 0 && (
                      <div>
                        <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">
                          Cost Allocation per Item
                        </h3>
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/50 hover:bg-muted/50">
                                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Item</TableHead>
                                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Qty</TableHead>
                                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">FOB Cost</TableHead>
                                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                                  Value Share
                                </TableHead>
                                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                                  Alloc. Expenses
                                </TableHead>
                                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                                  Landed Cost
                                </TableHead>
                                <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">
                                  Cost/Unit
                                </TableHead>
                                {breakdown.products[0]?.margins.map((m) => (
                                  <TableHead
                                    key={m.percent}
                                    className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right"
                                  >
                                    +{m.percent}%
                                  </TableHead>
                                ))}
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {breakdown.products.map((product, idx) => (
                                <TableRow
                                  key={product.itemId}
                                  className={`hover:bg-muted/40 transition-colors ${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                                >
                                  <TableCell className="font-medium text-foreground">
                                    {product.name}
                                  </TableCell>
                                  <TableCell className="text-right text-foreground">
                                    {formatNumber(product.totalQty, 0)}
                                  </TableCell>
                                  <TableCell className="text-right text-foreground text-sm">
                                    {formatCurrency(product.totalCost)}
                                  </TableCell>
                                  <TableCell className="text-right text-muted-foreground text-sm">
                                    {(product.valueShare * 100).toFixed(1)}%
                                  </TableCell>
                                  <TableCell className="text-right text-foreground text-sm">
                                    {formatCurrency(product.allocatedExpenses)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-foreground">
                                    {formatCurrency(product.landedCost)}
                                  </TableCell>
                                  <TableCell className="text-right font-semibold text-foreground">
                                    {formatCurrency(product.costPerUnit)}
                                  </TableCell>
                                  {product.margins.map((m) => (
                                    <TableCell
                                      key={m.percent}
                                      className="text-right text-foreground text-sm"
                                    >
                                      {formatCurrency(m.pricePerUnit)}
                                    </TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                    <BarChart3 className="mb-3 size-10 opacity-30" />
                    <p className="text-sm font-medium">No breakdown data available</p>
                    <p className="text-xs mt-1">
                      Add items and expenses first, then view the breakdown.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* ── Edit Shipment Dialog ──────────────────────────────── */}
        <Dialog open={showEditShipment} onOpenChange={setShowEditShipment}>
          <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg rounded-xl">
            <DialogHeader>
              <DialogTitle>Edit Shipment</DialogTitle>
              <DialogDescription>
                Update shipment information
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleUpdateShipment} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={selectedShipment.name}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-dossierNumber">Dossier Number</Label>
                  <Input
                    id="edit-dossierNumber"
                    name="dossierNumber"
                    defaultValue={selectedShipment.dossierNumber || ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-invoiceNumber">Invoice Number</Label>
                  <Input
                    id="edit-invoiceNumber"
                    name="invoiceNumber"
                    defaultValue={selectedShipment.invoiceNumber || ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-containerNumber">Container Number</Label>
                  <Input
                    id="edit-containerNumber"
                    name="containerNumber"
                    defaultValue={selectedShipment.containerNumber || ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-containerType">Container Type</Label>
                  <FormSelect
                    id="edit-containerType"
                    name="containerType"
                    defaultValue={selectedShipment.containerType}
                    options={CONTAINER_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-containerCount">Container Count</Label>
                  <Input
                    id="edit-containerCount"
                    name="containerCount"
                    type="number"
                    min={1}
                    defaultValue={selectedShipment.containerCount}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-status">Status</Label>
                  <FormSelect
                    id="edit-status"
                    name="status"
                    defaultValue={selectedShipment.status}
                    options={STATUSES.map((s) => ({ value: s, label: STATUS_CONFIG[s]?.label || s }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-supplier">Supplier</Label>
                  <Input
                    id="edit-supplier"
                    name="supplier"
                    defaultValue={selectedShipment.supplier || ""}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-origin">Origin</Label>
                  <Input
                    id="edit-origin"
                    name="origin"
                    defaultValue={selectedShipment.origin}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-exchangeRate">Exchange Rate</Label>
                  <Input
                    id="edit-exchangeRate"
                    name="exchangeRate"
                    type="number"
                    step="0.01"
                    defaultValue={selectedShipment.exchangeRate}
                  />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label htmlFor="edit-notes">Notes</Label>
                  <Textarea
                    id="edit-notes"
                    name="notes"
                    defaultValue={selectedShipment.notes || ""}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <button
                  type="button"
                  onClick={() => setShowEditShipment(false)}
                  className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {saving && <Loader2 className="size-4 animate-spin" />}
                  Save Changes
                </button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ── Delete Shipment Dialog ────────────────────────────── */}
        <Dialog open={showDeleteShipment} onOpenChange={setShowDeleteShipment}>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>Delete Shipment</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{selectedShipment.name}&quot;?
                This will also delete all associated items and expenses. This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                onClick={() => setShowDeleteShipment(false)}
                className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                Cancel
              </button>
              <Button
                variant="destructive"
                onClick={handleDeleteShipment}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Delete Shipment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Add Item Dialog ──────────────────────────────────── */}
        <Dialog open={showAddItem} onOpenChange={setShowAddItem}>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>Add Item</DialogTitle>
              <DialogDescription>
                Add a new item to this shipment
              </DialogDescription>
            </DialogHeader>
            <ItemForm
              onSubmit={handleCreateItem}
              saving={saving}
              onCancel={() => setShowAddItem(false)}
            />
          </DialogContent>
        </Dialog>

        {/* ── Edit Item Dialog ─────────────────────────────────── */}
        <Dialog
          open={showEditItem}
          onOpenChange={(open) => {
            setShowEditItem(open);
            if (!open) setEditingItem(null);
          }}
        >
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>Edit Item</DialogTitle>
              <DialogDescription>Update item details</DialogDescription>
            </DialogHeader>
            {editingItem && (
              <ItemForm
                item={editingItem}
                onSubmit={handleUpdateItem}
                saving={saving}
                onCancel={() => {
                  setShowEditItem(false);
                  setEditingItem(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* ── Delete Item Dialog ───────────────────────────────── */}
        <Dialog
          open={showDeleteItem}
          onOpenChange={(open) => {
            setShowDeleteItem(open);
            if (!open) setEditingItem(null);
          }}
        >
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>Delete Item</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete &quot;{editingItem?.name}&quot;? This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                onClick={() => {
                  setShowDeleteItem(false);
                  setEditingItem(null);
                }}
                className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                Cancel
              </button>
              <Button
                variant="destructive"
                onClick={handleDeleteItem}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Delete Item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Add Expense Dialog ───────────────────────────────── */}
        <Dialog open={showAddExpense} onOpenChange={setShowAddExpense}>
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>Add Expense</DialogTitle>
              <DialogDescription>
                Add a new expense to this shipment
              </DialogDescription>
            </DialogHeader>
            <ExpenseForm
              onSubmit={handleCreateExpense}
              saving={saving}
              onCancel={() => setShowAddExpense(false)}
            />
          </DialogContent>
        </Dialog>

        {/* ── Edit Expense Dialog ──────────────────────────────── */}
        <Dialog
          open={showEditExpense}
          onOpenChange={(open) => {
            setShowEditExpense(open);
            if (!open) setEditingExpense(null);
          }}
        >
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>Edit Expense</DialogTitle>
              <DialogDescription>Update expense details</DialogDescription>
            </DialogHeader>
            {editingExpense && (
              <ExpenseForm
                expense={editingExpense}
                onSubmit={handleUpdateExpense}
                saving={saving}
                onCancel={() => {
                  setShowEditExpense(false);
                  setEditingExpense(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>

        {/* ── Delete Expense Dialog ────────────────────────────── */}
        <Dialog
          open={showDeleteExpense}
          onOpenChange={(open) => {
            setShowDeleteExpense(open);
            if (!open) setEditingExpense(null);
          }}
        >
          <DialogContent className="rounded-xl">
            <DialogHeader>
              <DialogTitle>Delete Expense</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this expense? This action cannot
                be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <button
                onClick={() => {
                  setShowDeleteExpense(false);
                  setEditingExpense(null);
                }}
                className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                Cancel
              </button>
              <Button
                variant="destructive"
                onClick={handleDeleteExpense}
                disabled={saving}
              >
                {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
                Delete Expense
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── Loading state for detail ────────────────────────────────────

  if (detailLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Loading shipment...</p>
      </div>
    );
  }

  // ─── Shipments list view ─────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Shipments"
        description="Manage container imports and cost allocation"
      >
        <button
          onClick={() => setShowNewShipment(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1813] shadow-sm hover:bg-[#c2410c] transition-colors"
        >
          <Plus className="size-4" />
          New Shipment
        </button>
      </PageHeader>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Loading shipments...</p>
        </div>
      ) : shipments.length === 0 ? (
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <Ship className="mb-4 size-12 text-muted-foreground opacity-30" />
            <h3 className="text-lg font-semibold text-foreground">
              No shipments yet
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first shipment to start tracking imports
            </p>
            <button
              onClick={() => setShowNewShipment(true)}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#d97706] px-3 py-1.5 text-sm font-medium text-[#1a1813] shadow-sm hover:bg-[#c2410c] transition-colors"
            >
              <Plus className="size-4" />
              New Shipment
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shipments.map((shipment) => {
            const borderCls = STATUS_CONFIG[shipment.status]?.borderColor || "border-l-amber-500";
            return (
              <div
                key={shipment.id}
                className={`bg-card border border-border rounded-xl shadow-sm hover:shadow-md transition-shadow cursor-pointer border-l-[3px] ${borderCls}`}
                onClick={() => openShipment(shipment)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div className="space-y-0.5 min-w-0">
                      <h3 className="text-base font-semibold text-foreground truncate">
                        {shipment.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        {shipment.containerType} x{shipment.containerCount}
                        {shipment.supplier && ` | ${shipment.supplier}`}
                      </p>
                    </div>
                    <StatusBadge status={shipment.status} />
                  </div>
                  <div className="flex items-center justify-between text-sm mt-4 pt-3 border-t border-border">
                    <div className="space-y-0.5">
                      <p className="text-muted-foreground">
                        Origin: {shipment.origin}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(shipment.createdAt), "MMM dd, yyyy")}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span className="flex items-center gap-1 text-xs">
                        <Package className="size-3.5" />
                        {shipment._count?.items || 0}
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        <FileText className="size-3.5" />
                        {shipment._count?.expenses || 0}
                      </span>
                      <ChevronRight className="size-4 text-muted-foreground/60" />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── New Shipment Dialog ──────────────────────────────── */}
      <Dialog open={showNewShipment} onOpenChange={setShowNewShipment}>
        <DialogContent className="max-h-[90vh] overflow-y-auto max-w-lg rounded-xl">
          <DialogHeader>
            <DialogTitle>New Shipment</DialogTitle>
            <DialogDescription>
              Create a new container import shipment
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateShipment} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="new-name">Name *</Label>
                <Input
                  id="new-name"
                  name="name"
                  placeholder="e.g., Container March 2026"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-dossierNumber">Dossier Number</Label>
                <Input
                  id="new-dossierNumber"
                  name="dossierNumber"
                  placeholder="Dossier number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-invoiceNumber">Invoice Number</Label>
                <Input
                  id="new-invoiceNumber"
                  name="invoiceNumber"
                  placeholder="Invoice reference"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-containerNumber">Container Number</Label>
                <Input
                  id="new-containerNumber"
                  name="containerNumber"
                  placeholder="Container number"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-containerType">Container Type</Label>
                <FormSelect
                  id="new-containerType"
                  name="containerType"
                  defaultValue="20HC"
                  options={CONTAINER_TYPES.map((t) => ({ value: t, label: t }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-containerCount">Container Count</Label>
                <Input
                  id="new-containerCount"
                  name="containerCount"
                  type="number"
                  min={1}
                  defaultValue={1}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-supplier">Supplier</Label>
                <Input
                  id="new-supplier"
                  name="supplier"
                  placeholder="Supplier name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-origin">Origin</Label>
                <Input
                  id="new-origin"
                  name="origin"
                  defaultValue="China"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-exchangeRate">Exchange Rate</Label>
                <Input
                  id="new-exchangeRate"
                  name="exchangeRate"
                  type="number"
                  step="0.01"
                  defaultValue={2630}
                />
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label htmlFor="new-notes">Notes</Label>
                <Textarea
                  id="new-notes"
                  name="notes"
                  placeholder="Optional notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <button
                type="button"
                onClick={() => setShowNewShipment(false)}
                className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Create Shipment
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Info field helper ─────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

// ─── Item Form component ───────────────────────────────────────────────

function ItemForm({
  item,
  onSubmit,
  saving,
  onCancel,
}: {
  item?: ShipmentItem;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  onCancel: () => void;
}) {
  const [quantity, setQuantity] = useState(item?.quantity || 0);
  const [unitCost, setUnitCost] = useState(item?.unitCost || 0);

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="item-name">Name *</Label>
          <Input
            id="item-name"
            name="name"
            defaultValue={item?.name || ""}
            placeholder="Item description"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-thickness">Thickness (mm)</Label>
          <Input
            id="item-thickness"
            name="thickness"
            type="number"
            step="0.01"
            defaultValue={item?.thickness || ""}
            placeholder="0.4"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-width">Width (mm)</Label>
          <Input
            id="item-width"
            name="width"
            type="number"
            step="0.01"
            defaultValue={item?.width || ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-height">Height (mm)</Label>
          <Input
            id="item-height"
            name="height"
            type="number"
            step="0.01"
            defaultValue={item?.height || ""}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-color">Color</Label>
          <Input
            id="item-color"
            name="color"
            defaultValue={item?.color || ""}
            placeholder="e.g., Silver"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-unit">Unit</Label>
          <FormSelect
            id="item-unit"
            name="unit"
            defaultValue={item?.unit || "sheet"}
            options={ITEM_UNITS.map((u) => ({ value: u, label: u }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-quantity">Quantity *</Label>
          <Input
            id="item-quantity"
            name="quantity"
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="item-unitCost">Unit Cost ($) *</Label>
          <Input
            id="item-unitCost"
            name="unitCost"
            type="number"
            step="0.01"
            min={0}
            value={unitCost}
            onChange={(e) => setUnitCost(parseFloat(e.target.value) || 0)}
            required
          />
        </div>
        <div className="col-span-2">
          <div className="rounded-lg bg-muted/50 border border-border px-3 py-2.5">
            <span className="text-sm text-muted-foreground">Total Cost: </span>
            <span className="text-sm font-semibold text-foreground">
              {formatCurrency(quantity * unitCost)}
            </span>
          </div>
        </div>
      </div>
      <DialogFooter>
        <button type="button" onClick={onCancel} className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {item ? "Save Changes" : "Add Item"}
        </button>
      </DialogFooter>
    </form>
  );
}

// ─── Expense Form component ────────────────────────────────────────────

function ExpenseForm({
  expense,
  onSubmit,
  saving,
  onCancel,
}: {
  expense?: ShipmentExpense;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  saving: boolean;
  onCancel: () => void;
}) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="expense-category">Category *</Label>
          <FormSelect
            id="expense-category"
            name="category"
            defaultValue={expense?.category || "Shipping"}
            options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: c }))}
          />
        </div>
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="expense-description">Description *</Label>
          <Input
            id="expense-description"
            name="description"
            defaultValue={expense?.description || ""}
            placeholder="e.g., Ocean freight charges"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense-amountLocal">Local Amount (TSh)</Label>
          <Input
            id="expense-amountLocal"
            name="amountLocal"
            type="number"
            step="0.01"
            defaultValue={expense?.amountLocal || 0}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="expense-amountUsd">USD Amount ($)</Label>
          <Input
            id="expense-amountUsd"
            name="amountUsd"
            type="number"
            step="0.01"
            defaultValue={expense?.amountUsd || 0}
          />
        </div>
      </div>
      <DialogFooter>
        <button type="button" onClick={onCancel} className="inline-flex items-center rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-foreground hover:bg-muted/60 transition-colors">
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {expense ? "Save Changes" : "Add Expense"}
        </button>
      </DialogFooter>
    </form>
  );
}
