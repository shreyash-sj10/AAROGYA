import { z } from "zod";
import { userContextSchema } from "@/validators/userContext.validator";
import type { UserContextSnapshot } from "@/validators/userContext.validator";
import { useAuthStore } from "@/store/auth.store";
import { apiClient } from "@/services/api/apiClient";

type AuthUser = {
  id: string;
  email: string;
};

type LoginResponse = {
  token: string;
  user: AuthUser;
};

type SignupResponse = {
  user: AuthUser;
};

type UserContextResponse = {
  context: UserContextSnapshot | null;
};

const AUTH_TOKEN_KEY = "aarogya_auth_token";
const AUTH_USER_ID_KEY = "aarogya_user_id";

const authUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
}).strict();

const loginSuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    token: z.string().min(1),
    user: authUserSchema,
  }).strict(),
  error: z.null(),
}).strict();

const signupSuccessEnvelopeSchema = z.object({
  success: z.literal(true),
  data: z.object({
    user: authUserSchema,
  }).strict(),
  error: z.null(),
}).strict();

const authFailureEnvelopeSchema = z.object({
  success: z.literal(false),
  data: z.null(),
  error: z.object({
    message: z.string().min(1),
  }).strict(),
}).strict();

const loginEnvelopeSchema = z.union([loginSuccessEnvelopeSchema, authFailureEnvelopeSchema]);
const signupEnvelopeSchema = z.union([signupSuccessEnvelopeSchema, authFailureEnvelopeSchema]);

const userContextResponseSchema = z.object({
  context: userContextSchema.nullable(),
}).strict();

const userContextErrorSchema = z.object({
  error: z.string().min(1),
}).strict();

const persistUserContextSuccessSchema = z.object({
  success: z.literal(true),
}).strict();

function toErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

export function saveAuthToken(token: string, user: AuthUser | null = null) {
  const safeToken = typeof token === "string" ? token.trim() : "";
  if (!safeToken) {
    throw new Error("Authentication token missing in login response");
  }

  if (user?.id) {
    try {
      localStorage.setItem(AUTH_USER_ID_KEY, user.id);
    } catch {
      // Ignore localStorage failures and continue with in-memory auth state.
    }
  }

  useAuthStore.getState().setAuth({ token: safeToken, user });
}

export function getAuthToken(): string | null {
  const token = useAuthStore.getState().token;
  if (token && token.trim().length > 0) {
    return token;
  }

  try {
    const local = localStorage.getItem(AUTH_TOKEN_KEY);
    return local && local.trim().length > 0 ? local : null;
  } catch {
    return null;
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(AUTH_USER_ID_KEY);
  } catch {
    // Ignore localStorage failures and continue logout.
  }

  useAuthStore.getState().logout();
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await apiClient<z.infer<typeof loginEnvelopeSchema>>({
    method: "POST",
    path: "/auth/login",
    body: { email, password },
    responseSchema: loginEnvelopeSchema,
    non2xxResponseSchemas: {
      400: loginEnvelopeSchema,
      401: loginEnvelopeSchema,
      409: loginEnvelopeSchema,
      500: loginEnvelopeSchema,
    },
  });

  const payload = response.data;
  if (!payload) {
    throw new Error("Invalid login response");
  }

  if (response.meta && response.meta.status >= 400) {
    if (payload.success === false) {
      throw new Error(payload.error.message);
    }
    throw new Error("Login failed");
  }

  if (payload.success !== true) {
    throw new Error("Unable to process request. Please try a more specific question.");
  }

  return {
    token: payload.data.token,
    user: payload.data.user,
  };
}

export async function signup(email: string, password: string, name?: string): Promise<SignupResponse> {
  const response = await apiClient<z.infer<typeof signupEnvelopeSchema>>({
    method: "POST",
    path: "/auth/signup",
    body: { email, password, ...(name ? { name } : {}) },
    responseSchema: signupEnvelopeSchema,
    non2xxResponseSchemas: {
      400: signupEnvelopeSchema,
      401: signupEnvelopeSchema,
      409: signupEnvelopeSchema,
      500: signupEnvelopeSchema,
    },
  });

  const payload = response.data;
  if (!payload) {
    throw new Error("Invalid signup response");
  }

  if (response.meta && response.meta.status >= 400) {
    if (payload.success === false) {
      throw new Error(payload.error.message);
    }
    throw new Error("Signup failed");
  }

  if (payload.success !== true) {
    throw new Error("Unable to process request. Please try a more specific question.");
  }

  return {
    user: payload.data.user,
  };
}

export async function fetchUserContext(token?: string): Promise<UserContextResponse> {
  const activeToken = (typeof token === "string" && token.trim().length > 0) ? token.trim() : getAuthToken();
  if (!activeToken) {
    throw new Error("Authentication required. Please log in again.");
  }

  const response = await apiClient<z.infer<typeof userContextResponseSchema> | z.infer<typeof userContextErrorSchema>>({
    method: "GET",
    path: "/user/context",
    responseSchema: userContextResponseSchema,
    non2xxResponseSchemas: {
      400: userContextErrorSchema,
      401: userContextErrorSchema,
      500: userContextErrorSchema,
    },
    headers: {
      Authorization: `Bearer ${activeToken}`,
    },
    requireAuth: true,
  });

  if (response.meta && response.meta.status >= 400) {
    const payload = response.data;
    if (payload && "error" in payload && typeof payload.error === "string") {
      throw new Error(payload.error);
    }
    throw new Error("Failed to fetch user context");
  }

  const payload = response.data;
  if (!payload || !("context" in payload)) {
    throw new Error("Invalid user context response");
  }

  return { context: payload.context };
}

export async function persistUserContext(token: string, context: UserContextSnapshot): Promise<void> {
  const activeToken = (typeof token === "string" && token.trim().length > 0) ? token.trim() : getAuthToken();
  if (!activeToken) {
    throw new Error("Authentication required. Please log in again.");
  }

  const response = await apiClient<z.infer<typeof persistUserContextSuccessSchema> | z.infer<typeof userContextErrorSchema>>({
    method: "POST",
    path: "/user/context",
    body: context,
    responseSchema: persistUserContextSuccessSchema,
    non2xxResponseSchemas: {
      400: userContextErrorSchema,
      401: userContextErrorSchema,
      500: userContextErrorSchema,
    },
    headers: {
      Authorization: `Bearer ${activeToken}`,
    },
    requireAuth: true,
  });

  if (response.meta && response.meta.status >= 400) {
    const payload = response.data;
    if (payload && "error" in payload && typeof payload.error === "string") {
      throw new Error(payload.error);
    }
    throw new Error("Failed to persist user context");
  }

  const payload = response.data;
  if (!payload || !("success" in payload) || payload.success !== true) {
    throw new Error("Failed to persist user context");
  }
}

export function toClientError(error: unknown, fallback: string): Error {
  return new Error(toErrorMessage(error, fallback));
}
