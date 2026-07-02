import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Corporate & School Uniform Bulk Tailoring | Stitch Business",
  description: "Get premium corporate apparel and school uniforms tailored in bulk. Schedule consultations, get transparent quotes, and track orders in real-time.",
  alternates: {
    canonical: "https://stitch.org.in/business",
  },
  openGraph: {
    title: "Corporate & School Uniform Bulk Tailoring | Stitch Business",
    description: "Get premium corporate apparel and school uniforms tailored in bulk. Schedule consultations, get transparent quotes, and track orders in real-time.",
    url: "https://stitch.org.in/business",
  },
};

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
