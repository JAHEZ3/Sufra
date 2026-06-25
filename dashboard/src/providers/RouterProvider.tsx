"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setRouter } from "@/lib/navigation";

export function RouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    setRouter(router);
  }, [router]);

  return <>{children}</>;
}
