import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stateless Railway container: no local filesystem writes at runtime.
  output: "standalone",
  serverExternalPackages: ["easymidi", "midi", "osc", "ws"],
};

export default nextConfig;
