import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Purchase Orders | FLUX",
  description: "Track orders from draft to delivery",
};

export default function PurchaseOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
