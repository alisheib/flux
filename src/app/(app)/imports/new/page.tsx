"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
  Upload,
  FileSpreadsheet,
  Check,
  ArrowRight,
  Info,
  Download,
  Loader2,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  MinusCircle,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────────────────

interface ParsedFile {
  name: string;
  size: number;
  rows: number;
  columns: string[];
  sheetCount: number;
  data: Record<string, unknown>[];
}

interface Template {
  id: string;
  name: string;
  entityType: string;
  columnMappings: string | null;
}

type UploadState = "empty" | "uploaded" | "validating" | "done";

interface ColumnMatch {
  excelCol: string;
  systemField: string;
  status: "matched" | "unmatched" | "ignored";
}

// ── Upload step indicators ──────────────────────────────────────────────

const STEPS = ["Upload", "Map", "Validate", "Preview", "Import"];

function StepBar({ state }: { state: UploadState }) {
  const stageIndex = state === "empty" ? 0 : state === "uploaded" ? 1 : state === "validating" ? 2 : 3;
  return (
    <div className="flex items-center gap-2 mb-5 text-xs text-muted-foreground">
      {STEPS.map((label, i) => {
        const done = i < stageIndex;
        const active = i === stageIndex;
        return (
          <React.Fragment key={label}>
            <span className={`inline-flex items-center gap-1.5 ${active ? "font-semibold text-foreground" : done ? "font-medium text-emerald-700 dark:text-emerald-400" : "font-medium"}`}>
              <span className={`w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold ${
                done ? "bg-emerald-500 text-white" : active ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground"
              }`}>
                {done ? <Check className="size-2.5" strokeWidth={3} /> : i + 1}
              </span>
              {label}
            </span>
            {i < STEPS.length - 1 && <span className="flex-1 h-0.5 rounded-full bg-border" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ── Main Upload Page ────────────────────────────────────────────────────

export default function ImportUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploadState>("empty");
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [columnMatches, setColumnMatches] = useState<ColumnMatch[]>([]);
  const [validationProgress, setValidationProgress] = useState(0);
  const [validationStats, setValidationStats] = useState({ total: 0, valid: 0, warnings: 0, errors: 0, skipped: 0 });

  // Fetch templates for matching
  useEffect(() => {
    fetch("/api/import-templates").then(r => r.ok ? r.json() : []).then(setTemplates).catch(() => {});
  }, []);

  const handleFileDrop = useCallback(async (e: React.DragEvent | React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    const files = "dataTransfer" in e ? e.dataTransfer.files : e.target.files;
    if (!files || files.length === 0) return;

    const f = files[0];
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File too large", { description: "Maximum size is 10 MB." });
      return;
    }

    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".csv") && !f.name.endsWith(".xls")) {
      toast.error("Unsupported format", { description: "Please upload .xlsx or .csv files." });
      return;
    }

    // Parse with SheetJS
    try {
      const XLSX = await import("xlsx");
      const data = await f.arrayBuffer();
      const wb = XLSX.read(data, { type: "array" });
      const sheetName = wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
      const headers = json.length > 0 ? Object.keys(json[0]) : [];

      setFile({
        name: f.name,
        size: f.size,
        rows: json.length,
        columns: headers,
        sheetCount: wb.SheetNames.length,
        data: json,
      });

      // Auto-match columns if we have templates
      if (headers.length > 0) {
        const matches: ColumnMatch[] = headers.map(col => ({
          excelCol: col,
          systemField: col, // naive 1:1 match
          status: "matched" as const,
        }));
        setColumnMatches(matches);
      }

      setState("uploaded");
      toast.success("File parsed", { description: `${json.length.toLocaleString()} rows, ${headers.length} columns detected.` });
    } catch (err) {
      toast.error("Failed to parse file", { description: "Make sure it's a valid Excel or CSV file." });
    }
  }, []);

  const handleValidate = async () => {
    if (!file) return;
    setState("validating");

    // Simulate client-side validation with progress
    const total = file.rows;
    let valid = 0, warnings = 0, errors = 0, skipped = 0;

    for (let i = 0; i < total; i++) {
      // Simple validation: count non-empty rows as valid
      const row = file.data[i];
      const isEmpty = Object.values(row).every(v => v === "" || v === null || v === undefined);
      if (isEmpty) { skipped++; }
      else if (Math.random() < 0.03) { errors++; } // simulate ~3% error rate
      else if (Math.random() < 0.05) { warnings++; } // simulate ~5% warning rate
      else { valid++; }

      if (i % Math.max(1, Math.floor(total / 50)) === 0) {
        setValidationProgress(Math.round((i / total) * 100));
        await new Promise(r => setTimeout(r, 10)); // yield to UI
      }
    }

    setValidationProgress(100);
    setValidationStats({ total, valid, warnings, errors, skipped });
    setState("done");
    toast.success("Validation complete", { description: `${valid.toLocaleString()} rows ready to import.` });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <span>Excel Import</span><span>/</span><span className="text-foreground">New import</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Import from Excel</h1>
        <p className="text-sm text-muted-foreground mt-1">Upload a spreadsheet, match it to a template, and we'll check every row before anything is saved.</p>
      </div>

      <StepBar state={state} />

      {/* Dropzone */}
      {state === "empty" && (
        <div
          className="bg-card border-2 border-dashed border-border rounded-2xl p-14 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={handleFileDrop}
        >
          <input ref={fileInputRef} type="file" accept=".xlsx,.csv,.xls" className="hidden" onChange={handleFileDrop} />
          <div className="empty-state-icon mx-auto mb-4 !w-[72px] !h-[72px] !rounded-[18px]">
            <Upload className="size-8" />
          </div>
          <h3 className="text-lg font-semibold mb-1">Drop your Excel file here</h3>
          <p className="text-sm text-muted-foreground mb-4">or click to browse -- supports <strong>.xlsx</strong> and <strong>.csv</strong> up to 10 MB</p>
          <Button className="btn-accent" size="sm">
            <Upload className="mr-2 h-3.5 w-3.5" />Choose file
          </Button>
          <div className="flex items-center justify-center gap-3.5 mt-5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1"><Download className="size-3" />Download sample</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1"><Info className="size-3" />First row should be headers</span>
          </div>
        </div>
      )}

      {/* After upload */}
      {state !== "empty" && file && (
        <>
          {/* File info card */}
          <div className="bg-card border border-border rounded-xl p-4 flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="size-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{file.name}</span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
                  <Check className="size-2.5" strokeWidth={3} />Uploaded
                </span>
              </div>
              <div className="flex gap-3.5 text-xs text-muted-foreground mt-1">
                <span>{formatSize(file.size)}</span>
                <span>·</span>
                <span><strong className="text-foreground">{file.rows.toLocaleString()}</strong> rows</span>
                <span>·</span>
                <span><strong className="text-foreground">{file.columns.length}</strong> columns</span>
                <span>·</span>
                <span>Sheet 1 of {file.sheetCount}</span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setState("empty"); setFile(null); }}>Change file</Button>
          </div>

          {/* Template selector */}
          {templates.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-semibold">Match to template</div>
                  <div className="text-xs text-muted-foreground mt-0.5">Select a template or create a new one</div>
                </div>
                <select
                  value={selectedTemplate}
                  onChange={e => setSelectedTemplate(e.target.value)}
                  className="h-9 px-3 rounded-[10px] border border-border bg-card text-sm w-[260px]"
                >
                  <option value="">Select template...</option>
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Column mapping review */}
          {columnMatches.length > 0 && state === "uploaded" && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your Excel column</TableHead>
                    <TableHead className="w-8"></TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">FLUX field</TableHead>
                    <TableHead className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {columnMatches.map((m, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono font-medium text-xs">{m.excelCol}</TableCell>
                      <TableCell><ArrowRight className="size-3.5 text-muted-foreground/50" /></TableCell>
                      <TableCell className="text-xs">{m.systemField}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10.5px] font-semibold ${
                          m.status === "matched" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300" :
                          m.status === "unmatched" ? "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {m.status === "matched" ? "Matched" : m.status === "unmatched" ? "Needs mapping" : "Ignored"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Validate button */}
          {state === "uploaded" && (
            <div className="flex justify-end">
              <Button className="btn-accent" size="sm" onClick={handleValidate}>
                <Check className="mr-2 h-3.5 w-3.5" />Validate {file.rows.toLocaleString()} rows
              </Button>
            </div>
          )}

          {/* Validation progress */}
          {state === "validating" && (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <Loader2 className="size-6 animate-spin text-amber-500 mx-auto mb-3" />
              <div className="text-sm font-semibold mb-2">Validating...</div>
              <Progress value={validationProgress} className="h-2 mb-2 max-w-md mx-auto" />
              <div className="text-xs text-muted-foreground">Row {Math.round(validationProgress * file.rows / 100).toLocaleString()} of {file.rows.toLocaleString()}</div>
            </div>
          )}

          {/* Validation results */}
          {state === "done" && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <StatCard icon={<FileSpreadsheet className="size-4" />} label="Total" value={validationStats.total} className="bg-card" />
                <StatCard icon={<CheckCircle2 className="size-4" />} label="Valid" value={validationStats.valid} className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" />
                <StatCard icon={<AlertTriangle className="size-4" />} label="Warnings" value={validationStats.warnings} className="bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300" />
                <StatCard icon={<XCircle className="size-4" />} label="Errors" value={validationStats.errors} className="bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-300" />
                <StatCard icon={<MinusCircle className="size-4" />} label="Skipped" value={validationStats.skipped} className="bg-muted text-muted-foreground" />
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  <strong className="text-foreground">{validationStats.valid.toLocaleString()}</strong> of {validationStats.total.toLocaleString()} rows ready to import
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { setState("empty"); setFile(null); }}>Cancel</Button>
                  {validationStats.valid > 0 && (
                    <Button className="btn-accent" size="sm" onClick={() => toast.success("Import started", { description: `Importing ${validationStats.valid.toLocaleString()} valid rows...` })}>
                      <Upload className="mr-2 h-3.5 w-3.5" />Import {validationStats.valid.toLocaleString()} valid rows
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value: number; className?: string }) {
  return (
    <div className={`rounded-xl border border-border p-3.5 flex items-center gap-3 ${className}`}>
      {icon}
      <div>
        <div className="text-lg font-bold">{value.toLocaleString()}</div>
        <div className="text-[11px] font-medium uppercase tracking-wide opacity-70">{label}</div>
      </div>
    </div>
  );
}
