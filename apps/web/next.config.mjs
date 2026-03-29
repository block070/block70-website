/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/wallets/smart", destination: "/smartwallets", permanent: false },
      { source: "/wallets/smart-money", destination: "/smartwallets", permanent: false },
      { source: "/wallets/top", destination: "/smartwallets", permanent: false },
    ];
  },
};

export default nextConfig;

