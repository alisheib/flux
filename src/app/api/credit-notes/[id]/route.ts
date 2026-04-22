import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

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

    const creditNote = await prisma.creditNote.findFirst({
      where: { id, orgId: auth.orgId },
      include: {
        sale: {
          select: {
            id: true,
            saleNumber: true,
            customer: true,
            customerPhone: true,
            customerEmail: true,
            total: true,
            currency: true,
            status: true,
            createdAt: true,
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } },
              },
            },
          },
        },
      },
    });

    if (!creditNote) {
      return NextResponse.json({ error: "Credit note not found" }, { status: 404 });
    }

    return NextResponse.json(creditNote);
  } catch (error) {
    console.error("GET /api/credit-notes/[id] error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
