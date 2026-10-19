import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["react-globe.gl", "three-globe", "globe.gl"],
};

export default nextConfig;
