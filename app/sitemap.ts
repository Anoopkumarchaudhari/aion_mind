import type { MetadataRoute } from "next";

const SITE_URL = "https://ariamindx.com";

// Public, indexable routes. Add new marketing/public pages here as they ship.
const routes = [
  "",
  "/about",
  "/contact",
  "/pricing",
  "/privacy-policy",
  "/terms",
  "/refund-policy",
  "/shipping-policy"
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency: "weekly",
    priority: path === "" ? 1 : 0.7
  }));
}
