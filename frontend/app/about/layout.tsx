import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://stitch.org.in/about",
  },
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
