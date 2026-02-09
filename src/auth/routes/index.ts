import { Elysia, t } from "elysia";
import { config } from "../../config";
import {
  validateWithTimbal,
  setAuthCookie,
  clearAuthCookie,
} from "../middleware";

const TIMBAL_AUTH_URL = "https://api.timbal.ai";
const LOGIN_PAGE_PATH = "./src/auth/pages/login.html";
const CALLBACK_PAGE_PATH = "./src/auth/pages/callback.html";
const LOGOS_DIR = "./src/auth/pages/logos";

/**
 * Get the origin from the request, respecting proxy headers
 * Only allows http for localhost/127.0.0.1, otherwise enforces https
 */
function getOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  const url = new URL(request.url);
  const protocol = forwardedProto || url.protocol.replace(":", "");
  const host = forwardedHost || url.host;

  // Extract hostname without port
  const hostname = host.split(":")[0];

  // Only allow http for localhost and 127.0.0.1
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const finalProtocol =
    protocol === "http" && !isLocalhost ? "https" : protocol;

  return `${finalProtocol}://${host}`;
}

/**
 * Auth routes
 */
export const authRoutes = new Elysia({ prefix: "/auth" })
  // Login page
  .get("/login", () => Bun.file(LOGIN_PAGE_PATH), { detail: { hide: true } })

  // Logos static files
  .get(
    "/logos/:filename",
    ({ params }) => {
      return Bun.file(`${LOGOS_DIR}/${params.filename}`);
    },
    { detail: { hide: true } },
  )

  // OAuth redirect to Timbal
  .get(
    "/:provider",
    ({ params, redirect, request }) => {
      const { provider } = params;
      const validProviders = ["github", "google", "microsoft"];
      if (!validProviders.includes(provider)) {
        return new Response("Invalid provider", { status: 400 });
      }
      const origin = getOrigin(request);
      const callbackUrl = `${origin}/auth/callback`;
      const url = `${TIMBAL_AUTH_URL}/oauth/authorize?provider=${provider}&redirect_uri=${encodeURIComponent(callbackUrl)}`;
      return redirect(url);
    },
    {
      params: t.Object({ provider: t.String() }),
      detail: { hide: true },
    },
  )

  // Callback page (extracts hash tokens via JS)
  .get("/callback", () => Bun.file(CALLBACK_PAGE_PATH), {
    detail: { hide: true },
  })

  // Set token (receives access token from callback JS, refresh token stays in localStorage)
  .post(
    "/set-token",
    async ({ body, cookie }) => {
      const { access_token } = body;

      const user = await validateWithTimbal(access_token);
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      setAuthCookie(cookie, access_token);
      return { success: true, user };
    },
    {
      body: t.Object({
        access_token: t.String(),
      }),
      detail: { hide: true },
    },
  )

  // Magic link request
  .post(
    "/magic-link",
    async ({ body, request }) => {
      const { email } = body;
      const origin = getOrigin(request);
      const callbackUrl = `${origin}/auth/callback`;

      const response = await fetch(`${TIMBAL_AUTH_URL}/auth/magic-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, redirect_uri: callbackUrl }),
      });

      if (!response.ok) {
        const error = await response.text();
        return new Response(
          JSON.stringify({ error: error || "Failed to send magic link" }),
          {
            status: response.status,
            headers: { "Content-Type": "application/json" },
          },
        );
      }

      return { success: true, message: "Check your email for the login link" };
    },
    {
      body: t.Object({ email: t.String() }),
      detail: { hide: true },
    },
  )

  // Refresh token (receives refresh_token from body - stored in client localStorage)
  .post(
    "/refresh",
    async ({ body, cookie }) => {
      const { refresh_token } = body;

      const response = await fetch(`${TIMBAL_AUTH_URL}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          refresh_token,
        }),
      });

      if (!response.ok) {
        clearAuthCookie(cookie);
        return new Response(JSON.stringify({ error: "Refresh failed" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const tokens = await response.json();
      setAuthCookie(cookie, tokens.access_token);

      // Return new refresh token if provided (client stores in localStorage)
      return {
        success: true,
        refresh_token: tokens.refresh_token || refresh_token,
      };
    },
    {
      body: t.Object({ refresh_token: t.String() }),
      detail: { hide: true },
    },
  )

  // Logout
  .post(
    "/logout",
    ({ cookie }) => {
      clearAuthCookie(cookie);
      return new Response(null, {
        status: 302,
        headers: { Location: "/auth/login" },
      });
    },
    { detail: { hide: true } },
  )

  // Get current user
  .get(
    "/me",
    async ({ cookie }) => {
      const token = cookie.timbal_access_token?.value as string | undefined;
      if (!token) {
        return new Response(JSON.stringify({ error: "Not authenticated" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      const user = await validateWithTimbal(token);
      if (!user) {
        clearAuthCookie(cookie);
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }

      return user;
    },
    { detail: { hide: true } },
  );
