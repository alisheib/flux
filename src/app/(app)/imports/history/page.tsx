"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  FileSpreadsheet,
  Clock,
  CheckCircle2,
  Timer,
  Upload,
  Loader2,
  ChevronLeft,
  AlertTriangle,
  XCircle,
  BarChart3,
} from "lucide-react";

interface ImportJob {
  id: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  template: { id: string; name: string; entityType: string } | null;
}

interface Stats {
  totalImports: number;
  totalRowsImported: number;
  successRate: number;
  avgDuration: number;
}

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  completed:  { bg: "bg-emerald-50 dark:bg-emerald-500/15", text: "text-emerald-700 dark:text-emerald-300", label: "Completed" },
  partial:    { bg: "bg-amber-50 dark:bg-amber-500/15", text: "text-amber-700 dark:text-amber-300", label: "Partial" },
  failed:     { bg: "bg-red-50 dark:bg-red-500/15", text: "text-red-700 dark:text-red-300", label: "Failed" },
  validating: { bg: "bg-blue-50 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", label: "Validating" },
  importing:  { bg: "bg-blue-50 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", label: "Importing" },
  pending:    { bg: "bg-muted", text: "text-muted-foreground", label: "Pending" },
  validated:  { bg: "bg-blue-50 dark:bg-blue-500/15", text: "text-blue-700 dark:text-blue-300", label: "Validated" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_STYLES[status] || STATUS_STYLES.pending;
  const isActive = status === "validating" || status === "importing";
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11.5px] font-semibold ${s.bg} ${s.text}`}>
      {isActive && <Loader2 className="size-3 animate-spin" />}
      {!isActive && <span className="w-1.5 h-1.5 rounded-full bg-current" />}
      {s.label}
    </span>
  );
}

export default function ImportHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [stats, setStats] = useState<Stats>({ totalImports: 0, totalRowsImported: 0, successRate: 0, avgDuration: 0 });

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/import-jobs");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
        setStats(data.stats);
      }
    } catch {
      toast.error("Failed to load import history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <span>Excel Import</span><span>/</span><span className="text-foreground">History</span>
        </div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Import History</h1>
            <p className="text-sm text-muted-foreground mt-1">Track all past imports and their outcomes</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/imports/templates"><ChevronLeft className="mr-1 h-3.5 w-3.5" />Templates</Link>
            </Button>
            <Button className="btn-accent" size="sm" asChild>
              <Link href="/imports/new"><Upload className="mr-2 h-3.5 w-3.5" />New import</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon={<BarChart3 className="size-[18px]" />} iconClass="kpi-icon-amber" label="Total imports" value={String(stats.totalImports)} />
        <KpiCard icon={<FileSpreadsheet className="size-[18px]" />} iconClass="kpi-icon-blue" label="Rows imported" value={stats.totalRowsImported.toLocaleString()} />
        <KpiCard icon={<CheckCircle2 className="size-[18px]" />} iconClass="kpi-icon-green" label="Success rate" value={`${stats.successRate}%`} />
        <KpiCard icon={<Timer className="size-[18px]" />} iconClass="kpi-icon-purple" label="Avg duration" value={stats.avgDuration > 0 ? `${stats.avgDuration}s` : "--"} />
      </div>

      {/* History Table */}
      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {jobs.length === 0 ? (
          <div className="py-16 text-center">
            <div className="empty-state-icon mx-auto mb-4"><Clock className="size-7" /></div>
            <h3 className="text-base font-semibold mb-1">No imports yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-5">
              Once you run your first import, it will appear here with full details and logs.
            </p>
            <Button className="btn-accent" size="sm" asChild>
              <Link href="/imports/new"><Upload className="mr-2 h-3.5 w-3.5" />Start your first import</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Date</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Template</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">File</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Total</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Imported</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground text-right">Failed</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {jobs.map(job => (
                  <TableRow key={job.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(job.createdAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                    </TableCell>
                    <TableCell className="font-medium">{job.template?.name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[200px]">{job.fileName}</TableCell>
                    <TableCell className="text-right font-mono">{job.totalRows.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-emerald-700 dark:text-emerald-400">{job.validRows.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono text-red-600 dark:text-red-400">{job.errorRows.toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={job.status} /></TableCell>
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

function KpiCard({ icon, iconClass, label, value }: { icon: React.ReactNode; iconClass: string; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-2.5">
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center ${iconClass}`}>{icon}</div>
      <div>
        <div className="text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground mb-1">{label}</div>
        <div className="text-xl font-bold tracking-tight">{value}</div>
      </div>
    </div>
  );
}
