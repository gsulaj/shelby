import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export for Cloudflare Pages: `npm run build` writes the whole site to out/.
  output: "export",
  // No image optimization server on a static host; next/image serves the files as they are.
  images: { unoptimized: true },
  devIndicators: false,
  turbopack: {
    // A stray package-lock.json in the home directory otherwise becomes the workspace root.
    root: import.meta.dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
