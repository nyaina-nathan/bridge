import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * The SDK recognises its own SSE wrapper by checking `constructor.name`,
   * which is mangled in a minified server build (so `callModel().getText()`
   * fails with "Unexpected response type from API" in production only).
   * Requiring it from node_modules keeps the class names intact.
   */
  serverExternalPackages: ["@openrouter/sdk"],
  experimental: {
    agentFeedback: false,
  },
  cacheComponents: true,
  partialPrefetching: true,
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
