import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  /** Self-hosting: emit a minimal server bundle for the Docker image. */
  output: "standalone",
  /** The app lives in apps/web but traces files from the whole workspace. */
  outputFileTracingRoot: path.join(__dirname, "../../"),
  /** The shared package ships TypeScript sources, so Next has to compile it. */
  transpilePackages: ["@snagflow/shared"],
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
