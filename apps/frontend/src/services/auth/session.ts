import type { NavigateFunction } from "react-router-dom";
import { useUserContextStore } from "@/store/userContext.store";
import { clearAuthToken, fetchUserContext, getAuthToken, login, saveAuthToken, signup, toClientError } from "@/services/auth/auth.api";

export async function restoreContextFromToken(): Promise<"dashboard" | "onboarding" | "no_token"> {
  const token = getAuthToken();
  if (!token) {
    return "no_token";
  }

  try {
    const result = await fetchUserContext(token);

    if (result.context) {
      useUserContextStore.getState().setUserContext(result.context);
      return "dashboard";
    }

    return "onboarding";
  } catch (error) {
    clearAuthToken();
    throw toClientError(error, "Failed to restore user context");
  }
}

export async function loginAndRoute(email: string, password: string, navigate: NavigateFunction, initialName?: string): Promise<void> {
  try {
    const { token, user } = await login(email, password);
    saveAuthToken(token, user);

    const result = await fetchUserContext(token);

    if (result.context) {
      useUserContextStore.getState().setUserContext(result.context);
      navigate("/app/dashboard", { replace: true });
      return;
    }

    if (initialName && initialName.trim()) {
      const currentProfile = useUserContextStore.getState().userContext.profile;
      useUserContextStore.getState().setProfile({
        ...currentProfile,
        name: initialName.trim(),
      });
    }

    navigate("/app/onboarding", { replace: true });
  } catch (error) {
    throw toClientError(error, "Login failed");
  }
}

export async function signupAndRoute(email: string, password: string, navigate: NavigateFunction, name?: string): Promise<void> {
  try {
    await signup(email, password, name);
    await loginAndRoute(email, password, navigate, name);
  } catch (error) {
    throw toClientError(error, "Signup failed");
  }
}
