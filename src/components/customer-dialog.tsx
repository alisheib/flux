"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";

interface CustomerData {
  id?: string;
  name: string;
  company: string;
  tin: string;
  phone: string;
  email: string;
  address: string;
  tags: string[];
  notes: string;
}

interface CustomerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  initialData?: Partial<CustomerData>;
  onSaved?: (customer: CustomerData & { id: string }) => void;
}

export function CustomerDialog({ open, onOpenChange, mode, initialData, onSaved }: CustomerDialogProps) {
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [tin, setTin] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && initialData) {
      setName(initialData.name || "");
      setCompany(initialData.company || "");
      setTin(initialData.tin || "");
      setPhone(initialData.phone || "");
      setEmail(initialData.email || "");
      setAddress(initialData.address || "");
      setTags(initialData.tags || []);
      setNotes(initialData.notes || "");
    } else if (open) {
      setName(""); setCompany(""); setTin(""); setPhone("");
      setEmail(""); setAddress(""); setTags([]); setNotes("");
    }
  }, [open, initialData]);

  const handleAddTag = () => {
    const tag = tagInput.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
    }
    setTagInput("");
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Customer name is required"); return; }

    setSaving(true);
    try {
      const body = {
        name: name.trim(),
        company: company.trim() || null,
        tin: tin.trim() || null,
        phone: phone.trim() ? (phone.trim().startsWith("+") ? phone.trim() : `+255${phone.trim().replace(/^0/, "")}`) : null,
        email: email.trim() || null,
        address: address.trim() || null,
        tags: tags.length > 0 ? tags : null,
        notes: notes.trim() || null,
      };

      const url = mode === "edit" && initialData?.id
        ? `/api/customers/${initialData.id}`
        : "/api/customers";
      const method = mode === "edit" ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || "Failed to save");
      }

      const saved = await res.json();
      toast.success(mode === "add" ? "Customer added" : "Customer updated", {
        description: `${saved.name}${saved.tin ? ` (TIN: ${saved.tin})` : ""}`,
      });
      onSaved?.(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error("Failed to save customer", {
        description: err instanceof Error ? err.message : "Please try again.",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px]">
        <DialogHeader>
          <DialogTitle>{mode === "add" ? "Add customer" : "Edit customer"}</DialogTitle>
          <DialogDescription>Only name and phone are required. The rest helps with invoicing and outreach.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 py-2">
          <div className="space-y-1.5">
            <Label>Name <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Amani Mushi" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Company</Label>
              <Input value={company} onChange={e => setCompany(e.target.value)} placeholder="(optional)" />
            </div>
            <div className="space-y-1.5">
              <Label>TIN <span className="text-xs text-muted-foreground">(Tax ID)</span></Label>
              <Input value={tin} onChange={e => setTin(e.target.value)} placeholder="123-456-789" className="font-mono" />
              <p className="text-xs text-muted-foreground">Format: 9 digits as 123-456-789</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <div className="flex items-center gap-0 border border-border rounded-[10px] focus-within:ring-2 focus-within:ring-amber-500/20 focus-within:border-amber-500">
                <span className="pl-3 pr-1 text-sm font-mono text-muted-foreground">+255</span>
                <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="712 345 678" className="border-0 focus-visible:ring-0 shadow-none" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="(optional)" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Address</Label>
            <Textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} placeholder="Plot/street, city" />
          </div>

          <div className="space-y-1.5">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-1.5 p-2 min-h-[40px] rounded-[10px] border border-border bg-muted/30 items-center">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11.5px] font-semibold bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="hover:opacity-70">
                    <X className="size-2.5" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(); } }}
                placeholder={tags.length > 0 ? "Add another..." : "wholesale, VIP, contractor..."}
                className="flex-1 min-w-[120px] border-0 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <p className="text-xs text-muted-foreground">Press Enter to add. Tags help you filter and segment customers.</p>
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Anything your team should know (special pricing, preferences)" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="btn-accent" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-2 h-3.5 w-3.5" />}
            {mode === "add" ? "Add customer" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
