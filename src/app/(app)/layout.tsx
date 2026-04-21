import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  // Fetch org name for the session context
  const org = await prisma.organization.findUnique({
    where: { id: session.orgId },
    select: { name: true },
  });

  const user = {
    userId: session.userId,
    orgId: session.orgId,
    email: session.email,
    name: session.name,
    role: session.role,
    orgName: org?.name || "",
  };

  return <AppShell user={user}>{children}</AppShell>;
}
