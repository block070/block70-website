import type { NextConfig } from "next";

// Use API_SERVER_URL at build for Docker (web->api); fallback for local dev
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
