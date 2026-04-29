"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Loader2, Save, User, Lock, Mail, Shield, Building2, Calendar } from "lucide-react";
import { validateRequired, validatePassword } from "@/lib/validate";
import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface ProfileData {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  emailVerified: boolean;
  createdAt: string;
  lastLogin: string | null;
  org: { name: string };
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [name, setName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data);
        setName(data.name);
      }
    } catch {
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const handleSaveName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error("Name is required"); return; }
    setSavingName(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Profile updated", { description: "Your display name has been saved." });
      fetchProfile();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to update");
    } finally {
      setSavingName(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateRequired(currentPassword, "Current password")) return;
    if (!validatePassword(newPassword)) return;
    if (newPassword !== confirmPassword) { toast.error("Passwords don't match", { description: "New password and confirmation must be identical." }); return; }
    setSavingPassword(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success("Password changed", { description: "Your password has been updated successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const initials = (profile?.name || user.name).split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Profile" description="Manage your account" />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <PageHeader title="Profile" description="Manage your account settings" />

      {/* User Card */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm p-6">
        <div className="flex items-center gap-4">
          <Avatar className="size-16 ring-2 ring-[var(--flux-accent)]/20">
            <AvatarFallback className="kpi-icon-accent text-lg font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-xl font-bold text-foreground">{profile?.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary" className="capitalize text-xs">{profile?.role}</Badge>
              {profile?.emailVerified && (
                <Badge className="badge-success text-xs border-0">Verified</Badge>
              )}
            </div>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Email:</span>
            <span className="font-medium text-foreground">{profile?.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Organization:</span>
            <span className="font-medium text-foreground">{profile?.org.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Role:</span>
            <span className="font-medium text-foreground capitalize">{profile?.role}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">Joined:</span>
            <span className="font-medium text-foreground">{profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "—"}</span>
          </div>
        </div>
      </div>

      {/* Update Name */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg kpi-icon-accent">
              <User className="size-4" />
            </div>
            <h3 className="text-base font-semibold">Display Name</h3>
          </div>
        </div>
        <div className="p-5">
          <form onSubmit={handleSaveName} className="flex items-end gap-3">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="profile-name">Full Name</Label>
              <Input id="profile-name" value={name} onChange={e => setName(e.target.value)} placeholder="Enter your name" />
            </div>
            <Button type="submit" disabled={savingName} className="btn-brand">
              {savingName ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
              Save
            </Button>
          </form>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="p-5 pb-0">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg kpi-icon-amber">
              <Lock className="size-4" />
            </div>
            <h3 className="text-base font-semibold">Change Password</h3>
          </div>
        </div>
        <div className="p-5">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Current Password</Label>
              <Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="Enter current password" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>New Password</Label>
                <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
              </div>
              <div className="space-y-1.5">
                <Label>Confirm Password</Label>
                <Input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter new password" />
              </div>
            </div>
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-500">Passwords do not match</p>
            )}
            <div className="flex justify-end">
              <Button type="submit" disabled={savingPassword} className="btn-brand">
                {savingPassword ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Lock className="size-4 mr-1.5" />}
                Change Password
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
