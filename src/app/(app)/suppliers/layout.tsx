import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Suppliers | FLUX",
  description: "Manage vendors, purchase history and balances",
};

export default function SuppliersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
