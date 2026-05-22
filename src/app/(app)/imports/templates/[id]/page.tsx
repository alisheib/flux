"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, ChevronLeft, Loader2, Trash2 } from "lucide-react";

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [entityType, setEntityType] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState("");

  const fetchTemplate = useCallback(async () => {
    const { id } = await params;
    setTemplateId(id);
    try {
      const res = await fetch(`/api/import-templates/${id}`);
      if (!res.ok) { router.push("/imports/templates"); return; }
      const data = await res.json();
      setName(data.name);
      setEntityType(data.entityType);
      setDescription(data.description || "");
    } catch {
      toast.error("Failed to load template");
      router.push("/imports/templates");
    } finally {
      setLoading(false);
    }
  }, [params, router]);

  useEffect(() => { fetchTemplate(); }, [fetchTemplate]);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Template name is required"); return; }
    setSaving(true);
    try {
      const res = await fetch(`/api/import-templates/${templateId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
      });
      if (!res.ok) throw new Error();
      toast.success("Template updated");
      router.push("/imports/templates");
    } catch {
      toast.error("Failed to update template");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/import-templates/${templateId}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Template deleted");
      router.push("/imports/templates");
    } catch {
      toast.error("Failed to delete template");
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
          <span>Settings</span><span>/</span><span>Excel Import</span><span>/</span><span>Templates</span><span>/</span><span className="text-foreground">Edit</span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Edit template</h1>
            <p className="text-sm text-muted-foreground mt-1">{entityType && `${entityType[0].toUpperCase()}${entityType.slice(1)} template`}</p>
          </div>
          <Button variant="outline" size="sm" className="text-destructive" onClick={handleDelete}>
            <Trash2 className="mr-2 h-3.5 w-3.5" />Delete
          </Button>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 max-w-2xl space-y-5">
        <div className="space-y-1.5">
          <Label>Template name *</Label>
          <Input value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Entity type</Label>
          <Input value={entityType} disabled className="opacity-60" />
          <p className="text-xs text-muted-foreground">Entity type cannot be changed after creation.</p>
        </div>
        <div className="space-y-1.5">
          <Label>Description</Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} />
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/imports/templates")}>
          <ChevronLeft className="mr-1 h-3.5 w-3.5" />Back
        </Button>
        <Button className="btn-accent" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
          Save changes
        </Button>
      </div>
    </div>
  );
}
