"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ArrowRight,
  Package,
  Wallet,
  Users,
  RefreshCw,
  Plus,
  Upload,
  Download,
  Loader2,
  X,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface ColumnMapping {
  excelColumn: string;
  systemField: string;
  required: boolean;
}

interface ValidationRule {
  field: string;
  label: string;
  type: "text" | "number" | "date" | "email" | "phone" | "enum";
  required: boolean;
  regex: string;
  min: string;
  max: string;
  allowed: string[];
  message: string;
}

// ── Entity type cards ───────────────────────────────────────────────────

const ENTITY_TYPES = [
  { id: "inventory", label: "Inventory", icon: Package, desc: "Products, stock levels, pricing" },
  { id: "expenses", label: "Expenses", icon: Wallet, desc: "Bills, costs, receipts" },
  { id: "employees", label: "Employees", icon: Users, desc: "Staff, payroll, contacts" },
  { id: "transactions", label: "Transactions", icon: RefreshCw, desc: "Sales, purchases, transfers" },
];

// ── System fields per entity type ───────────────────────────────────────

const SYSTEM_FIELDS: Record<string, { id: string; label: string; required: boolean }[]> = {
  inventory: [
    { id: "sku", label: "SKU", required: true },
    { id: "name", label: "Product name", required: true },
    { id: "category", label: "Category", required: false },
    { id: "stock", label: "Stock quantity", required: true },
    { id: "cost", label: "Cost price", required: true },
    { id: "selling", label: "Selling price", required: false },
    { id: "supplier", label: "Supplier", required: false },
    { id: "min", label: "Min stock", required: false },
    { id: "desc", label: "Description", required: false },
  ],
  expenses: [
    { id: "date", label: "Date", required: true },
    { id: "category", label: "Category", required: true },
    { id: "description", label: "Description", required: true },
    { id: "amount", label: "Amount", required: true },
    { id: "currency", label: "Currency", required: false },
    { id: "vendor", label: "Vendor", required: false },
    { id: "reference", label: "Reference #", required: false },
    { id: "notes", label: "Notes", required: false },
  ],
  employees: [
    { id: "name", label: "Full name", required: true },
    { id: "email", label: "Email", required: true },
    { id: "phone", label: "Phone", required: false },
    { id: "role", label: "Role/Position", required: true },
    { id: "department", label: "Department", required: false },
    { id: "salary", label: "Salary", required: false },
    { id: "startDate", label: "Start date", required: false },
    { id: "status", label: "Status", required: false },
  ],
  transactions: [
    { id: "date", label: "Date", required: true },
    { id: "type", label: "Type", required: true },
    { id: "reference", label: "Reference", required: false },
    { id: "customer", label: "Customer", required: false },
    { id: "amount", label: "Amount", required: true },
    { id: "method", label: "Payment method", required: false },
    { id: "notes", label: "Notes", required: false },
  ],
};

// ── Main Wizard Page ────────────────────────────────────────────────────

export default function CreateTemplatePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1 state
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("inventory");
  const [description, setDescription] = useState("");

  // Step 2 state - column mappings
  const [excelColumns, setExcelColumns] = useState<string[]>([
    "SKU", "Product Name", "Category", "Qty", "Unit Price", "Supplier", "Reorder Level", "Description",
  ]);
  const [mappings, setMappings] = useState<Record<string, string>>({
    "SKU": "sku",
    "Product Name": "name",
    "Category": "category",
    "Qty": "stock",
    "Unit Price": "cost",
    "Supplier": "supplier",
    "Reorder Level": "min",
    "Description": "desc",
  });

  // Step 3 state - validation rules
  const [rules, setRules] = useState<ValidationRule[]>([
    { field: "sku", label: "SKU", type: "text", required: true, regex: "^[A-Z0-9-]+$", min: "", max: "", allowed: [], message: "SKU must match format (e.g. GLS-4MM-1224)" },
    { field: "stock", label: "Stock quantity", type: "number", required: true, regex: "", min: "0", max: "100000", allowed: [], message: "Quantity must be 0-100,000" },
    { field: "cost", label: "Cost price", type: "number", required: true, regex: "", min: "0", max: "", allowed: [], message: "Cost must be a positive number" },
  ]);

  const fields = SYSTEM_FIELDS[entityType] || SYSTEM_FIELDS.inventory;

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Template name is required");
      return;
    }

    setSaving(true);
    try {
      const columnMappings = Object.entries(mappings).map(([excelColumn, systemField]) => ({
        excelColumn,
        systemField,
        required: fields.find(f => f.id === systemField)?.required ?? false,
      }));

      const res = await fetch("/api/import-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          entityType,
          description: description.trim() || null,
          columnMappings,
          validationRules: rules,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to save template");
      }

      toast.success("Template created", { description: `"${name}" is ready to use for imports.` });
      router.push("/imports/templates");
    } catch (err) {
      toast.error("Failed to save template", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  const mappedCount = Object.values(mappings).filter(v => v).length;
  const reqUnmapped = fields.filter(f => f.required && !Object.values(mappings).includes(f.id)).length;

  return (
    <div className="space-y-4">
      {/* Breadcrumb + Title */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <span>Settings</span><span>/</span>
          <span>Excel Import</span><span>/</span>
          <span>Templates</span><span>/</span>
          <span className="text-foreground">New</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">New import template</h1>
        <p className="text-sm text-muted-foreground mt-1">Define how your spreadsheet maps to FLUX data</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 p-3.5 rounded-xl bg-muted/50 border border-border/50">
        {[
          { n: 1, label: "Basic info" },
          { n: 2, label: "Column mapping" },
          { n: 3, label: "Validation rules" },
        ].map((s, i, arr) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <React.Fragment key={s.n}>
              <div className="flex items-center gap-2.5 shrink-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono border ${
                  done ? "bg-emerald-500 border-emerald-500 text-white" :
                  active ? "bg-amber-500 border-amber-500 text-white" :
                  "bg-card border-border text-muted-foreground"
                }`}>
                  {done ? <Check className="size-3.5" strokeWidth={2.5} /> : s.n}
                </div>
                <span className={`text-[13px] ${active ? "font-semibold text-foreground" : "font-medium text-muted-foreground"}`}>
                  {s.label}
                </span>
              </div>
              {i < arr.length - 1 && (
                <div className={`flex-1 h-0.5 mx-3.5 rounded-full ${done ? "bg-emerald-500" : "bg-border"}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="rounded-xl border border-border bg-card p-6">
        {step === 1 && (
          <div className="space-y-5 max-w-2xl">
            <div className="space-y-1.5">
              <Label>Template name *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Monthly Expenses" />
              <p className="text-xs text-muted-foreground">Visible to your team when importing</p>
            </div>

            <div className="space-y-1.5">
              <Label>Entity type *</Label>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                {ENTITY_TYPES.map(e => {
                  const active = entityType === e.id;
                  const Icon = e.icon;
                  return (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => setEntityType(e.id)}
                      className={`p-3.5 rounded-xl text-left border-[1.5px] transition-colors ${
                        active
                          ? "border-amber-500 bg-amber-500/5"
                          : "border-border bg-card hover:bg-muted/50"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${
                        active ? "bg-amber-500/15 text-amber-700 dark:text-amber-300" : "bg-muted text-muted-foreground"
                      }`}>
                        <Icon className="size-4" />
                      </div>
                      <div className="font-semibold text-[13.5px]">{e.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{e.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="What is this template for? When should your team use it?" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <h3 className="text-[15px] font-semibold">Map your Excel columns to FLUX fields</h3>
              <div className="text-xs text-muted-foreground">
                <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{mappedCount} mapped</span>
                {reqUnmapped > 0 && (
                  <>
                    <span className="mx-2 text-muted-foreground/50">·</span>
                    <span className="text-amber-700 dark:text-amber-400 font-semibold">{reqUnmapped} required unmapped</span>
                  </>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">Your Excel columns may have different names. Use the dropdown to tell FLUX which field each column maps to, or choose "Ignore" to skip it.</p>

            {/* Add new Excel column */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Add an Excel column name (e.g. Item Code, Price USD...)"
                className="h-9 text-sm font-mono"
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val && !excelColumns.includes(val)) {
                      setExcelColumns([...excelColumns, val]);
                      setMappings({ ...mappings, [val]: "" });
                      (e.target as HTMLInputElement).value = "";
                    }
                  }
                }}
              />
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => {
                const input = document.querySelector<HTMLInputElement>('[placeholder*="Add an Excel column"]');
                if (input) {
                  const val = input.value.trim();
                  if (val && !excelColumns.includes(val)) {
                    setExcelColumns([...excelColumns, val]);
                    setMappings({ ...mappings, [val]: "" });
                    input.value = "";
                  }
                }
              }}>
                <Plus className="mr-1 h-3.5 w-3.5" />Add
              </Button>
            </div>

            {/* Mapping table */}
            <div className="rounded-[10px] border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_32px_1fr_40px] gap-0 bg-muted/50 px-3 py-2.5 border-b border-border">
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Your Excel column</div>
                <div />
                <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Maps to FLUX field</div>
                <div />
              </div>
              {excelColumns.map(col => {
                const mappedTo = mappings[col] || "";
                const targetField = fields.find(f => f.id === mappedTo);
                const isReqTarget = targetField?.required;
                const isMapped = mappedTo && mappedTo !== "__ignore__";
                return (
                  <div key={col} className="grid grid-cols-[1fr_32px_1fr_40px] gap-0 items-center px-3 py-2 border-b border-border/30 last:border-0 hover:bg-muted/30">
                    <div className="flex items-center gap-2">
                      <GripVertical className="size-3.5 text-muted-foreground/30 shrink-0" />
                      <span className="text-[13px] font-mono font-medium truncate">{col}</span>
                    </div>
                    <div className="flex items-center justify-center">
                      <ArrowRight className={`size-3.5 ${isMapped ? "text-emerald-500" : "text-muted-foreground/25"}`} strokeWidth={2.25} />
                    </div>
                    <div>
                      <select
                        value={mappedTo}
                        onChange={e => setMappings({ ...mappings, [col]: e.target.value })}
                        className={`w-full h-8 px-2.5 rounded-lg border text-[13px] bg-card transition-colors ${
                          isMapped
                            ? "border-emerald-500/40 text-foreground"
                            : mappedTo === "__ignore__"
                            ? "border-border text-muted-foreground/60 italic"
                            : "border-amber-500/40 text-amber-700 dark:text-amber-400"
                        }`}
                      >
                        <option value="">-- Select FLUX field --</option>
                        <option value="__ignore__">Ignore this column</option>
                        <optgroup label="FLUX Fields">
                          {fields.map(f => {
                            const alreadyUsed = Object.entries(mappings).some(([k, v]) => v === f.id && k !== col);
                            return (
                              <option key={f.id} value={f.id} disabled={alreadyUsed}>
                                {f.label}{f.required ? " *" : ""}{alreadyUsed ? " (already mapped)" : ""}
                              </option>
                            );
                          })}
                        </optgroup>
                      </select>
                    </div>
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          setExcelColumns(excelColumns.filter(c => c !== col));
                          const newMappings = { ...mappings };
                          delete newMappings[col];
                          setMappings(newMappings);
                        }}
                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-colors"
                        title="Remove column"
                      >
                        <X className="size-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
              {excelColumns.length === 0 && (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  No Excel columns defined yet. Add them above or they'll be auto-detected when you upload a file.
                </div>
              )}
            </div>

            {/* Unmapped required fields warning */}
            {reqUnmapped > 0 && (
              <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 flex gap-2.5 items-start">
                <ArrowRight className="size-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs">
                  <span className="font-semibold text-amber-700 dark:text-amber-400">
                    {reqUnmapped} required field{reqUnmapped > 1 ? "s" : ""} not mapped:
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {fields.filter(f => f.required && !Object.values(mappings).includes(f.id)).map(f => f.label).join(", ")}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {step === 3 && (
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-[15px] font-semibold">Validation rules</h3>
              <p className="text-xs text-muted-foreground">Set per-field rules. We'll catch errors before they're imported.</p>
            </div>
            <div className="space-y-2.5">
              {rules.map((rule, idx) => (
                <div key={rule.field} className="p-3.5 rounded-[10px] border border-border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <span className="font-semibold text-sm">{rule.label}</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                        rule.type === "text" ? "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300" :
                        rule.type === "number" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" :
                        rule.type === "enum" ? "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300" :
                        "bg-muted text-muted-foreground"
                      }`}>{rule.type}</span>
                    </div>
                    <label className="flex items-center gap-2 text-xs font-medium">
                      <input
                        type="checkbox"
                        checked={rule.required}
                        onChange={e => {
                          const updated = [...rules];
                          updated[idx] = { ...rule, required: e.target.checked };
                          setRules(updated);
                        }}
                        className="rounded"
                      />
                      Required
                    </label>
                  </div>
                  <div className="grid grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground">Type</label>
                      <select
                        value={rule.type}
                        onChange={e => {
                          const updated = [...rules];
                          updated[idx] = { ...rule, type: e.target.value as ValidationRule["type"] };
                          setRules(updated);
                        }}
                        className="w-full h-9 px-2.5 rounded-[10px] border border-border bg-card text-sm mt-1"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="enum">Allowed values</option>
                      </select>
                    </div>
                    {rule.type === "number" && (
                      <>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground">Min</label>
                          <Input value={rule.min} onChange={e => { const u = [...rules]; u[idx] = { ...rule, min: e.target.value }; setRules(u); }} className="mt-1 h-9" />
                        </div>
                        <div>
                          <label className="text-[11px] font-medium text-muted-foreground">Max</label>
                          <Input value={rule.max} onChange={e => { const u = [...rules]; u[idx] = { ...rule, max: e.target.value }; setRules(u); }} placeholder="No limit" className="mt-1 h-9" />
                        </div>
                      </>
                    )}
                    {rule.type === "text" && (
                      <div className="col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground">Pattern (regex)</label>
                        <Input value={rule.regex} onChange={e => { const u = [...rules]; u[idx] = { ...rule, regex: e.target.value }; setRules(u); }} placeholder="^[A-Z0-9-]+$" className="mt-1 h-9 font-mono" />
                      </div>
                    )}
                    {rule.type === "enum" && (
                      <div className="col-span-2">
                        <label className="text-[11px] font-medium text-muted-foreground">Allowed values</label>
                        <div className="flex gap-1.5 flex-wrap p-1.5 mt-1 min-h-9 rounded-lg border border-border bg-muted/50">
                          {rule.allowed.map(a => (
                            <span key={a} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-card border border-border text-muted-foreground">
                              {a}
                              <button type="button" onClick={() => { const u = [...rules]; u[idx] = { ...rule, allowed: rule.allowed.filter(v => v !== a) }; setRules(u); }}>
                                <X className="size-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div className={rule.type === "number" ? "" : "col-span-1"}>
                      <label className="text-[11px] font-medium text-muted-foreground">Error message</label>
                      <Input value={rule.message} onChange={e => { const u = [...rules]; u[idx] = { ...rule, message: e.target.value }; setRules(u); }} placeholder="(use default)" className="mt-1 h-9" />
                    </div>
                  </div>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setRules([...rules, { field: `field_${rules.length}`, label: "New field", type: "text", required: false, regex: "", min: "", max: "", allowed: [], message: "" }])}>
                <Plus className="mr-2 h-3.5 w-3.5" />Add field rule
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Live Preview Row */}
      <div className="rounded-xl bg-muted/50 border border-border/50 p-3.5">
        <div className="text-[11.5px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">Live preview · sample row</div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>SKU</TableHead>
                <TableHead>Product Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit price</TableHead>
                <TableHead>Supplier</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow className="text-xs">
                <TableCell className="font-mono">GLS-4MM-1224</TableCell>
                <TableCell>Float glass 4mm clear (1.83x2.44m)</TableCell>
                <TableCell>Glass</TableCell>
                <TableCell className="text-right font-mono">180</TableCell>
                <TableCell className="text-right font-mono">145,000</TableCell>
                <TableCell>Guangzhou Glass Trading</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Footer Nav */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/imports/templates")}>Cancel</Button>
        <div className="flex gap-2">
          {step > 1 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)}>
              <ChevronLeft className="mr-1 h-3.5 w-3.5" />Back
            </Button>
          )}
          {step < 3 ? (
            <Button className="btn-accent" size="sm" onClick={() => {
              if (step === 1 && !name.trim()) {
                toast.error("Enter a template name before continuing");
                return;
              }
              setStep(step + 1);
            }}>
              Next<ChevronRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button className="btn-accent" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
              Save template
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
