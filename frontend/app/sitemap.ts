import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = "https://stitch.org.in";

  const routes = [
    { url: "", changeFrequency: "daily" as const, priority: 1.0 },
    { url: "/about", changeFrequency: "weekly" as const, priority: 0.8 },
    { url: "/pricing", changeFrequency: "weekly" as const, priority: 0.8 },
    { url: "/careers", changeFrequency: "monthly" as const, priority: 0.5 },
    { url: "/blog", changeFrequency: "weekly" as const, priority: 0.7 },
    { url: "/collection", changeFrequency: "weekly" as const, priority: 0.8 },
    { url: "/business", changeFrequency: "weekly" as const, priority: 0.8 },
    { url: "/join", changeFrequency: "monthly" as const, priority: 0.6 },
    { url: "/login", changeFrequency: "monthly" as const, priority: 0.5 },
    { url: "/register", changeFrequency: "monthly" as const, priority: 0.5 },
  ];

  return routes.map((route) => ({
    url: `${baseUrl}${route.url}`,
    lastModified: new Date(),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
