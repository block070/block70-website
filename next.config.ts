import type { NextConfig } from "next";

// Rewrite /api/* to the backend. Required for SSR fetch and client requests.
// - Docker: API_SERVER_URL=http://api:8000
// - Production (e.g. block70.com): API_SERVER_URL or NEXT_PUBLIC_API_BASE_URL
//   must point to the real API (e.g. https://api.block70.com)
const apiTarget =
  process.env.API_SERVER_URL ||
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  "http://localhost:8000";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
