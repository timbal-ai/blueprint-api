import { Elysia, t } from "elysia";
import { timbal, setAuthCookie, clearAuthCookie } from "./middleware";

const LOGIN_PAGE_PATH = "./src/auth/pages/login.html";
const CALLBACK_PAGE_PATH = "./src/auth/pages/callback.html";
const LOGOS_DIR = "./src/auth/pages/logos";

function getOrigin(request: Request): string {
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const forwardedHost = request.headers.get("x-forwarded-host");

  const url = new URL(request.url);
  const protocol = forwardedProto || url.protocol.replace(":", "");
  const host = forwardedHost || url.host;

  const hostname = host.split(":")[0];
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const finalProtocol =
    protocol === "http" && !isLocalhost ? "https" : protocol;

  return `${finalProtocol}://${host}`;
}

function getCallbackUrl(request: Request, path: string): string {
  const origin = getOrigin(request);
  const prefix = path.startsWith("/api") ? "/api" : "";
  return `${origin}${prefix}/auth/callback`;
}

export const authRoutes = new Elysia({ prefix: "/auth" })
  .get(
    "/login",
    async ({ path }) => {
      const prefix = path.startsWith("/api") ? "/api" : "";
      const html = await Bun.file(LOGIN_PAGE_PATH).text();
      return new Response(html.replaceAll("{{PREFIX}}", prefix), {
        headers: { "Content-Type": "text/html" },
      });
    },
    { detail: { hide: true } },
  )

  .get(
    "/logos/:filename",
    ({ params }) => Bun.file(`${LOGOS_DIR}/${params.filename}`),
    { detail: { hide: true } },
  )

  .get(
    "/:provider",
    ({ params, redirect, request, path }) => {
      const { provider } = params;
      const validProviders = ["github", "google", "microsoft"] as const;
      if (!validProviders.includes(provider as any)) {
        return new Response("Invalid provider", { status: 400 });
      }
      const callbackUrl = getCallbackUrl(request, path);
      return redirect(timbal.getOAuthUrl(provider as any, callbackUrl));
    },
    {
      params: t.Object({ provider: t.String() }),
      detail: { hide: true },
    },
  )

  .get(
    "/callback",
    async ({ path }) => {
      const prefix = path.startsWith("/api") ? "/api" : "";
      const html = await Bun.file(CALLBACK_PAGE_PATH).text();
      return new Response(html.replaceAll("{{PREFIX}}", prefix), {
        headers: { "Content-Type": "text/html" },
      });
    },
    { detail: { hide: true } },
  )

  .post(
    "/set-token",
    async ({ body, cookie }) => {
      try {
        const session = await timbal.as(body.access_token).getSession();
        setAuthCookie(cookie, body.access_token);
        return { success: true, user: session };
      } catch {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
    {
      body: t.Object({ access_token: t.String() }),
      detail: { hide: true },
    },
  )

  .post(
    "/magic-link",
    async ({ body, request, path }) => {
      try {
        await timbal.sendMagicLink(body.email, getCallbackUrl(request, path));
        return { success: true, message: "Check your email for the login link" };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Failed to send magic link";
        return new Response(JSON.stringify({ error: message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
    {
      body: t.Object({ email: t.String() }),
      detail: { hide: true },
    },
  )

  .post(
    "/refresh",
    async ({ body, cookie }) => {
      try {
        const tokens = await timbal.refreshToken(body.refresh_token);
        setAuthCookie(cookie, tokens.access_token);
        return {
          success: true,
          refresh_token: tokens.refresh_token || body.refresh_token,
        };
      } catch {
        clearAuthCookie(cookie);
        return new Response(JSON.stringify({ error: "Refresh failed" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
    },
    {
      body: t.Object({ refresh_token: t.String() }),
      detail: { hide: true },
    },
  )

  .post(
    "/logout",
    ({ cookie, path }) => {
      clearAuthCookie(cookie);
      const prefix = path.startsWith("/api") ? "/api" : "";
      return new Response(null, {
        status: 302,
        headers: { Location: `${prefix}/auth/login` },
      });
    },
    { detail: { hide: true } },
  );
