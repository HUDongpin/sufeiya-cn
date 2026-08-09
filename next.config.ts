import type { NextConfig } from "next";

const cleanRoutes = [
  "learning-path",
  "platform",
  "resources",
  "about",
  "workspace",
  "diagnostic",
  "plan",
  "recommendations",
  "today",
  "practice",
  "practice-reading",
  "practice-listening",
  "practice-writing",
  "practice-speaking",
  "focus",
  "check-in",
  "review",
  "community",
  "retest",
  "my-data",
];

const nextConfig: NextConfig = {
  trailingSlash: false,
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.sufeiya.cn" }],
        destination: "https://sufeiya.cn/:path*",
        permanent: true,
      },
      {
        source: "/index.html",
        destination: "/",
        permanent: true,
      },
      ...cleanRoutes.map((route) => ({
        source: `/${route}.html`,
        destination: `/${route}`,
        permanent: true,
      })),
    ];
  },
};

export default nextConfig;
