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

  // Fetch org metadata + settings server-side so the AppShell can hand a
  // fully-populated org context to every page. This eliminates the
  // brief "$" flicker that used to happen when each page client-fetched
  // /api/settings just to learn the currency.
  const [org, settings, dbUser] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: session.orgId },
      select: { name: true, currency: true, taxLabel: true },
    }),
    prisma.orgSettings.findUnique({
      where: { orgId: session.orgId },
      select: { exchangeRate: true },
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

  const orgCtx = {
    currency: org?.currency || "USD",
    taxLabel: org?.taxLabel || "VAT",
    exchangeRate: settings?.exchangeRate ?? 1,
  };

  return (
    <AppShell user={user} org={orgCtx}>
      <ErrorBoundary>{children}</ErrorBoundary>
    </AppShell>
  );
}
