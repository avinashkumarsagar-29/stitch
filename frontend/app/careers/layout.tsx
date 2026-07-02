import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Careers at Stitch — Join Our Custom Tailoring Team",
  description: "Join the Stitch team and help build the future of custom tailoring. Explore flexible and full-time open roles for Stylist Partners, Tailoring Specialists, and more.",
  alternates: {
    canonical: "https://stitch.org.in/careers",
  },
  openGraph: {
    title: "Careers at Stitch — Join Our Custom Tailoring Team",
    description: "Join the Stitch team and help build the future of custom tailoring. Explore flexible and full-time open roles for Stylist Partners, Tailoring Specialists, and more.",
    url: "https://stitch.org.in/careers",
  },
};

export default function CareersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
