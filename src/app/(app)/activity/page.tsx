"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { PageHeader } from "@/components/page-header";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/ui/form-select";
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
  Activity,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Download,
  RefreshCw,
  ClipboardList,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────────

interface AuditLogEntry {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
}

interface AuditLogsResponse {
  data: AuditLogEntry[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ── Action badge config ──────────────────────────────────────────────────────

const actionConfig: Record<
  string,
  { label: string; badgeBg: string; badgeText: string; icon: React.ElementType }
> = {
  create: {
    label: "Create",
    badgeBg: "bg-emerald-500/12",
    badgeText: "text-emerald-600 dark:text-emerald-400",
    icon: Plus,
  },
  update: {
    label: "Update",
    badgeBg: "bg-blue-500/12",
    badgeText: "text-blue-600 dark:text-blue-400",
    icon: Pencil,
  },
  delete: {
    label: "Delete",
    badgeBg: "bg-red-500/12",
    badgeText: "text-red-600 dark:text-red-400",
    icon: Trash2,
  },
  export: {
    label: "Export",
    badgeBg: "bg-purple-500/12",
    badgeText: "text-purple-600 dark:text-purple-400",
    icon: Download,
  },
  status_change: {
    label: "Status Change",
    badgeBg: "bg-amber-500/12",
    badgeText: "text-amber-600 dark:text-amber-400",
    icon: RefreshCw,
  },
};

function ActionBadge({ action }: { action: string }) {
  const config = actionConfig[action] || {
    label: action,
    badgeBg: "bg-gray-500/12",
    badgeText: "text-gray-600 dark:text-gray-400",
    icon: Activity,
  };
  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${config.badgeBg} ${config.badgeText}`}
    >
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

// ── Entity options ───────────────────────────────────────────────────────────

const entityOptions = [
  { value: "", label: "All Entities" },
  { value: "product", label: "Product" },
  { value: "sale", label: "Sale" },
  { value: "invoice", label: "Invoice" },
  { value: "shipment", label: "Shipment" },
  { value: "user", label: "User" },
  { value: "category", label: "Category" },
  { value: "credit_note", label: "Credit Note" },
  { value: "settings", label: "Settings" },
];

const actionOptions = [
  { value: "", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "export", label: "Export" },
  { value: "status_change", label: "Status Change" },
];

// ── Main Page ────────────────────────────────────────────────────────────────

export default function ActivityLogPage() {
  const { user } = useAuth();

  const [data, setData] = useState<AuditLogsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 30;

  // ── Data Fetching ──────────────────────────────────────────────────────

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(limit));
      if (entityFilter) params.set("entity", entityFilter);
      if (actionFilter) params.set("action", actionFilter);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);

      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to fetch audit logs");
      }
      const json = await res.json();
      setData(json);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load activity log";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [page, entityFilter, actionFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [entityFilter, actionFilter, dateFrom, dateTo]);

  // ── Helpers ────────────────────────────────────────────────────────────

  function formatDateTime(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatEntity(entity: string) {
    return entity
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  // ── Loading ────────────────────────────────────────────────────────────

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const logs = data?.data || [];
  const totalPages = data?.pagination?.totalPages || 1;
  const total = data?.pagination?.total || 0;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        description="Audit trail of all actions across your organization"
      />

      {/* Filter Bar */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
          {/* Date range */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground shrink-0">
                From
              </label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-8 w-auto text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground shrink-0">
                To
              </label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-8 w-auto text-xs"
              />
            </div>
          </div>

          {/* Entity filter */}
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-muted-foreground shrink-0" />
            <div className="w-44">
              <FormSelect
                value={entityFilter}
                onChange={setEntityFilter}
                options={entityOptions}
                placeholder="All Entities"
              />
            </div>
          </div>

          {/* Action filter */}
          <div className="w-44">
            <FormSelect
              value={actionFilter}
              onChange={setActionFilter}
              options={actionOptions}
              placeholder="All Actions"
            />
          </div>

          {/* Clear */}
          {(dateFrom || dateTo || entityFilter || actionFilter) && (
            <button
              onClick={() => {
                setDateFrom("");
                setDateTo("");
                setEntityFilter("");
                setActionFilter("");
              }}
              className="text-xs font-medium text-[#d97706] hover:underline"
            >
              Clear filters
            </button>
          )}

          {/* Count */}
          <span className="text-xs text-muted-foreground ml-auto">
            {total} {total === 1 ? "entry" : "entries"}
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
                    Date / Time
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    User
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Action
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Entity
                  </TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <ClipboardList className="size-10 opacity-30" />
                        <p className="text-sm font-medium">
                          No activity found
                        </p>
                        <p className="text-xs">
                          {entityFilter || actionFilter || dateFrom || dateTo
                            ? "Try adjusting your filters"
                            : "Activity will appear here as actions are performed"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log) => (
                    <TableRow
                      key={log.id}
                      className="hover:bg-muted/40 transition-colors"
                    >
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDateTime(log.createdAt)}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground">
                        {log.userName}
                      </TableCell>
                      <TableCell>
                        <ActionBadge action={log.action} />
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                          {formatEntity(log.entity)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {log.details || "-"}
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
    </div>
  );
}
