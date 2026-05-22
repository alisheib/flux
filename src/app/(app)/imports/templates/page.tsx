"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/calculations";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  Plus,
  Download,
  Search,
  FileSpreadsheet,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Upload,
  RefreshCw,
  Clock,
  CheckCircle2,
  Loader2,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface ImportTemplate {
  id: string;
  name: string;
  entityType: string;
  description: string | null;
  columnMappings: string | null;
  usageCount: number;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ── Entity badge styles ─────────────────────────────────────────────────

const ENTITY_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  inventory:    { bg: "bg-blue-50 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", label: "Inventory" },
  expenses:     { bg: "bg-amber-50 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", label: "Expenses" },
  employees:    { bg: "bg-violet-50 dark:bg-violet-500/15", text: "text-violet-700 dark:text-violet-300", label: "Employees" },
  transactions: { bg: "bg-emerald-50 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", label: "Transactions" },
};

function EntityBadge({ type }: { type: string }) {
  const s = ENTITY_STYLES[type] || { bg: "bg-muted", text: "text-muted-foreground", label: type };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${s.bg} ${s.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

// ── Column count from mappings ──────────────────────────────────────────

function getColumnCount(mappings: string | null): number {
  if (!mappings) return 0;
  try { return JSON.parse(mappings).length; } catch { return 0; }
}

// ── Time ago helper ─────────────────────────────────────────────────────

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function ImportTemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [templates, setTemplates] = useState<ImportTemplate[]>([]);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/import-templates");
      if (res.ok) {
        setTemplates(await res.json());
      }
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const filtered = templates.filter(t => {
    if (filter !== "all" && t.entityType !== filter) return false;
    if (search && !t.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/import-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setTemplates(prev => prev.filter(t => t.id !== id));
      toast.success("Template deleted");
    } catch {
      toast.error("Failed to delete template");
    }
  };

  const handleDuplicate = async (template: ImportTemplate) => {
    try {
      const res = await fetch("/api/import-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `${template.name} (copy)`,
          entityType: template.entityType,
          description: template.description,
          columnMappings: template.columnMappings ? JSON.parse(template.columnMappings) : null,
        }),
      });
      if (!res.ok) throw new Error();
      const newTemplate = await res.json();
      setTemplates(prev => [newTemplate, ...prev]);
      toast.success("Template duplicated");
    } catch {
      toast.error("Failed to duplicate template");
    }
  };

  // KPI values
  const totalTemplates = templates.length;
  const mostUsed = templates.length > 0
    ? templates.reduce((max, t) => t.usageCount > max.usageCount ? t : max, templates[0])
    : null;
  const lastUsed = templates
    .filter(t => t.lastUsedAt)
    .sort((a, b) => new Date(b.lastUsedAt!).getTime() - new Date(a.lastUsedAt!).getTime())[0] || null;
  const entityTypes = new Set(templates.map(t => t.entityType));

  // Filter chips
  const FILTERS = [
    { id: "all", label: "All" },
    { id: "inventory", label: "Inventory" },
    { id: "expenses", label: "Expenses" },
    { id: "employees", label: "Employees" },
    { id: "transactions", label: "Transactions" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <span>Settings</span>
          <span>/</span>
          <span>Excel Import</span>
          <span>/</span>
          <span className="text-foreground">Templates</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Import Templates</h1>
            <p className="text-sm text-muted-foreground mt-1">Reusable mappings to turn spreadsheets into clean data</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/imports/history">
                <Clock className="mr-2 h-3.5 w-3.5" />Import history
              </Link>
            </Button>
            <Button className="btn-accent" size="sm" asChild>
              <Link href="/imports/templates/new">
                <Plus className="mr-2 h-3.5 w-3.5" />Create template
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<FileSpreadsheet className="size-[18px]" />} iconClass="kpi-icon-amber" label="Total templates" value={String(totalTemplates)} sub={`across ${entityTypes.size} entity type${entityTypes.size !== 1 ? "s" : ""}`} />
        <KpiCard icon={<RefreshCw className="size-[18px]" />} iconClass="kpi-icon-blue" label="Most used" value={mostUsed ? mostUsed.name : "--"} sub={mostUsed ? `${mostUsed.usageCount} imports` : "No imports yet"} />
        <KpiCard icon={<Clock className="size-[18px]" />} iconClass="kpi-icon-amber" label="Last import" value={lastUsed ? timeAgo(lastUsed.lastUsedAt) : "--"} sub={lastUsed ? lastUsed.name : "Never"} />
        <KpiCard icon={<CheckCircle2 className="size-[18px]" />} iconClass="kpi-icon-green" label="Success rate" value="--" sub="Last 30 days" />
      </div>

      {/* Templates Table Card */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {/* Filter + Search Bar */}
        <div className="px-3.5 py-3 border-b border-border/50 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {FILTERS.map(f => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`chip ${filter === f.id ? "active" : ""}`}
              >
                {f.label}
                {f.id === "all" && <span className="text-[11px] opacity-60 font-mono ml-1">{templates.length}</span>}
              </button>
            ))}
          </div>
          <div className="relative w-[220px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search templates..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-[13px]"
            />
          </div>
        </div>

        {/* Table or Empty */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="empty-state-icon mx-auto mb-4">
              <Upload className="size-7" />
            </div>
            <h3 className="text-base font-semibold mb-1">
              {search || filter !== "all" ? "No templates match" : "No import templates yet"}
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
              {search || filter !== "all"
                ? "Try adjusting your search or filter."
                : "Create your first template to start importing data from Excel -- we'll guide you through the mapping."}
            </p>
            {!search && filter === "all" && (
              <Button className="btn-accent" size="sm" asChild>
                <Link href="/imports/templates/new">
                  <Plus className="mr-2 h-3.5 w-3.5" />Create your first template
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Template name</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Entity</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Columns</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last used</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Times used</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(t => (
                  <TableRow key={t.id} className="cursor-pointer" onClick={() => router.push(`/imports/templates/${t.id}`)}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                          <FileSpreadsheet className="size-3.5" />
                        </div>
                        <span className="font-semibold text-foreground">{t.name}</span>
                      </div>
                    </TableCell>
                    <TableCell><EntityBadge type={t.entityType} /></TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">{getColumnCount(t.columnMappings)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{timeAgo(t.lastUsedAt)}</TableCell>
                    <TableCell className="text-right font-semibold">{t.usageCount}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                            <MoreHorizontal className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); router.push(`/imports/templates/${t.id}`); }}>
                            <Pencil className="mr-2 h-3.5 w-3.5" />Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); handleDuplicate(t); }}>
                            <Copy className="mr-2 h-3.5 w-3.5" />Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); handleDelete(t.id, t.name); }}>
                            <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI Card ────────────────────────────────────────────────────────────

function KpiCard({ icon, iconClass, label, value, sub }: {
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${iconClass}`}>
        {icon}
      </div>
      <div>
        <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
        <div className="text-xl font-bold tracking-tight truncate">{value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>
      </div>
    </div>
  );
}
