import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async redirects() {
    return [
      { source: "/option", destination: "/options", permanent: true },
      { source: "/trading", destination: "/trade", permanent: true },
      { source: "/trades", destination: "/trade", permanent: true },
      { source: "/asset", destination: "/assets", permanent: true },
      { source: "/wallet", destination: "/assets", permanent: true },
      { source: "/wallets", destination: "/assets", permanent: true },
    ];
  },
};

export default nextConfig;
