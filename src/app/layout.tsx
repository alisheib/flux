import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: {
    default: "FLUX — Business Management Platform",
    template: "%s | FLUX",
  },
  description:
    "All-in-one business management for import & distribution. POS, inventory, shipment costing, invoicing, accounts receivable, accounting & reports. Built for Africa.",
  keywords: [
    "business management",
    "POS",
    "point of sale",
    "inventory management",
    "invoicing",
    "accounting",
    "Tanzania",
    "Africa",
    "import management",
    "distribution",
    "shipment costing",
    "accounts receivable",
    "ERP",
    "SaaS",
    "fluxtz",
  ],
  authors: [{ name: "Ali Sheib" }],
  creator: "Ali Sheib",
  publisher: "Flux Systems",
  metadataBase: new URL("https://fluxtz.com"),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://fluxtz.com",
    siteName: "FLUX",
    title: "FLUX — Business Management Platform",
    description:
      "All-in-one business management for import & distribution. POS, inventory, shipment costing, invoicing, accounts receivable, accounting & reports. Built for Africa.",
  },
  twitter: {
    card: "summary_large_image",
    title: "FLUX — Business Management Platform",
    description:
      "All-in-one business management for import & distribution. POS, inventory, invoicing, accounting. Built for Africa.",
    creator: "@alisheib",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: "FLUX",
              url: "https://fluxtz.com",
              description:
                "All-in-one business management platform for import & distribution businesses. POS, inventory, shipment costing, invoicing, accounts receivable, and accounting.",
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                description: "Free plan available",
              },
              author: {
                "@type": "Person",
                name: "Ali Sheib",
              },
              publisher: {
                "@type": "Organization",
                name: "Flux Systems",
                url: "https://fluxtz.com",
              },
            }),
          }}
        />
      </head>
      <body className={`${inter.variable} h-full antialiased font-sans`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster
            position="top-right"
            richColors
            toastOptions={{
              style: {
                borderRadius: "10px",
                fontSize: "14px",
                borderLeft: "3px solid var(--ring)",
              },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
