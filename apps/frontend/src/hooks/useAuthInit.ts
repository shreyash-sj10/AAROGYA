import { useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth.store";
import { useUserContextStore } from "@/store/userContext.store";
import { fetchUserContext, getAuthToken } from "@/services/auth/auth.api";

export type AuthInitStatus = "unauthenticated" | "authenticated_no_context" | "authenticated_with_context";

export function useAuthInit() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const setAuth = useAuthStore((s) => s.setAuth);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<AuthInitStatus>("unauthenticated");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const activeToken = token ?? getAuthToken();
      if (!activeToken) {
        if (!cancelled) {
          setStatus("unauthenticated");
          setLoading(false);
        }
        return;
      }

      try {
        const result = await fetchUserContext(activeToken);
        if (cancelled) {
          return;
        }

        setAuth({ token: activeToken, user: user ?? null });

        if (result.context) {
          useUserContextStore.getState().setUserContext(result.context);
          setStatus("authenticated_with_context");
        } else {
          useUserContextStore.getState().resetUserContext();
          setStatus("authenticated_no_context");
        }

        setError(null);
            } catch (err) {
        if (cancelled) {
          return;
        }

        console.warn("User context fetch failed, preserving previous state");
        setError(err instanceof Error ? err.message : "Authentication initialization failed");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setAuth, token, user]);

  return { loading, status, error };
}



