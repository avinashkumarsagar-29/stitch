import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stitch Blog — Sewing, Repair, and Styling Guides",
  description: "Learn sewing, repair, and styling basics with the Stitch Blog. Watch video tutorials and read practical guides to care for your favorite custom garments.",
  alternates: {
    canonical: "https://stitch.org.in/blog",
  },
  openGraph: {
    title: "Stitch Blog — Sewing, Repair, and Styling Guides",
    description: "Learn sewing, repair, and styling basics with the Stitch Blog. Watch video tutorials and read practical guides to care for your favorite custom garments.",
    url: "https://stitch.org.in/blog",
  },
};

export default function BlogLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
