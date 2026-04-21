import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { prisma } from "@/lib/db";

async function getAuth() {
  const cookieStore = await cookies();
  const token = cookieStore.get("flux-token")?.value;
  if (!token) return null;
  return verifyToken(token);
}

export async function GET() {
  try {
    const auth = await getAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const invoices = await prisma.invoice.findMany({
      where: { orgId: auth.orgId },
      include: {
        sale: {
          select: {
            id: true,
            saleNumber: true,
            user: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("GET /api/invoices error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
