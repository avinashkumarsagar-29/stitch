import type { Metadata } from "next";

export const metadata: Metadata = {
  alternates: {
    canonical: "https://stitch.org.in/join",
  },
};

export default function JoinLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
