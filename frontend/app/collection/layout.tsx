import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://stitch.org.in/collection",
  },
};

export default function CollectionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
