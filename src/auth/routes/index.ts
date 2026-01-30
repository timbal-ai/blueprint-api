import { Elysia, t } from "elysia";
import { supabase } from "../../lib/supabase";
import { config } from "../../config";
import { validateWithTimbal, setAuthCookies } from "../middleware";

const LOGIN_PAGE_PATH = "./src/auth/pages/login.html";

/**
 * Auth routes for docs login
 * Flow: Supabase auth → Timbal validation → Set cookies
 */
export const authRoutes = new Elysia({ prefix: "/docs" })
  .get("/login", () => Bun.file(LOGIN_PAGE_PATH), { detail: { hide: true } })

  // Handle token from URL fragment (implicit OAuth flow)
  .post(
    "/auth/token",
    async ({ body, cookie }) => {
      const { access_token, refresh_token } = body;

      const user = await validateWithTimbal(access_token);
      if (!user) {
        return new Response("Access denied", { status: 403 });
      }

      setAuthCookies(cookie, access_token, refresh_token);
      return { success: true };
    },
    {
      body: t.Object({
        access_token: t.String(),
        refresh_token: t.String(),
      }),
      detail: { hide: true },
    }
  )

  // Google OAuth
  .get("/auth/google", async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${config.baseUrl}/docs/auth/callback`,
      },
    });

    if (error || !data.url) {
      return new Response("Failed to initiate Google login", { status: 500 });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: data.url },
    });
  }, { detail: { hide: true } })

  // Microsoft OAuth
  .get("/auth/microsoft", async () => {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: {
        redirectTo: `${config.baseUrl}/docs/auth/callback`,
        scopes: "email profile openid",
      },
    });

    if (error || !data.url) {
      return new Response("Failed to initiate Microsoft login", { status: 500 });
    }

    return new Response(null, {
      status: 302,
      headers: { Location: data.url },
    });
  }, { detail: { hide: true } })

  // OAuth callback (PKCE code flow or implicit fragment flow)
  .get("/auth/callback", async ({ query, cookie }) => {
    const code = query.code;

    // No code = implicit flow, let login.html handle fragment
    if (!code) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/docs/login" },
      });
    }

    // PKCE: exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/docs/login?error=auth_failed" },
      });
    }

    // Validate with Timbal
    const user = await validateWithTimbal(data.session.access_token);
    if (!user) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/docs/login?error=no_access" },
      });
    }

    setAuthCookies(cookie, data.session.access_token, data.session.refresh_token);
    return new Response(null, {
      status: 302,
      headers: { Location: "/docs" },
    });
  }, { detail: { hide: true } })

  // Email/Password login
  .post(
    "/login",
    async ({ body, cookie }) => {
      const { email, password } = body;

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session) {
        return new Response(null, {
          status: 302,
          headers: { Location: "/docs/login?error=invalid_credentials" },
        });
      }

      const user = await validateWithTimbal(data.session.access_token);
      if (!user) {
        return new Response(null, {
          status: 302,
          headers: { Location: "/docs/login?error=no_access" },
        });
      }

      setAuthCookies(cookie, data.session.access_token, data.session.refresh_token);
      return new Response(null, {
        status: 302,
        headers: { Location: "/docs" },
      });
    },
    {
      body: t.Object({
        email: t.String(),
        password: t.String(),
      }),
      detail: { hide: true },
    }
  )

  // Logout
  .post("/logout", ({ cookie }) => {
    cookie.docs_session.remove();
    cookie.docs_refresh.remove();
    return new Response(null, {
      status: 302,
      headers: { Location: "/docs/login" },
    });
  }, { detail: { hide: true } });
