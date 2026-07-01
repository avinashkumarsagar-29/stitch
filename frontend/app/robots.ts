import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/admin/*",
        "/dashboard",
        "/profile",
        "/booking/*",
        "/payment",
        "/notifications",
        "/track",
        "/User/*",
        "/trailor/*",
      ],
    },
    sitemap: "https://stitch.org.in/sitemap.xml",
  };
}
