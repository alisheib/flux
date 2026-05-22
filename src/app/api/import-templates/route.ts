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

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const templates = await prisma.importTemplate.findMany({
      where: { orgId: auth.orgId },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(templates);
  } catch (error) {
    console.error("GET /api/import-templates error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuth();
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { name, entityType, description, columnMappings, validationRules } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Template name is required" }, { status: 400 });
    }
    if (!entityType || !VALID_ENTITY_TYPES.includes(entityType)) {
      return NextResponse.json({ error: `Entity type must be one of: ${VALID_ENTITY_TYPES.join(", ")}` }, { status: 400 });
    }

    const template = await prisma.importTemplate.create({
      data: {
        orgId: auth.orgId,
        name: name.trim(),
        entityType,
        description: description?.trim() || null,
        columnMappings: columnMappings ? JSON.stringify(columnMappings) : null,
        validationRules: validationRules ? JSON.stringify(validationRules) : null,
      },
    });

    await logAudit({
      orgId: auth.orgId,
      userId: auth.userId,
      action: "create",
      entity: "import_template",
      entityId: template.id,
      details: `Created import template: ${template.name} (${entityType})`,
    });

    return NextResponse.json(template, { status: 201 });
  } catch (error) {
    console.error("POST /api/import-templates error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
