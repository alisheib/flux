"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Loader2,
  Building2,
  Receipt,
  Percent,
  Database,
  AlertTriangle,
  Save,
  Shield,
  Trash2,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { ALL_ROLES, ALL_MODULES, DEFAULT_PERMISSIONS, type RolePermissions } from "@/lib/auth-client";

import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FormSelect } from "@/components/ui/form-select";
import { CURRENCIES } from "@/lib/currency";

// ─── Types ─────────────────────────────────────────────────────────────

interface OrgData {
  id: string;
  name: string;
  logo: string | null;
  currency: string;
  locale: string;
  taxRate: number;
  taxLabel: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
}

interface OrgSettingsData {
  id: string;
  orgId: string;
  defaultMargin: number;
  secondaryMargin: number;
  exchangeRate: number;
  invoicePrefix: string;
  invoiceNextNum: number;
  receiptPrefix: string;
  receiptNextNum: number;
  proformaPrefix: string;
  proformaNextNum: number;
  proformaValidityDays: number;
  rolePermissions: string | null;
  tallyEnabled: boolean;
}

interface SettingsResponse {
  organization: OrgData;
  settings: OrgSettingsData;
  tallyEnabled: boolean;
  currencyLocked?: boolean;
}

// Currency list comes from the canonical registry — see lib/currency.ts.
// The old hardcoded ["USD","TSH","EUR","GBP"] list left users unable to
// set their org currency to KES, NGN, UGX, ZAR, and the other markets
// the rest of the app already supports.

// ─── Main Page Component ───────────────────────────────────────────────

export default function SettingsPage() {
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [org, setOrg] = useState<OrgData | null>(null);
  const [settings, setSettings] = useState<OrgSettingsData | null>(null);

  // Saving flags per section
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingTax, setSavingTax] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [savingMargin, setSavingMargin] = useState(false);
  const [seedingData, setSeedingData] = useState(false);
  const [showSeedConfirm, setShowSeedConfirm] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [savingRoles, setSavingRoles] = useState(false);
  const [rolePerms, setRolePerms] = useState<RolePermissions>(DEFAULT_PERMISSIONS);
  const [tallyEnabled, setTallyEnabled] = useState(false);
  const [savingTally, setSavingTally] = useState(false);
  const [currencyLocked, setCurrencyLocked] = useState(false);

  // ─── Fetch settings ───────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data: SettingsResponse = await res.json();
      setOrg(data.organization);
      setSettings(data.settings);
      setTallyEnabled(data.tallyEnabled ?? false);
      setCurrencyLocked(data.currencyLocked ?? false);
      // Load role permissions
      if (data.settings?.rolePermissions) {
        try {
          const parsed = JSON.parse(data.settings.rolePermissions);
          setRolePerms(parsed);
        } catch {
          setRolePerms(DEFAULT_PERMISSIONS);
        }
      } else {
        setRolePerms(DEFAULT_PERMISSIONS);
      }
    } catch {
      toast.error("Failed to load settings", { description: "Please try again or contact support." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // ─── Save organization info ───────────────────────────────────────

  const handleSaveOrg = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      address: form.get("address") as string,
      phone: form.get("phone") as string,
      email: form.get("email") as string,
      website: form.get("website") as string,
      logo: form.get("logo") as string,
      currency: form.get("currency") as string,
    };

    try {
      setSavingOrg(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization: body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to save");
      }
      const data: SettingsResponse = await res.json();
      setOrg(data.organization);
      setSettings(data.settings);
      setCurrencyLocked(data.currencyLocked ?? currencyLocked);
      toast.success("Organization saved", { description: "Your company details have been updated." });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Please try again or contact support.";
      toast.error("Failed to save organization info", { description: message });
    } finally {
      setSavingOrg(false);
    }
  };

  // ─── Save tax config ──────────────────────────────────────────────

  const handleSaveTax = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      taxLabel: form.get("taxLabel") as string,
      taxRate: parseFloat(form.get("taxRate") as string) || 0,
    };

    try {
      setSavingTax(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization: body }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data: SettingsResponse = await res.json();
      setOrg(data.organization);
      setSettings(data.settings);
      toast.success("Tax settings saved", { description: "Tax configuration has been updated." });
    } catch {
      toast.error("Failed to save tax configuration", { description: "Please try again or contact support." });
    } finally {
      setSavingTax(false);
    }
  };

  // ─── Save invoice settings ────────────────────────────────────────

  const handleSaveInvoice = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      invoicePrefix: form.get("invoicePrefix") as string,
      invoiceNextNum: parseInt(form.get("invoiceNextNum") as string) || 1,
      receiptPrefix: form.get("receiptPrefix") as string,
      receiptNextNum: parseInt(form.get("receiptNextNum") as string) || 1,
      proformaPrefix: form.get("proformaPrefix") as string,
      proformaNextNum: parseInt(form.get("proformaNextNum") as string) || 1,
      proformaValidityDays: parseInt(form.get("proformaValidityDays") as string) || 14,
    };

    try {
      setSavingInvoice(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: body }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data: SettingsResponse = await res.json();
      setOrg(data.organization);
      setSettings(data.settings);
      toast.success("Invoice settings saved", { description: "Invoice and receipt numbering updated." });
    } catch {
      toast.error("Failed to save invoice settings", { description: "Please try again or contact support." });
    } finally {
      setSavingInvoice(false);
    }
  };

  // ─── Save margin defaults ────────────────────────────────────────

  const handleSaveMargin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      defaultMargin: parseFloat(form.get("defaultMargin") as string) || 10,
      secondaryMargin:
        parseFloat(form.get("secondaryMargin") as string) || 5,
      exchangeRate:
        parseFloat(form.get("exchangeRate") as string) || 1,
    };

    try {
      setSavingMargin(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: body }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data: SettingsResponse = await res.json();
      setOrg(data.organization);
      setSettings(data.settings);
      toast.success("Margin settings saved", { description: "Default margins and exchange rate updated." });
    } catch {
      toast.error("Failed to save margin defaults", { description: "Please try again or contact support." });
    } finally {
      setSavingMargin(false);
    }
  };

  // ─── Toggle role permission ─────────────────────────────────────

  const toggleRolePerm = (module: string, role: string) => {
    // Admin always has access, can't be toggled
    if (role === "admin") return;

    setRolePerms((prev) => {
      const current = prev[module] || [];
      const has = current.includes(role);
      return {
        ...prev,
        [module]: has
          ? current.filter((r) => r !== role)
          : [...current, role],
      };
    });
  };

  const handleSaveRolePerms = async () => {
    try {
      setSavingRoles(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: { rolePermissions: JSON.stringify(rolePerms) },
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success("Permissions saved", { description: "Role access permissions have been updated." });
    } catch {
      toast.error("Failed to save role permissions", { description: "Please try again or contact support." });
    } finally {
      setSavingRoles(false);
    }
  };

  const resetRolePerms = () => {
    setRolePerms(DEFAULT_PERMISSIONS);
  };

  // ─── Toggle tally integration ──────────────────────────────────

  const handleToggleTally = async (enabled: boolean) => {
    try {
      setSavingTally(true);
      setTallyEnabled(enabled);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: { tallyEnabled: enabled } }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(enabled ? "TRA Tally integration enabled" : "TRA Tally integration disabled");
      // Notify sidebar to update immediately
      window.dispatchEvent(new CustomEvent("flux-tally-toggle", { detail: { enabled } }));
    } catch {
      setTallyEnabled(!enabled);
      toast.error("Failed to update Tally integration setting", { description: "Please try again or contact support." });
    } finally {
      setSavingTally(false);
    }
  };

  // ─── Reset database ─────────────────────────────────────────────

  const handleResetDatabase = async () => {
    if (!resetPassword) {
      toast.error("Please enter your password to confirm", { description: "Please try again or contact support." });
      return;
    }
    setResetting(true);
    try {
      const res = await fetch("/api/admin/reset-database", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset");
      toast.success("Data reset complete", { description: "All business data has been permanently deleted." });
      setShowResetConfirm(false);
      setResetPassword("");
      fetchSettings();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to reset database", { description: "Please try again or contact support." });
    } finally {
      setResetting(false);
    }
  };

  // ─── Seed demo data ──────────────────────────────────────────────

  const handleSeedData = async () => {
    try {
      setSeedingData(true);
      const res = await fetch("/api/seed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Failed to seed data");
      toast.success("Demo data loaded", { description: "Sample data has been added to your workspace." });
      setShowSeedConfirm(false);
      fetchSettings();
    } catch {
      toast.error("Failed to seed demo data", { description: "Please try again or contact support." });
    } finally {
      setSeedingData(false);
    }
  };

  // ─── Loading ──────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Settings"
          description="Configure your organization"
        />
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Configure your organization"
      />

      {/* ── Organization Info ──────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="kpi-icon-accent flex h-9 w-9 items-center justify-center rounded-lg">
              <Building2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Organization Info</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Your company details and branding
          </p>
        </div>
        <div className="p-5">
          <form onSubmit={handleSaveOrg} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="org-name">Company Name</Label>
                <Input
                  id="org-name"
                  name="name"
                  defaultValue={org?.name || ""}
                  placeholder="Company name"
                  className="mt-1.5 text-base h-11"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="org-address">Address</Label>
                <Input
                  id="org-address"
                  name="address"
                  defaultValue={org?.address || ""}
                  placeholder="Street, City, Country"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-phone">Phone</Label>
                <Input
                  id="org-phone"
                  name="phone"
                  defaultValue={org?.phone || ""}
                  placeholder="+1 234 567 890"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-email">Email</Label>
                <Input
                  id="org-email"
                  name="email"
                  type="email"
                  defaultValue={org?.email || ""}
                  placeholder="contact@company.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-website">Website</Label>
                <Input
                  id="org-website"
                  name="website"
                  defaultValue={org?.website || ""}
                  placeholder="https://yoursite.com"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-logo">Logo URL</Label>
                <Input
                  id="org-logo"
                  name="logo"
                  defaultValue={org?.logo || ""}
                  placeholder="https://cdn.yoursite.com/logo.png"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="org-currency">Currency {currencyLocked && <span className="text-xs font-normal text-muted-foreground ml-1">(locked)</span>}</Label>
                {currencyLocked ? (
                  <>
                    <Input
                      id="org-currency"
                      value={org?.currency || "USD"}
                      disabled
                      className="mt-1.5 opacity-60"
                    />
                    <input type="hidden" name="currency" value={org?.currency || "USD"} />
                    <p className="text-xs text-muted-foreground mt-1">Base currency cannot be changed after sales have been recorded.</p>
                  </>
                ) : (
                  <FormSelect
                    id="org-currency"
                    name="currency"
                    defaultValue={org?.currency || "USD"}
                    // Dropdown shows the full "USD — US Dollar" so users can
                    // identify what they're picking. The trigger button shows
                    // just the code (USD/TZS/...) so it stays compact in this
                    // narrow column.
                    options={CURRENCIES.map((c) => ({
                      value: c.code,
                      label: `${c.code} — ${c.name}`,
                      triggerLabel: c.code,
                    }))}
                    className="mt-1.5"
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingOrg}
                className="btn-brand"
              >
                {savingOrg ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Organization
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Section Divider ──────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Tax Configuration ─────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="kpi-icon-accent flex h-9 w-9 items-center justify-center rounded-lg">
              <Receipt className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Tax Configuration</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure tax label and rate for invoices
          </p>
        </div>
        <div className="p-5">
          <form onSubmit={handleSaveTax} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="tax-label">Tax Label</Label>
                <Input
                  id="tax-label"
                  name="taxLabel"
                  defaultValue={org?.taxLabel || "VAT"}
                  placeholder="VAT"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="tax-rate">Tax Rate (%)</Label>
                <Input
                  id="tax-rate"
                  name="taxRate"
                  type="number"
                  step="0.01"
                  min={0}
                  max={100}
                  defaultValue={org?.taxRate || 0}
                  placeholder="18"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingTax}
                className="btn-brand"
              >
                {savingTax ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Tax Config
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Section Divider ──────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Invoice Settings ──────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="kpi-icon-accent flex h-9 w-9 items-center justify-center rounded-lg">
              <Receipt className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Invoice Settings</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure invoice and receipt numbering
          </p>
        </div>
        <div className="p-5">
          <form onSubmit={handleSaveInvoice} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="invoice-prefix">Invoice Prefix</Label>
                <Input
                  id="invoice-prefix"
                  name="invoicePrefix"
                  defaultValue={settings?.invoicePrefix || "INV"}
                  placeholder="INV"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="invoice-next">Next Invoice Number</Label>
                <Input
                  id="invoice-next"
                  name="invoiceNextNum"
                  type="number"
                  min={1}
                  defaultValue={settings?.invoiceNextNum || 1}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="receipt-prefix">Receipt Prefix</Label>
                <Input
                  id="receipt-prefix"
                  name="receiptPrefix"
                  defaultValue={settings?.receiptPrefix || "RCP"}
                  placeholder="RCP"
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="receipt-next">Next Receipt Number</Label>
                <Input
                  id="receipt-next"
                  name="receiptNextNum"
                  type="number"
                  min={1}
                  defaultValue={settings?.receiptNextNum || 1}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="proforma-prefix">Proforma Prefix</Label>
                <Input
                  id="proforma-prefix"
                  name="proformaPrefix"
                  defaultValue={settings?.proformaPrefix || "PRO"}
                  placeholder="PRO"
                  className="mt-1.5"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Separate from invoice numbering so customers/auditors can't confuse the two.</p>
              </div>
              <div>
                <Label htmlFor="proforma-next">Next Proforma Number</Label>
                <Input
                  id="proforma-next"
                  name="proformaNextNum"
                  type="number"
                  min={1}
                  defaultValue={settings?.proformaNextNum || 1}
                  className="mt-1.5"
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="proforma-validity">Proforma Validity (days)</Label>
                <Input
                  id="proforma-validity"
                  name="proformaValidityDays"
                  type="number"
                  min={1}
                  max={365}
                  defaultValue={settings?.proformaValidityDays || 14}
                  className="mt-1.5"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">Default window quotes remain valid. After this many days, a proforma auto-marks as expired.</p>
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingInvoice}
                className="btn-brand"
              >
                {savingInvoice ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Invoice Settings
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Section Divider ──────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Margin Defaults ───────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="kpi-icon-accent flex h-9 w-9 items-center justify-center rounded-lg">
              <Percent className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Margin Defaults</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Default margin percentages and exchange rate for calculations
          </p>
        </div>
        <div className="p-5">
          <form onSubmit={handleSaveMargin} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="default-margin">Default Margin %</Label>
                <Input
                  id="default-margin"
                  name="defaultMargin"
                  type="number"
                  step="0.1"
                  min={0}
                  defaultValue={settings?.defaultMargin || 10}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="secondary-margin">Secondary Margin %</Label>
                <Input
                  id="secondary-margin"
                  name="secondaryMargin"
                  type="number"
                  step="0.1"
                  min={0}
                  defaultValue={settings?.secondaryMargin || 5}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="exchange-rate">Default Exchange Rate</Label>
                <Input
                  id="exchange-rate"
                  name="exchangeRate"
                  type="number"
                  step="0.01"
                  min={0}
                  defaultValue={settings?.exchangeRate ?? 1}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                type="submit"
                disabled={savingMargin}
                className="btn-brand"
              >
                {savingMargin ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Margin Defaults
              </Button>
            </div>
          </form>
        </div>
      </div>

      {/* ── Section Divider ──────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Role Permissions ─────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="kpi-icon-accent flex h-9 w-9 items-center justify-center rounded-lg">
              <Shield className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Role Permissions</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Configure which roles can access each module. Admin always has full access.
          </p>
        </div>
        <div className="p-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Module
                  </th>
                  {ALL_ROLES.map((role) => (
                    <th
                      key={role}
                      className="px-3 py-2 text-center text-xs font-medium text-muted-foreground uppercase tracking-wide"
                    >
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_MODULES.map((mod) => (
                  <tr key={mod} className="border-b border-border/50 last:border-0">
                    <td className="py-2.5 pr-4 font-medium text-foreground capitalize">
                      {mod}
                    </td>
                    {ALL_ROLES.map((role) => {
                      const isAdmin = role === "admin";
                      const checked = isAdmin || (rolePerms[mod]?.includes(role) ?? false);
                      return (
                        <td key={role} className="px-3 py-2.5 text-center">
                          <label className="inline-flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isAdmin}
                              onChange={() => toggleRolePerm(mod, role)}
                              className="size-4 rounded border-border text-[#d97706] focus:ring-[#d97706] disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed accent-[#d97706]"
                            />
                          </label>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 flex items-center gap-3 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={resetRolePerms}
            >
              Reset to Defaults
            </Button>
            <Button
              onClick={handleSaveRolePerms}
              disabled={savingRoles}
              className="btn-brand"
            >
              {savingRoles ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save Permissions
            </Button>
          </div>
        </div>
      </div>

      {/* ── Section Divider ──────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Tally Integration ──────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="kpi-icon-accent flex h-9 w-9 items-center justify-center rounded-lg">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">TRA Tally Integration</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Enable Tanzania Revenue Authority (TRA) fiscal compliance integration
          </p>
        </div>
        <div className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                Enable TRA Fiscal Compliance
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Shows the TRA Tally section in the sidebar for EFD receipt management
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={tallyEnabled}
              disabled={savingTally}
              onClick={() => handleToggleTally(!tallyEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
                tallyEnabled ? "bg-[#d97706]" : "bg-input"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-background shadow-lg ring-0 transition duration-200 ease-in-out ${
                  tallyEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* ── Section Divider ──────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Data Management ───────────────────────────────────── */}
      <div className="bg-card border border-border rounded-xl shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="kpi-icon-accent flex h-9 w-9 items-center justify-center rounded-lg">
              <Database className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold">Data Management</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Seed demo data or manage your database
          </p>
        </div>
        <div className="p-5">
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Warning
                  </p>
                  <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                    Seeding demo data will add sample shipments, items,
                    expenses, products, and sales to your organization. Existing
                    data will not be deleted but may be mixed with demo data.
                  </p>
                </div>
              </div>
            </div>
            <Button
              variant="outline"
              className="border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/20"
              onClick={() => setShowSeedConfirm(true)}
            >
              <Database className="mr-2 h-4 w-4" />
              Seed Demo Data
            </Button>
          </div>
        </div>
      </div>

      {/* ── Seed Confirmation Dialog ──────────────────────────── */}
      <Dialog open={showSeedConfirm} onOpenChange={setShowSeedConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Seed Demo Data?</DialogTitle>
            <DialogDescription>
              This will populate your organization with sample data including
              shipments, products, expenses, and sales records. Existing data
              will remain but may be mixed with demo entries. Are you sure you
              want to proceed?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSeedConfirm(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSeedData}
              disabled={seedingData}
            >
              {seedingData ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Database className="mr-2 h-4 w-4" />
              )}
              Seed Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Section Divider ──────────────────────────────────── */}
      <div className="border-t border-border" />

      {/* ── Reset Database (Danger Zone) ────────────────────── */}
      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 border-l-4 border-l-red-500 rounded-xl shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400">
              <Trash2 className="h-5 w-5" />
            </div>
            <h3 className="text-base font-semibold text-red-600 dark:text-red-400">Danger Zone</h3>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanently delete all business data. Users and settings will be preserved.
          </p>
        </div>
        <div className="p-5">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-300">
                  This action is irreversible
                </p>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                  This will permanently delete all sales, invoices, products, shipments,
                  categories, and expenses. You will need to re-enter your password to confirm.
                </p>
              </div>
            </div>
          </div>
          <Button
            variant="destructive"
            className="mt-4"
            onClick={() => setShowResetConfirm(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Reset All Data
          </Button>
        </div>
      </div>

      {/* ── Reset Confirmation Dialog ───────────────────────── */}
      <Dialog open={showResetConfirm} onOpenChange={(open) => { setShowResetConfirm(open); if (!open) setResetPassword(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="size-5" />
              Reset All Data
            </DialogTitle>
            <DialogDescription>
              This will permanently delete all business data including sales, invoices,
              products, shipments, and categories. This cannot be undone.
              Enter your password to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label>Confirm your password</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="password"
                value={resetPassword}
                onChange={(e) => setResetPassword(e.target.value)}
                placeholder="Enter your password"
                className="pl-10"
                onKeyDown={(e) => { if (e.key === "Enter") handleResetDatabase(); }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowResetConfirm(false); setResetPassword(""); }}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleResetDatabase}
              disabled={resetting || !resetPassword}
            >
              {resetting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Delete All Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
