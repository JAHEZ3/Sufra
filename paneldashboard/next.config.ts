import type { NextConfig } from "next";

const AUTH_TARGET = process.env.API_AUTH_TARGET || "http://localhost:3004";
const RESTAURANT_TARGET = process.env.API_RESTAURANT_TARGET || "http://localhost:3003";
const DELIVERY_TARGET = process.env.API_DELIVERY_TARGET || "http://localhost:3002";
const MANAGER_TARGET = process.env.API_MANAGER_TARGET || "http://localhost:3006";
const NOTIFICATION_TARGET = process.env.API_NOTIFICATION_TARGET || "http://localhost:3007";
const ORDER_TARGET = process.env.API_ORDER_TARGET || "http://localhost:3001";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
  },
  async rewrites() {
    return [
      { source: "/api/auth/:path*", destination: `${AUTH_TARGET}/api/auth/:path*` },
      { source: "/api/restaurant/:path*", destination: `${RESTAURANT_TARGET}/api/restaurant/:path*` },
      { source: "/api/delivery/:path*", destination: `${DELIVERY_TARGET}/api/delivery/:path*` },
      { source: "/api/manager/:path*", destination: `${MANAGER_TARGET}/api/manager/:path*` },
      { source: "/api/notification/:path*", destination: `${NOTIFICATION_TARGET}/api/notification/:path*` },
      { source: "/api/order/:path*", destination: `${ORDER_TARGET}/api/order/:path*` },
    ];
  },
};

export default nextConfig;
