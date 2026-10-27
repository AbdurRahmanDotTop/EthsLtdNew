"use client";

import { useState, useEffect, useCallback } from "react";
import { getAuthSession } from "@/actions/auth";
import { useRouter, usePathname } from "next/navigation";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  const fetchSession = useCallback(async () => {
    try {
      const sessionUser = await getAuthSession();
      setUser(sessionUser);
      return sessionUser;
    } catch {
      setUser(null);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    getAuthSession()
      .then((sessionUser) => {
        if (mounted) {
          setUser(sessionUser);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [pathname]);

  const requireAuth = useCallback(
    (destination?: string) => {
      if (!user) {
        const dest = destination || (typeof window !== "undefined" ? window.location.pathname + window.location.search : pathname);
        router.push(`/login?redirect=${encodeURIComponent(dest)}`);
        return false;
      }
      return true;
    },
    [user, pathname, router]
  );

  return {
    user,
    isAuthenticated: Boolean(user),
    isLoading,
    requireAuth,
    refreshSession: fetchSession,
  };
}
