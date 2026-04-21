"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Settings,
  Save,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  FileText,
  AlertTriangle,
  Wifi,
  WifiOff,
  Lock,
  ArrowUpRight,
  BadgeCheck,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth-provider";
import { formatCurrency } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── TRA Logo SVG ────────────────────────────────────────────────────────

function TRALogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Shield shape */}
      <path
        d="M32 4L8 16v16c0 14.4 10.24 27.84 24 32 13.76-4.16 24-17.6 24-32V16L32 4z"
        fill="#1e3a5f"
      />
      <path
        d="M32 8L12 18v14c0 12.8 8.96 24.48 20 28 11.04-3.52 20-15.2 20-28V18L32 8z"
        fill="#2563eb"
      />
      {/* Inner circle */}
      <circle cx="32" cy="32" r="14" fill="#1e3a5f" />
      <circle cx="32" cy="32" r="12" fill="white" fillOpacity="0.15" />
      {/* TRA text */}
      <text x="32" y="30" textAnchor="middle" fill="white" fontSize="10" fontFamily="Helvetica,Arial" fontWeight="bold">TRA</text>
      {/* EFD text */}
      <text x="32" y="40" textAnchor="middle" fill="#93c5fd" fontSize="7" fontFamily="Helvetica,Arial" fontWeight="600">EFD</text>
      {/* Star accent */}
      <path d="M32 6l1.5 3 3-.5-2 2.5 1 3-3-1.5-3 1.5 1-3-2-2.5 3 .5z" fill="#fbbf24" />
      {/* Tanzania flag stripes */}
      <rect x="8" y="56" width="48" height="2" rx="1" fill="#4ade80" />
      <rect x="14" y="59" width="36" height="1.5" rx="0.75" fill="#facc15" />
      <rect x="20" y="61.5" width="24" height="1" rx="0.5" fill="#3b82f6" />
    </svg>
  );
}

// ── Types ────────────────────────────────────────────────────────────────

interface TallyConfig {
  enabled: boolean;
  tin: string;
  vrn: string;
  serial: string;
  certPath: string;
  apiUrl: string;
  lastSync: string | null;
}

interface TallyStats {
  totalInvoices: number;
  paidInvoices: number;
  pendingSync: number;
  synced: number;
  failed: number;
}

interface ReceiptRecord {
  id: string;
  saleNumber: string;
  customer: string;
  total: number;
  paymentMethod: string;
  invoiceNumber: string | null;
  createdAt: string;
  salesperson: string;
  itemCount: number;
  traStatus: "pending" | "synced" | "failed";
  traReceiptNo: string | null;
}

// ── Main Page ───────────────────────────────────────────────────────────

export default function TallyPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<TallyConfig>({
    enabled: false, tin: "", vrn: "", serial: "", certPath: "",
    apiUrl: "https://vfd.tra.go.tz/api", lastSync: null,
  });
  const [stats, setStats] = useState<TallyStats>({
    totalInvoices: 0, paidInvoices: 0, pendingSync: 0, synced: 0, failed: 0,
  });
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showTestResult, setShowTestResult] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean; message: string; details?: Record<string, string>;
  } | null>(null);

  const isAdmin = user.role === "admin";

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tally");
      if (!res.ok) throw new Error("Failed to load");
      const data = await res.json();
      setConfig(data.config);
      setStats(data.stats);
      setReceipts(data.recentReceipts);
    } catch {
      toast.error("Failed to load TRA data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/tally", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast.success("TRA configuration saved");
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/tally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "test" }),
      });
      const data = await res.json();
      setTestResult({ success: res.ok, message: data.message || data.error, details: data.details });
      setShowTestResult(true);
    } catch {
      setTestResult({ success: false, message: "Connection failed" });
      setShowTestResult(true);
    } finally { setTesting(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/tally", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message);
      fetchData();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Sync failed");
    } finally { setSyncing(false); }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="TRA Fiscal Compliance" description="Tanzania Revenue Authority — Electronic Fiscal Device" />
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="TRA Fiscal Compliance" description="Tanzania Revenue Authority — Electronic Fiscal Device (EFD)">
        {isAdmin && config.enabled && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleTestConnection} disabled={testing}>
              {testing ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Wifi className="size-4 mr-1.5" />}
              Test Connection
            </Button>
            <Button size="sm" onClick={handleSync} disabled={syncing}
              className="bg-[#1e3a5f] text-white hover:bg-[#162d4a]">
              {syncing ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <RefreshCw className="size-4 mr-1.5" />}
              Sync to TRA
            </Button>
          </div>
        )}
      </PageHeader>

      {/* ── Government Banner ──────────────────────────────────────── */}
      <div className="rounded-xl overflow-hidden border border-[#1e3a5f]/20">
        {/* Blue gradient header */}
        <div className="bg-gradient-to-r from-[#1e3a5f] via-[#1e4d8f] to-[#1e3a5f] px-6 py-5">
          <div className="flex items-center gap-4">
            <TRALogo size={52} />
            <div>
              <h2 className="text-lg font-bold text-white tracking-tight">
                Tanzania Revenue Authority
              </h2>
              <p className="text-sm text-blue-200">
                Electronic Fiscal Device (EFD) — Virtual Fiscal Device (VFD) Integration
              </p>
            </div>
            <div className="ml-auto hidden sm:flex items-center gap-2">
              {config.enabled ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 border border-amber-400/30 px-3 py-1 text-xs font-semibold text-amber-300">
                  <span className="size-2 rounded-full bg-amber-400" />
                  Not Configured
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info bar */}
        <div className="bg-[#f0f4f8] dark:bg-[#0f1a2e] px-6 py-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          {config.tin && (
            <span className="text-muted-foreground">
              <strong className="text-foreground">TIN:</strong> {config.tin}
            </span>
          )}
          {config.vrn && (
            <span className="text-muted-foreground">
              <strong className="text-foreground">VRN:</strong> {config.vrn}
            </span>
          )}
          {config.serial && (
            <span className="text-muted-foreground">
              <strong className="text-foreground">EFD Serial:</strong> {config.serial}
            </span>
          )}
          {config.lastSync && (
            <span className="text-muted-foreground">
              <strong className="text-foreground">Last Sync:</strong>{" "}
              {new Date(config.lastSync).toLocaleString()}
            </span>
          )}
        </div>
      </div>

      {/* ── KPI Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <GovStatCard icon={FileText} label="Total Receipts" value={stats.totalInvoices} />
        <GovStatCard icon={Clock} label="Pending Sync" value={stats.pendingSync} variant="warning" />
        <GovStatCard icon={CheckCircle} label="Synced to TRA" value={stats.synced} variant="success" />
        <GovStatCard icon={XCircle} label="Failed" value={stats.failed} variant="danger" />
        <GovStatCard icon={BadgeCheck} label="Paid & Closed" value={stats.paidInvoices} variant="success" />
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────── */}
      <Tabs defaultValue="receipts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="receipts">
            <FileText className="size-4 mr-1.5" />
            Fiscal Receipts
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="config">
              <Settings className="size-4 mr-1.5" />
              Configuration
            </TabsTrigger>
          )}
          <TabsTrigger value="compliance">
            <Shield className="size-4 mr-1.5" />
            Compliance Info
          </TabsTrigger>
        </TabsList>

        {/* ── Receipts Tab ─────────────────────────────────────────── */}
        <TabsContent value="receipts">
          <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-[#1e3a5f]/5 dark:bg-[#1e3a5f]/20 hover:bg-[#1e3a5f]/5">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#1e3a5f] dark:text-blue-300">Sale #</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#1e3a5f] dark:text-blue-300">Date</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#1e3a5f] dark:text-blue-300">Customer</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#1e3a5f] dark:text-blue-300">Salesperson</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#1e3a5f] dark:text-blue-300 text-right">Amount</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#1e3a5f] dark:text-blue-300">Invoice</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-[#1e3a5f] dark:text-blue-300">EFD Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {receipts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-16 text-center text-muted-foreground">
                        <TRALogo size={48} />
                        <p className="mt-3 text-sm font-medium">No fiscal receipts yet</p>
                        <p className="text-xs mt-1">Sales will appear here for TRA submission</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    receipts.slice(0, 25).map((r, i) => (
                      <TableRow key={r.id} className={i % 2 === 0 ? "bg-muted/20" : ""}>
                        <TableCell className="font-mono text-xs font-medium text-foreground">{r.saleNumber}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(r.createdAt).toLocaleDateString("en-GB")}
                        </TableCell>
                        <TableCell className="text-sm text-foreground">{r.customer}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.salesperson}</TableCell>
                        <TableCell className="text-sm font-semibold text-foreground text-right">
                          {formatCurrency(r.total, "USD")}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">
                          {r.invoiceNumber || "—"}
                        </TableCell>
                        <TableCell>
                          <EFDStatusBadge status={r.traStatus} receiptNo={r.traReceiptNo} />
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* ── Config Tab (Admin only) ──────────────────────────────── */}
        {isAdmin && (
          <TabsContent value="config">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Credentials */}
              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="p-5 pb-0 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                    <Lock className="size-5 text-[#1e3a5f] dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">TRA Credentials</h3>
                    <p className="text-xs text-muted-foreground">Your EFD device registration details</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {/* Enable toggle */}
                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">Enable TRA Integration</p>
                      <p className="text-xs text-muted-foreground">Submit fiscal receipts to TRA automatically</p>
                    </div>
                    <button
                      onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        config.enabled ? "bg-[#1e3a5f]" : "bg-muted"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                        config.enabled ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">Tax Identification Number (TIN)</Label>
                      <Input value={config.tin} onChange={e => setConfig(c => ({ ...c, tin: e.target.value }))} placeholder="e.g., 100-123-456" className="h-9 text-sm font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">VAT Registration Number (VRN)</Label>
                      <Input value={config.vrn} onChange={e => setConfig(c => ({ ...c, vrn: e.target.value }))} placeholder="e.g., 10-012345-A" className="h-9 text-sm font-mono" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">EFD Serial Number</Label>
                      <Input value={config.serial} onChange={e => setConfig(c => ({ ...c, serial: e.target.value }))} placeholder="e.g., 10TZ100001" className="h-9 text-sm font-mono" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Connection */}
              <div className="bg-card border border-border rounded-xl shadow-sm">
                <div className="p-5 pb-0 flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-[#1e3a5f]/10">
                    <ArrowUpRight className="size-5 text-[#1e3a5f] dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">Connection Settings</h3>
                    <p className="text-xs text-muted-foreground">API endpoint and certificate configuration</p>
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">TRA VFD API Endpoint</Label>
                    <Input value={config.apiUrl} onChange={e => setConfig(c => ({ ...c, apiUrl: e.target.value }))} placeholder="https://vfd.tra.go.tz/api" className="h-9 text-sm font-mono" />
                    <p className="text-[10px] text-muted-foreground">Production: https://vfd.tra.go.tz/api | Sandbox: https://virtual.tra.go.tz/efdmsRctApi</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Digital Certificate Path (.pfx)</Label>
                    <Input value={config.certPath} onChange={e => setConfig(c => ({ ...c, certPath: e.target.value }))} placeholder="/path/to/certificate.pfx" className="h-9 text-sm" />
                    <p className="text-[10px] text-muted-foreground">PFX certificate issued by TRA for your EFD device</p>
                  </div>

                  <Separator />

                  <div className="flex items-center gap-2">
                    <Button onClick={handleSaveConfig} disabled={saving}
                      className="flex-1 bg-[#1e3a5f] text-white hover:bg-[#162d4a]">
                      {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                      Save Configuration
                    </Button>
                    <Button variant="outline" onClick={handleTestConnection} disabled={testing}>
                      {testing ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Wifi className="size-4 mr-1.5" />}
                      Test
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        )}

        {/* ── Compliance Info Tab ──────────────────────────────────── */}
        <TabsContent value="compliance">
          <div className="bg-card border border-border rounded-xl shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <TRALogo size={40} />
              <div>
                <h3 className="text-lg font-bold text-foreground">TRA EFD Compliance Guide</h3>
                <p className="text-sm text-muted-foreground">Understanding your tax obligations under Tanzanian law</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <ComplianceSection
                  title="What is EFD/VFD?"
                  content="The Electronic Fiscal Device (EFD) system is mandated by the Tanzania Revenue Authority (TRA) under the VAT Act. All VAT-registered businesses must issue electronic fiscal receipts for every sale. The Virtual Fiscal Device (VFD) is the software-based implementation."
                />
                <ComplianceSection
                  title="Who Must Comply?"
                  content="All businesses registered for VAT in Tanzania are required to use EFD/VFD. This includes importers, wholesalers, retailers, and service providers with annual turnover exceeding the VAT threshold."
                />
                <ComplianceSection
                  title="Penalties for Non-Compliance"
                  content="Failure to use EFD/VFD may result in penalties including fines, business closure, and criminal prosecution under the Tax Administration Act, 2015."
                />
              </div>

              <div className="space-y-4">
                <ComplianceSection
                  title="How FLUX Integrates"
                  content="FLUX automatically generates fiscal receipts for every sale and submits them to TRA in real-time through the VFD API. Each receipt receives a unique verification code that customers can use to verify their receipt on the TRA portal."
                />
                <ComplianceSection
                  title="Required Credentials"
                  content="To enable TRA integration, you need: (1) Tax Identification Number (TIN), (2) VAT Registration Number (VRN), (3) EFD Serial Number assigned by TRA, and (4) a digital certificate (.pfx file) from your TRA registration."
                />
                <ComplianceSection
                  title="Getting Started"
                  content="Visit your nearest TRA office or apply online at tra.go.tz to register your business and obtain EFD credentials. Once registered, enter your credentials in the Configuration tab above."
                />
              </div>
            </div>

            <Separator className="my-6" />

            <div className="rounded-lg bg-[#1e3a5f]/5 dark:bg-[#1e3a5f]/20 border border-[#1e3a5f]/10 p-4">
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">Disclaimer:</strong> This integration is provided as-is.
                Ensure your TRA credentials are valid and your certificate is up to date.
                FLUX is not responsible for any penalties arising from misconfigured or delayed submissions.
                For TRA support, contact: info@tra.go.tz or call 0800 750 075.
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ── Test Connection Dialog ────────────────────────────────── */}
      <Dialog open={showTestResult} onOpenChange={setShowTestResult}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {testResult?.success ? (
                <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500/12">
                  <Wifi className="size-4 text-emerald-500" />
                </div>
              ) : (
                <div className="flex size-8 items-center justify-center rounded-full bg-red-500/12">
                  <WifiOff className="size-4 text-red-500" />
                </div>
              )}
              TRA Connection Test
            </DialogTitle>
            <DialogDescription>{testResult?.message}</DialogDescription>
          </DialogHeader>
          {testResult?.details && (
            <div className="rounded-lg border border-border p-3 space-y-2 text-sm">
              {Object.entries(testResult.details).map(([key, value]) => (
                <div key={key} className="flex justify-between">
                  <span className="text-muted-foreground capitalize">{key}</span>
                  <span className="font-mono font-medium text-foreground">{value}</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowTestResult(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Sub Components ──────────────────────────────────────────────────────

function EFDStatusBadge({ status, receiptNo }: { status: string; receiptNo: string | null }) {
  if (status === "synced") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
        <CheckCircle className="size-3" /> {receiptNo || "Verified"}
      </span>
    );
  }
  if (status === "failed") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/12 px-2.5 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
        <XCircle className="size-3" /> Failed
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[#1e3a5f]/10 px-2.5 py-1 text-xs font-semibold text-[#1e3a5f] dark:text-blue-300">
      <Clock className="size-3" /> Pending
    </span>
  );
}

function GovStatCard({ icon: Icon, label, value, variant = "default" }: {
  icon: React.ElementType; label: string; value: number;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const styles = {
    default: "bg-[#1e3a5f]/8 text-[#1e3a5f] dark:text-blue-300",
    success: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    danger: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`flex size-9 items-center justify-center rounded-lg ${styles[variant].split(" ")[0]}`}>
          <Icon className={`size-4 ${styles[variant].split(" ").slice(1).join(" ")}`} />
        </div>
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

function ComplianceSection({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
        <Shield className="size-4 text-[#1e3a5f] dark:text-blue-400" />
        {title}
      </h4>
      <p className="text-xs text-muted-foreground leading-relaxed">{content}</p>
    </div>
  );
}
