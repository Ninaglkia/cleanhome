import type { NextConfig } from "next";

// When CAPACITOR_STATIC_EXPORT=true we produce a fully static bundle for
// Capacitor / Xcode packaging. For regular Vercel deployments (the default)
// we keep the normal server-rendering mode so API routes and Server Components
// continue to work.
const isCapacitorExport = process.env.CAPACITOR_STATIC_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(isCapacitorExport ? { output: "export" } : {}),
  images: {
    // Required when output: "export" (no Image Optimization server)
    unoptimized: isCapacitorExport,
  },
};

export default nextConfig;
