import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep document-parsing libs out of the bundler — they rely on Node built-ins
  // and ship their own worker/asset files.
  serverExternalPackages: ["pdf-parse", "mammoth", "xlsx"],
};

export default nextConfig;
