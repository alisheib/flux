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
    if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const jobs = await prisma.importJob.findMany({
      where: { orgId: auth.orgId },
      include: {
        template: { select: { id: true, name: true, entityType: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    // Stats
    const totalImports = jobs.length;
    const totalRowsImported = jobs.reduce((s, j) => s + j.validRows, 0);
    const completedJobs = jobs.filter(j => j.status === "completed" || j.status === "partial");
    const successRate = totalImports > 0
      ? Math.round((completedJobs.length / totalImports) * 1000) / 10
      : 0;
    const avgDuration = completedJobs.length > 0
      ? Math.round(completedJobs.reduce((s, j) => {
          if (j.startedAt && j.completedAt) {
            return s + (new Date(j.completedAt).getTime() - new Date(j.startedAt).getTime());
          }
          return s;
        }, 0) / completedJobs.length / 1000)
      : 0;

    return NextResponse.json({
      jobs,
      stats: { totalImports, totalRowsImported, successRate, avgDuration },
    });
  } catch (error) {
    console.error("GET /api/import-jobs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
