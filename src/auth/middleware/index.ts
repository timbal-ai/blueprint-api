import { Elysia } from "elysia";
import { config } from "../../config";
import type { AuthUser } from "../types";

/**
 * Validates token with Timbal API - checks both auth AND project access
 */
export async function validateWithTimbal(token: string): Promise<AuthUser | null> {
  const url = `${config.timbal.apiUrl}/orgs/${config.timbal.orgId}/projects/${config.timbal.projectId}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    return { id: "timbal-authenticated" };
  } catch {
    return null;
  }
}

/**
 * Sets auth cookie (access token only - refresh token goes to localStorage)
 */
export function setAuthCookie(
  cookie: Record<string, any>,
  accessToken: string
) {
  cookie.timbal_access_token.set({
    value: accessToken,
    httpOnly: true,
    secure: config.env === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  });
}

/**
 * Clears auth cookie
 */
export function clearAuthCookie(cookie: Record<string, any>) {
  cookie.timbal_access_token?.remove();
}

/**
 * Resolves authentication from cookie
 */
async function resolveAuth(
  cookie: Record<string, any>
): Promise<{ user: AuthUser | null; accessToken: string | null }> {
  const accessToken = cookie.timbal_access_token?.value as string | undefined;
  if (accessToken) {
    const user = await validateWithTimbal(accessToken);
    if (user) return { user, accessToken };
  }
  return { user: null, accessToken: null };
}

/**
 * Auth middleware
 */
export const authMiddleware = new Elysia({ name: "auth" })
  .derive({ as: "global" }, async ({ cookie }) => {
    return resolveAuth(cookie);
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
    const publicPaths = ["/auth/", "/healthcheck"];
    if (path === "/" || publicPaths.some((p) => path.startsWith(p))) return;

    if (!user) {
      if (path.startsWith("/docs")) {
        clearAuthCookie(cookie);
        return new Response(null, {
          status: 302,
          headers: { Location: "/auth/login" },
        });
      }
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
