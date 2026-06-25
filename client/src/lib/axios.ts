import axios, { AxiosInstance } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const MANAGER_URL =
  process.env.NEXT_PUBLIC_MANAGER_URL ?? "http://localhost:3006/api/manager";
const RESTAURANT_URL =
  process.env.NEXT_PUBLIC_RESTAURANT_URL ?? "http://localhost:3003";
// Customer-service routes resolve through the Next.js dev proxy (/api/customer/*).
// Keeping the base relative ("") means a phone hitting the client origin works
// without LAN-IP-per-service config.
const CUSTOMER_URL = process.env.NEXT_PUBLIC_CUSTOMER_URL ?? "";

const sharedHeaders = {
  "Content-Type": "application/json",
  "Accept-Language": "ar",
};

function attachToken(config: import("axios").InternalAxiosRequestConfig) {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("sufra_token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}

function normaliseError(error: import("axios").AxiosError) {
  const message =
    (error?.response?.data as { message?: string } | undefined)?.message ??
    "حدث خطأ، يرجى المحاولة مرة أخرى";
  return Promise.reject(new Error(message));
}

function makeClient(baseURL: string): AxiosInstance {
  const instance = axios.create({
    baseURL,
    headers: sharedHeaders,
    timeout: 10_000,
  });
  instance.interceptors.request.use(attachToken, (e) => Promise.reject(e));
  instance.interceptors.response.use((r) => r, normaliseError);
  return instance;
}

/** Default client — used by features hosted behind the main API/gateway. */
export const apiClient = makeClient(BASE_URL);

/** Manager-service client — contact form, public stats, settings-driven content. */
export const managerClient = makeClient(MANAGER_URL);

/** Restaurant-service client — public menu + QR table lookups for the scan flow. */
export const restaurantClient = makeClient(RESTAURANT_URL);

/** Customer-service client — profile + saved-addresses CRUD (requires JWT). */
export const customerClient = makeClient(CUSTOMER_URL);
