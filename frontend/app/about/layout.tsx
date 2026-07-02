import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About Us — Our Mission, Core Values & Skilled Tailors | Stitch",
  description: "Learn about Stitch, our mission to support local makers, and our core values. We connect customers with skilled local tailors for premium custom clothing.",
  alternates: {
    canonical: "https://stitch.org.in/about",
  },
  openGraph: {
    title: "About Us — Our Mission, Core Values & Skilled Tailors | Stitch",
    description: "Learn about Stitch, our mission to support local makers, and our core values. We connect customers with skilled local tailors for premium custom clothing.",
    url: "https://stitch.org.in/about",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
