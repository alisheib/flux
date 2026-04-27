"use client";

import React, { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { validateRequired, validateEmail, validatePassword } from "@/lib/validate";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Shield,
  ShieldAlert,
  UserCheck,
  UserX,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FormSelect } from "@/components/ui/form-select";

// ─── Types ─────────────────────────────────────────────────────────────

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  active: boolean;
  lastLogin: string | null;
  createdAt: string;
}

// ─── Role badge config ─────────────────────────────────────────────────

const ROLE_CONFIG: Record<string, { label: string; className: string; avatarBg: string }> = {
  admin: {
    label: "Admin",
    className:
      "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
    avatarBg: "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300",
  },
  manager: {
    label: "Manager",
    className:
      "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
    avatarBg: "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300",
  },
  accountant: {
    label: "Accountant",
    className:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
    avatarBg: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  salesman: {
    label: "Salesman",
    className:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    avatarBg: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
};

function RoleBadge({ role }: { role: string }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.salesman;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.className}`}
    >
      {config.label}
    </span>
  );
}

function UserAvatar({ name, role }: { name: string; role: string }) {
  const config = ROLE_CONFIG[role] || ROLE_CONFIG.salesman;
  const initial = name.charAt(0).toUpperCase();
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${config.avatarBg}`}
    >
      {initial}
    </div>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`h-2 w-2 rounded-full ${
          active ? "bg-green-500" : "bg-gray-400"
        }`}
      />
      <span className={`text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>
        {active ? "Active" : "Inactive"}
      </span>
    </div>
  );
}

const ROLES = ["admin", "manager", "accountant", "salesman"];

// ─── Main Page Component ───────────────────────────────────────────────

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const isAdmin = currentUser.role === "admin";

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [showAddUser, setShowAddUser] = useState(false);
  const [showEditUser, setShowEditUser] = useState(false);
  const [showDeleteUser, setShowDeleteUser] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRecord | null>(null);

  // ─── Fetch users ──────────────────────────────────────────────────

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      const data = await res.json();
      setUsers(data);
    } catch {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ─── Create user ─────────────────────────────────────────────────

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const body = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      password: form.get("password") as string,
      role: form.get("role") as string,
    };

    if (!validateRequired(body.name, "Name")) return;
    if (!validateEmail(body.email)) return;
    if (!validatePassword(body.password)) return;
    if (!validateRequired(body.role, "Role")) return;

    try {
      setSaving(true);
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error("Failed to create user", { description: data.error || "Please try again." });
        return;
      }
      toast.success("User created", { description: `${body.name} has been added as ${body.role}.` });
      setShowAddUser(false);
      fetchUsers();
    } catch {
      toast.error("Failed to create user", { description: "Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // ─── Update user ─────────────────────────────────────────────────

  const handleUpdateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    const form = new FormData(e.currentTarget);
    const password = form.get("password") as string;
    const body: Record<string, string> = {
      name: form.get("name") as string,
      email: form.get("email") as string,
      role: form.get("role") as string,
    };
    if (password) {
      body.password = password;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to update user");
      }
      toast.success("User updated successfully");
      setShowEditUser(false);
      setEditingUser(null);
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update user";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Toggle active ──────────────────────────────────────────────

  const handleToggleActive = async (targetUser: UserRecord) => {
    if (targetUser.id === currentUser.userId) {
      toast.error("You cannot deactivate yourself");
      return;
    }

    try {
      const res = await fetch(`/api/users/${targetUser.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !targetUser.active }),
      });
      if (!res.ok) throw new Error("Failed to update user");
      toast.success(
        targetUser.active ? "User deactivated" : "User activated"
      );
      fetchUsers();
    } catch {
      toast.error("Failed to update user status");
    }
  };

  // ─── Delete user ─────────────────────────────────────────────────

  const handleDeleteUser = async () => {
    if (!deletingUser) return;
    if (deletingUser.id === currentUser.userId) {
      toast.error("You cannot delete yourself");
      return;
    }

    try {
      setSaving(true);
      const res = await fetch(`/api/users/${deletingUser.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete user");
      }
      toast.success("User deleted successfully");
      setShowDeleteUser(false);
      setDeletingUser(null);
      fetchUsers();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete user";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  // ─── Not admin ──────────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Users"
          description="Manage team access and roles"
        />
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ShieldAlert className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              Admin Only
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground max-w-sm text-center">
              You need administrator privileges to manage users. Contact your admin for access.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Users"
        description="Manage team access and roles"
      >
        <Button
          className="bg-[#d97706] text-[#1a1813] hover:bg-[#c2410c]"
          onClick={() => setShowAddUser(true)}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Add User
        </Button>
      </PageHeader>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">Loading users...</p>
        </div>
      ) : users.length === 0 ? (
        <div className="bg-card border border-border rounded-xl shadow-sm">
          <div className="flex flex-col items-center justify-center py-16">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Users className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="mt-4 text-lg font-semibold text-foreground">
              No users found
            </h3>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Add your first team member to get started
            </p>
            <Button
              className="mt-5 bg-[#d97706] text-[#1a1813] hover:bg-[#c2410c]"
              onClick={() => setShowAddUser(true)}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add User
            </Button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-xs font-medium uppercase tracking-wide">User</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">Email</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">Role</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">Status</TableHead>
                  <TableHead className="text-xs font-medium uppercase tracking-wide">Last Login</TableHead>
                  <TableHead className="text-right text-xs font-medium uppercase tracking-wide">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => {
                  const isSelf = u.id === currentUser.userId;
                  return (
                    <TableRow key={u.id} className="hover:bg-muted/30 transition-colors">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={u.name} role={u.role} />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-foreground">{u.name}</span>
                              {isSelf && (
                                <Badge variant="secondary" className="rounded-full text-xs px-2 py-0">
                                  You
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {u.email}
                      </TableCell>
                      <TableCell>
                        <RoleBadge role={u.role} />
                      </TableCell>
                      <TableCell>
                        <StatusDot active={u.active} />
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {u.lastLogin
                          ? formatDistanceToNow(new Date(u.lastLogin), { addSuffix: true })
                          : "Never"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Edit"
                            onClick={() => {
                              setEditingUser(u);
                              setShowEditUser(true);
                            }}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title={u.active ? "Deactivate" : "Activate"}
                            onClick={() => handleToggleActive(u)}
                            disabled={isSelf}
                          >
                            {u.active ? (
                              <UserX className="text-amber-600 dark:text-amber-400" />
                            ) : (
                              <UserCheck className="text-green-600 dark:text-green-400" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            title="Delete"
                            onClick={() => {
                              setDeletingUser(u);
                              setShowDeleteUser(true);
                            }}
                            disabled={isSelf}
                          >
                            <Trash2 className="text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── Add User Dialog ──────────────────────────────────── */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>
              Create a new team member account
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="add-name">Full Name *</Label>
                <Input
                  id="add-name"
                  name="name"
                  placeholder="Enter full name"
                  className="mt-1.5"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="add-email">Email *</Label>
                <Input
                  id="add-email"
                  name="email"
                  type="email"
                  placeholder="name@company.com"
                  className="mt-1.5"
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="add-password">Password *</Label>
                <Input
                  id="add-password"
                  name="password"
                  type="password"
                  placeholder="Minimum 8 characters"
                  className="mt-1.5"
                  minLength={8}
                  required
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="add-role">Role *</Label>
                <FormSelect
                  id="add-role"
                  name="role"
                  defaultValue="salesman"
                  options={ROLES.map((r) => ({ value: r, label: ROLE_CONFIG[r]?.label || r }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddUser(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="bg-[#d97706] text-[#1a1813] hover:bg-[#c2410c]"
              >
                {saving && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit User Dialog ─────────────────────────────────── */}
      <Dialog
        open={showEditUser}
        onOpenChange={(open) => {
          setShowEditUser(open);
          if (!open) setEditingUser(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information. Leave password blank to keep unchanged.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label htmlFor="edit-name">Full Name *</Label>
                  <Input
                    id="edit-name"
                    name="name"
                    defaultValue={editingUser.name}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    name="email"
                    type="email"
                    defaultValue={editingUser.email}
                    className="mt-1.5"
                    required
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="edit-password">
                    Password{" "}
                    <span className="text-muted-foreground font-normal">
                      (leave blank to keep current)
                    </span>
                  </Label>
                  <Input
                    id="edit-password"
                    name="password"
                    type="password"
                    placeholder="Min. 8 characters"
                    className="mt-1.5"
                    minLength={8}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label htmlFor="edit-role">Role *</Label>
                  <FormSelect
                    id="edit-role"
                    name="role"
                    defaultValue={editingUser.role}
                    options={ROLES.map((r) => ({ value: r, label: ROLE_CONFIG[r]?.label || r }))}
                    className="mt-1.5"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditUser(false);
                    setEditingUser(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={saving}
                  className="bg-[#d97706] text-[#1a1813] hover:bg-[#c2410c]"
                >
                  {saving && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Delete User Dialog ───────────────────────────────── */}
      <Dialog
        open={showDeleteUser}
        onOpenChange={(open) => {
          setShowDeleteUser(open);
          if (!open) setDeletingUser(null);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{deletingUser?.name}&quot;
              ({deletingUser?.email})? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteUser(false);
                setDeletingUser(null);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteUser}
              disabled={saving}
            >
              {saving && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
