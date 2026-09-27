import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // node:sqlite est un module natif de Node 24, il ne doit pas être empaqueté par le bundler.
  serverExternalPackages: ["node:sqlite"],
};

export default nextConfig;
