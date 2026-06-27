import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Force the canonical, non-www host: 301 www.ariamindx.com -> ariamindx.com
  // so Google never splits ranking signal between the two.
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.ariamindx.com" }],
        destination: "https://ariamindx.com/:path*",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
