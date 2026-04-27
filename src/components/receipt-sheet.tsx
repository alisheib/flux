"use client";

import React, { useState, useRef, useCallback } from "react";
import { formatCurrency } from "@/lib/calculations";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Check,
  Download,
  Printer,
  MessageCircle,
  Mail,
  Smartphone,
  Plus,
  Wallet,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface ReceiptSale {
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
  items: ReceiptItem[];
  createdAt: string;
  tendered?: number;
}

interface OrgSettings {
  currency: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  taxLabel?: string;
}

interface ReceiptSheetProps {
  open: boolean;
  onClose: () => void;
  sale: ReceiptSale | null;
  orgSettings: OrgSettings;
  onNewSale?: () => void;
  onDownloadReceipt?: () => void;
  onWhatsApp?: (sale: ReceiptSale) => void;
}

// ── Totals Row ────────────────────────────────────────────────────────────────

function TotalsRow({
  label,
  value,
  muted,
  bold,
  large,
  accent,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
  large?: boolean;
  accent?: "success" | "amber";
}) {
  const accentColors = {
    success: "text-emerald-600 dark:text-emerald-400",
    amber: "text-amber-600 dark:text-amber-400",
  };
  const valueColor = accent
    ? accentColors[accent]
    : muted
      ? "text-muted-foreground"
      : "text-foreground";
  const labelColor = muted ? "text-muted-foreground" : "text-foreground";

  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={`${labelColor} ${bold ? "font-semibold" : "font-normal"} ${large ? "text-base" : "text-[13.5px]"}`}
      >
        {label}
      </span>
      <span
        className={`font-mono tabular-nums ${valueColor} ${bold ? "font-bold" : "font-medium"} ${large ? "text-[22px] font-display tracking-tight" : "text-sm"}`}
      >
        {value}
      </span>
    </div>
  );
}

// ── Receipt Sheet ─────────────────────────────────────────────────────────────

export function ReceiptSheet({
  open,
  onClose,
  sale,
  orgSettings,
  onNewSale,
  onDownloadReceipt,
  onWhatsApp,
}: ReceiptSheetProps) {
  const [closing, setClosing] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const dragY = useRef(0);

  const close = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onClose();
    }, 220);
  }, [onClose]);

  // Drag-to-dismiss
  const onTouchStart = useCallback((e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    dragY.current = 0;
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && sheetRef.current) {
      dragY.current = dy;
      sheetRef.current.style.transform = `translateY(${dy}px)`;
    }
  }, []);

  const onTouchEnd = useCallback(() => {
    if (sheetRef.current) {
      if (dragY.current > 100) {
        close();
      } else {
        sheetRef.current.style.transform = "";
      }
    }
  }, [close]);

  if (!open && !closing) return null;
  if (!sale) return null;

  const change = (sale.tendered || 0) - sale.total;
  const cur = orgSettings.currency;

  return (
    <div
      className="fixed inset-0 z-[90]"
      role="dialog"
      aria-modal="true"
      aria-label="Receipt"
    >
      {/* Backdrop */}
      <div
        onClick={close}
        className={`absolute inset-0 bg-black/60 ${closing ? "animate-[fade-out_220ms_forwards]" : "animate-[fade-in_200ms]"}`}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`absolute inset-x-0 bottom-0 flex max-h-[92vh] flex-col rounded-t-2xl bg-background shadow-[0_-12px_40px_rgba(0,0,0,0.32)] pb-[env(safe-area-inset-bottom)] ${closing ? "animate-[sheet-out_220ms_forwards]" : "animate-[sheet-in_280ms_ease-out]"}`}
      >
        {/* Drag handle */}
        <div className="flex shrink-0 justify-center pb-1 pt-2.5">
          <span className="h-[5px] w-11 rounded-full bg-border" />
        </div>

        {/* Success icon + amount */}
        <div className="relative shrink-0 border-b border-border bg-gradient-to-b from-emerald-500/[0.07] to-transparent px-5 pb-5 pt-2 text-center dark:from-emerald-500/[0.05]">
          {/* Kente stripe accent */}
          <div className="absolute left-[20%] right-[20%] top-0 h-0.5 rounded-b-sm bg-gradient-to-r from-amber-500 via-emerald-500 to-blue-600 opacity-60" />

          <div className="mx-auto mb-3.5 mt-1 flex size-16 animate-[check-pop_480ms_cubic-bezier(0.34,1.56,0.64,1)] items-center justify-center rounded-full bg-emerald-500 shadow-[0_6px_20px_rgba(16,185,129,0.35)]">
            <Check className="size-8 text-white" strokeWidth={3} />
          </div>

          <p className="mb-1 text-[13px] font-medium text-muted-foreground">
            Sale complete
          </p>
          <p className="font-display text-[30px] font-bold leading-tight tracking-tight text-foreground">
            {formatCurrency(sale.total, cur)}
          </p>

          {sale.tendered && sale.tendered > 0 && change > 0 && (
            <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-amber-500/12 px-3 py-1 text-[12.5px] font-semibold text-amber-700 dark:text-amber-400">
              <Wallet className="size-3.5" />
              Change due:{" "}
              <span className="font-mono tabular-nums">
                {formatCurrency(change, cur)}
              </span>
            </div>
          )}
        </div>

        {/* Scrollable details */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Meta */}
          <div className="mb-3.5 flex justify-between text-[12.5px] text-muted-foreground">
            <div>
              <div className="font-mono font-medium text-foreground">
                {sale.saleNumber}
              </div>
              <div className="mt-0.5 text-[11.5px]">
                {new Date(sale.createdAt).toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <div className="text-right">
              {sale.customer && (
                <div className="font-medium text-foreground">
                  {sale.customer}
                </div>
              )}
              <div className="text-[11.5px] capitalize">
                {sale.paymentMethod.replace(/_/g, " ")}
              </div>
            </div>
          </div>

          {/* Items header */}
          <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            Items ({sale.items.length})
          </div>

          {/* Items list */}
          <div className="mb-3.5 overflow-hidden rounded-lg border border-border">
            {sale.items.map((item, i) => (
              <div
                key={i}
                className={`flex items-center gap-2.5 px-3.5 py-3 ${i < sale.items.length - 1 ? "border-b border-border" : ""} ${i % 2 ? "bg-muted/30" : "bg-background"}`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-medium text-foreground">
                    {item.name}
                  </div>
                  <div className="mt-0.5 font-mono text-[11.5px] text-muted-foreground">
                    {item.quantity} x {formatCurrency(item.unitPrice, cur)}
                  </div>
                </div>
                <div className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground">
                  {formatCurrency(item.quantity * item.unitPrice, cur)}
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mb-3 flex flex-col gap-1.5">
            <TotalsRow
              label="Subtotal"
              value={formatCurrency(sale.subtotal, cur)}
            />
            {sale.discount > 0 && (
              <TotalsRow
                label="Discount"
                value={`-${formatCurrency(sale.discount, cur)}`}
                accent="success"
              />
            )}
            {sale.taxRate > 0 && (
              <TotalsRow
                label={`${orgSettings.taxLabel || "VAT"} (${sale.taxRate}%)`}
                value={formatCurrency(sale.taxAmount, cur)}
                muted
              />
            )}
            <Separator className="my-1.5" />
            <TotalsRow
              label="Total"
              value={formatCurrency(sale.total, cur)}
              bold
              large
            />
            {sale.tendered && sale.tendered > 0 && (
              <>
                <TotalsRow
                  label={`Tendered (${sale.paymentMethod.replace(/_/g, " ")})`}
                  value={formatCurrency(sale.tendered, cur)}
                  muted
                />
                {change > 0 && (
                  <TotalsRow
                    label="Change"
                    value={formatCurrency(change, cur)}
                    accent="amber"
                  />
                )}
              </>
            )}
          </div>
        </div>

        {/* Actions -- stacked vertically */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-border bg-muted/30 px-4 pb-4 pt-3">
          {/* Primary: WhatsApp */}
          <Button
            onClick={() => onWhatsApp?.(sale)}
            className="h-[52px] w-full gap-2 rounded-xl bg-emerald-600 text-[15px] font-semibold text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
          >
            <MessageCircle className="size-[18px]" />
            Share via WhatsApp
          </Button>

          {/* Secondary: Download / Print */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={onDownloadReceipt}
              className="h-12 gap-1.5 rounded-xl text-sm font-medium"
            >
              <Download className="size-4" />
              PDF
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                /* print handled by parent */
              }}
              className="h-12 gap-1.5 rounded-xl text-sm font-medium"
            >
              <Printer className="size-4" />
              Print
            </Button>
          </div>

          {/* Tertiary: SMS / Email */}
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              className="h-11 gap-1.5 rounded-[10px] text-[13px]"
            >
              <Smartphone className="size-3.5" />
              SMS
            </Button>
            <Button
              variant="ghost"
              className="h-11 gap-1.5 rounded-[10px] text-[13px]"
            >
              <Mail className="size-3.5" />
              Email
            </Button>
          </div>

          {/* Continue: New sale */}
          <Button
            onClick={() => {
              close();
              setTimeout(() => onNewSale?.(), 220);
            }}
            className="mt-1 h-[52px] w-full gap-2 rounded-xl bg-[#d97706] text-[15px] font-semibold text-white hover:bg-[#b45309] dark:bg-[#d97706] dark:hover:bg-[#b45309]"
          >
            <Plus className="size-4" />
            New sale
          </Button>
        </div>
      </div>

      {/* Keyframe animations */}
      <style jsx>{`
        @keyframes sheet-in {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        @keyframes sheet-out {
          from {
            transform: translateY(0);
          }
          to {
            transform: translateY(100%);
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fade-out {
          from {
            opacity: 1;
          }
          to {
            opacity: 0;
          }
        }
        @keyframes check-pop {
          0% {
            transform: scale(0);
            opacity: 0;
          }
          60% {
            transform: scale(1.15);
            opacity: 1;
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
