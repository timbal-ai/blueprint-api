import { Elysia } from "elysia";
import Timbal from "@timbal-ai/timbal-sdk";

export const timbal = new Timbal();

export function setAuthCookie(
  cookie: Record<string, any>,
  token: string,
) {
  cookie.timbal_access_token.set({
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60,
    path: "/",
  });
}

export function clearAuthCookie(cookie: Record<string, any>) {
  cookie.timbal_access_token?.remove();
}

const isLocalDev = !process.env.TIMBAL_PROJECT_ID;

async function resolveToken(
  cookie: Record<string, any>,
  request: Request,
): Promise<string | null> {
  if (isLocalDev) return null;

  const { method } = request;
  const path = new URL(request.url).pathname;

  // Bearer header takes priority
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      await timbal.as(token).getProject();
      return token;
    } catch (err) {
      console.warn(`[auth] ${method} ${path} — bearer token rejected:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  // Fall back to cookie
  const token = cookie.timbal_access_token?.value as string | undefined;
  if (token) {
    try {
      await timbal.as(token).getProject();
      return token;
    } catch (err) {
      console.warn(`[auth] ${method} ${path} — cookie token rejected:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  console.warn(`[auth] ${method} ${path} — no token found`);
  return null;
}

export const authMiddleware = new Elysia({ name: "auth" })
  .derive({ as: "global" }, async ({ cookie, request }) => {
    const token = await resolveToken(cookie, request);
    const scopedTimbal = token ? timbal.as(token) : timbal;
    return { token, timbal: scopedTimbal };
  })
  .onBeforeHandle({ as: "global" }, ({ path, token, cookie, set }) => {
    if (isLocalDev) return;

    const normalizedPath = path.startsWith("/api/")
      ? path.slice(4)
      : path === "/api"
        ? "/"
        : path;
    const publicPaths = ["/auth/", "/healthcheck"];
    if (
      normalizedPath === "/" ||
      publicPaths.some((p) => normalizedPath.startsWith(p))
    )
      return;

    if (!token) {
      if (normalizedPath.startsWith("/docs")) {
        clearAuthCookie(cookie);
        const prefix = path.startsWith("/api") ? "/api" : "";
        set.status = 302;
        set.headers = { Location: `${prefix}/auth/login` };
        return;
      }
      set.status = 401;
      return { error: "Unauthorized" };
    }
  });
