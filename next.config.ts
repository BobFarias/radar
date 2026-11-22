import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Lets phones on the local network load dev resources (testing via the LAN IP).
  allowedDevOrigins: ["192.168.0.2"],
};

export default nextConfig;
