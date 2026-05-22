import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

const VALID_ENTITY_TYPES = ["inventory", "expenses", "employees", "transactions"];

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const template = await prisma.importTemplate.findFirst({
      where: { id, orgId: auth.orgId },
      include: { _count: { select: { jobs: true } } },
    });

    if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    return NextResponse.json(template);
  } catch (error) {
    console.error("GET /api/import-templates/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.importTemplate.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const body = await request.json();
    const { name, entityType, description, columnMappings, validationRules } = body;

    if (name !== undefined && !name.trim()) {
      return NextResponse.json({ error: "Template name cannot be empty" }, { status: 400 });
    }
    if (entityType !== undefined && !VALID_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json({ error: `Entity type must be one of: ${VALID_ENTITY_TYPES.join(", ")}` }, { status: 400 });
    }

    const template = await prisma.importTemplate.update({
      where: { id, orgId: auth.orgId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(entityType !== undefined && { entityType }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(columnMappings !== undefined && { columnMappings: columnMappings ? JSON.stringify(columnMappings) : null }),
        ...(validationRules !== undefined && { validationRules: validationRules ? JSON.stringify(validationRules) : null }),
      },
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "update",
      entity: "import_template",
      entityId: template.id,
      details: `Updated import template: ${template.name}`,
    });

    return NextResponse.json(template);
  } catch (error) {
    console.error("PUT /api/import-templates/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;

    const existing = await prisma.importTemplate.findFirst({
      where: { id, orgId: auth.orgId },
    });
    if (!existing) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    await prisma.importTemplate.delete({ where: { id, orgId: auth.orgId } });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "delete",
      entity: "import_template",
      entityId: id,
      details: `Deleted import template: ${existing.name}`,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/import-templates/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
