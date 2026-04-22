import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken, hashPassword, hasMinRole } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Users can view their own profile; admins can view anyone in their org
    if (id !== auth.userId && !hasMinRole(auth.role, "admin")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const user = await prisma.user.findFirst({
      where: { id, orgId: auth.orgId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        active: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { sales: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (error) {
    console.error("GET /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Users can update their own profile; admins can update anyone in their org
    if (id !== auth.userId && !hasMinRole(auth.role, "admin")) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const existing = await prisma.user.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const body = await request.json();
    const { email, password, name, role, avatar, active } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (avatar !== undefined) updateData.avatar = avatar;

    // Only admin can change role and active status
    if (hasMinRole(auth.role, "admin")) {
      if (role !== undefined) updateData.role = role;
      if (active !== undefined) updateData.active = active;
    }

    if (email !== undefined) {
      const emailLower = email.toLowerCase().trim();
      if (emailLower !== existing.email) {
        const dup = await prisma.user.findUnique({ where: { email: emailLower } });
        if (dup) {
          return NextResponse.json(
            { error: "A user with this email already exists" },
            { status: 400 }
          );
        }
        updateData.email = emailLower;
      }
    }

    if (password) {
      updateData.password = await hashPassword(password);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        avatar: true,
        active: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "update", entity: "user", entityId: user.id, details: `Updated user: ${user.email}` });

    return NextResponse.json(user);
  } catch (error) {
    console.error("PUT /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!hasMinRole(auth.role, "admin")) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }

    const { id } = await params;

    // Cannot delete yourself
    if (id === auth.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    await prisma.user.delete({ where: { id } });

    await logAudit({ orgId: auth.orgId, userId: auth.userId, action: "delete", entity: "user", entityId: id, details: `Deleted user: ${existing.email}` });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/users/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
