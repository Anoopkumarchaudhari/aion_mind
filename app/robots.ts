import type { MetadataRoute } from "next";

const SITE_URL = "https://ariamindx.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/app areas out of the index; let public pages rank.
      disallow: [
        "/dashboard",
        "/settings",
        "/billing",
        "/aria-admin-vault",
        "/login",
        "/signup"
      ]
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL
  };
}
