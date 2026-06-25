import { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

let router: AppRouterInstance | null = null;

export function setRouter(r: AppRouterInstance) {
  router = r;
}

export function navigateTo(path: string) {
  if (router) {
    router.replace(path);
  } else {
    // fallback before router is mounted (e.g. during SSR)
    if (typeof window !== "undefined") window.location.replace(path);
  }
}
