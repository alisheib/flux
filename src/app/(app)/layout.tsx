import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { ErrorBoundary } from "@/components/error-boundary";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Fetch org name and email verification status
  const [org, dbUser] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.orgId },
      select: { name: true },
    }),
    prisma.user.findUnique({
      where: { id: session.userId },
      select: { emailVerified: true },
    }),
  ]);

  const user = {
    userId: session.userId,
    orgId: session.orgId,
    email: session.email,
    name: session.name,
    role: session.role,
    orgName: org?.name || "",
    emailVerified: dbUser?.emailVerified ?? false,
  };

  return (
    <AppShell user={user}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}
