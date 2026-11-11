import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: let phones and other machines on the home network open `pnpm dev` by the Mac's LAN address.
  // Without this Next blocks its dev scripts for those origins and buttons do nothing (no hydration).
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
  cacheComponents: true,
  partialPrefetching: true,
  // @calci/shared is published as TypeScript source inside the monorepo.
  transpilePackages: ["@calci/shared"],
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
