import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tailoring & Alteration Pricing Plans — Stitch",
  description: "Explore Stitch pricing plans for custom tailoring, alterations, and bespoke design. Find the perfect fit for your budget with free pickup & drop-off.",
  alternates: {
    canonical: "https://stitch.org.in/pricing",
  },
  openGraph: {
    title: "Tailoring & Alteration Pricing Plans — Stitch",
    description: "Explore Stitch pricing plans for custom tailoring, alterations, and bespoke design. Find the perfect fit for your budget with free pickup & drop-off.",
    url: "https://stitch.org.in/pricing",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
