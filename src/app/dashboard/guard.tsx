"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

/**
 * Client-side auth gate. The shell (this component's children) is a static file
 * served instantly from the CDN — so we render it immediately and only *redirect*
 * if the visitor turns out to be signed out. No business data lives in the shell;
 * every /api/* route still enforces the session server-side and returns 401
 * (which api.ts turns into a bounce to "/"), so nothing sensitive is exposed.
 */
export function DashboardGuard({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/");
  }, [status, router]);

  return <>{children}</>;
}
