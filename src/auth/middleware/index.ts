import { Elysia } from "elysia";
import { supabase } from "../../lib/supabase";
import { config } from "../../config";
import type { AuthUser } from "../types";


export async function validateWithTimbal(token: string): Promise<AuthUser | null> {
  const url = `${config.timbal.apiUrl}/orgs/${config.timbal.orgId}/projects/${config.timbal.projectId}`;
  
  // Detect token type and set appropriate header
  const isApiKey = token.startsWith("t2_");
  const headers: Record<string, string> = isApiKey
    ? { Authorization: `Bearer ${token}` }
    : { "x-auth-token": token };

  try {
    const response = await fetch(url, { method: "GET", headers });
    if (!response.ok) return null;
    return { id: "timbal-authenticated" };
  } catch {
    return null;
  }
}

/**
 * Refreshes Supabase session and validates with Timbal
 */
async function refreshAndValidate(refreshToken: string): Promise<{
  user: AuthUser | null;
  session: { access_token: string; refresh_token: string } | null;
}> {
  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: refreshToken,
  });
  
  if (error || !data.session) {
    return { user: null, session: null };
  }

  const user = await validateWithTimbal(data.session.access_token);
  if (!user) {
    return { user: null, session: null };
  }

  return {
    user,
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    },
  };
}

/**
 * Sets auth cookies with consistent configuration
 */
export function setAuthCookies(
  cookie: Record<string, any>,
  accessToken: string,
  refreshToken: string
) {
  cookie.docs_session.set({
    value: accessToken,
    httpOnly: false,
    secure: config.env === "production",
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });
  cookie.docs_refresh.set({
    value: refreshToken,
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

/**
 * Resolves authentication from various sources
 * 
 * Explicit auth (headers) acts as a switch - no fallback to cookies:
 * - x-api-key: use API key only
 * - Authorization: Bearer: use bearer token only
 * 
 * If no explicit header, fall back to cookies
 */
async function resolveAuth(
  headers: Record<string, string | null>,
  cookie: Record<string, any>
): Promise<{ user: AuthUser | null; accessToken: string | null }> {
  // 1. API Key header (exclusive - no fallback)
  const apiKey = headers["x-api-key"];
  if (apiKey) {
    const user = await validateWithTimbal(apiKey);
    return { user, accessToken: null };
  }

  // 2. Bearer Token (exclusive - no fallback)
  const authHeader = headers["authorization"];
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const user = await validateWithTimbal(token);
    return { user, accessToken: token };
  }

  // 3. No explicit header - try cookies
  const accessToken = cookie.docs_session?.value as string | undefined;
  if (accessToken) {
    const user = await validateWithTimbal(accessToken);
    if (user) return { user, accessToken };
  }

  // 4. Try refresh token
  const refreshToken = cookie.docs_refresh?.value as string | undefined;
  if (refreshToken) {
    const { user, session } = await refreshAndValidate(refreshToken);
    if (user && session) {
      setAuthCookies(cookie, session.access_token, session.refresh_token);
      return { user, accessToken: session.access_token };
    }
  }

  return { user: null, accessToken: null };
}

/**
 * Auth middleware - delegates validation to Timbal API
 * 
 * Flow: Token → Timbal API (validates auth + authz)
 * - Public routes: /docs/login, /docs/auth/*, /health, /api-spec
 * - Protected routes: everything else (redirects or 401)
 */
export const authMiddleware = new Elysia({ name: "auth" })
  .derive({ as: "global" }, async ({ headers, cookie }) => {
    return resolveAuth(headers as Record<string, string | null>, cookie);
  })
  .macro({
    auth: {
      async resolve({ user, status }) {
        if (!user) return status(401);
        return { user };
      },
    },
  })
  .onBeforeHandle({ as: "global" }, ({ path, user, cookie }) => {
    const publicPaths = ["/docs/login", "/docs/auth/", "/health", "/api-spec"];
    if (path === "/" || publicPaths.some((p) => path.startsWith(p))) return;

    if (!user) {
      if (path.startsWith("/docs")) {
        cookie.docs_session?.remove();
        cookie.docs_refresh?.remove();
        return new Response(null, {
          status: 302,
          headers: { Location: "/docs/login" },
        });
      }
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
