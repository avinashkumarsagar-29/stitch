import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Stitch Garment Collection — Hand Embroidery & Custom Fitting",
  description: "Explore our collection of custom tailoring and design services. From hand embroidery and fabric styling to custom fitting, see what we can craft for you.",
  alternates: {
    canonical: "https://stitch.org.in/collection",
  },
  openGraph: {
    title: "Stitch Garment Collection — Hand Embroidery & Custom Fitting",
    description: "Explore our collection of custom tailoring and design services. From hand embroidery and fabric styling to custom fitting, see what we can craft for you.",
    url: "https://stitch.org.in/collection",
  },
};

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
