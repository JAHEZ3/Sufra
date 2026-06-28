import type { NextConfig } from "next";

// Server URLs the dev server proxies to. Override per environment via env vars.
const ORDER_PROXY      = process.env.ORDER_PROXY_URL      ?? "http://localhost:3001";
const RESTAURANT_PROXY = process.env.RESTAURANT_PROXY_URL ?? "http://localhost:3003";
const MANAGER_PROXY    = process.env.MANAGER_PROXY_URL    ?? "http://localhost:3006";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["10.30.0.*", "10.5.50.*"],
  // Same-origin proxy: the phone (or any device) hits the client's origin
  // and the dev server forwards `/api/*` to the right microservice on the
  // laptop. Avoids LAN-IP-per-service config and CORS.
  async rewrites() {
    return [
      { source: "/api/order/:path*",      destination: `${ORDER_PROXY}/api/order/:path*`      },
      { source: "/api/restaurant/:path*", destination: `${RESTAURANT_PROXY}/api/restaurant/:path*` },
      { source: "/api/manager/:path*",    destination: `${MANAGER_PROXY}/api/manager/:path*`  },
    ];
  },
};

export default nextConfig;
