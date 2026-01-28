import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { config } from "./config";
import { healthcheckRoutes } from "./routes/healthcheck";
import { userRoutes } from "./routes/users";
import { supabase } from "./lib/supabase";

const app = new Elysia()
  // Option 1: Header-based auth (requires custom client)
  // .onBeforeHandle(({ path, headers }) => {
  //   if (path.startsWith("/docs") && headers["x-api-key"] !== "secret") {
  //     return new Response("Unauthorized", { status: 401 });
  //   }
  // })

  // Option 2: Query parameter auth
  // .onBeforeHandle(({ path, query }) => {
  //   if (path.startsWith("/docs") && query.token !== "secret") {
  //     return new Response("Unauthorized", { status: 401 });
  //   }
  // })

  // Option 3: Basic Auth (browser prompts for credentials)
  // .onBeforeHandle(({ path, headers }) => {
  //   if (path.startsWith("/docs")) {
  //     const auth = headers["authorization"];
  //     if (!auth || auth !== "Basic " + btoa("admin:password")) {
  //       return new Response("Unauthorized", {
  //         status: 401,
  //         headers: { "WWW-Authenticate": 'Basic realm="Docs"' },
  //       });
  //     }
  //   }
  // })

  // Option 4: Supabase auth with custom login page
  // Login page
  .get("/docs/login", () => {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Docs Login</title>
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: #f5f5f5;
            }
            .container {
              background: white;
              padding: 2rem;
              border-radius: 8px;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
              width: 100%;
              max-width: 400px;
            }
            h1 {
              margin: 0 0 1.5rem;
              font-size: 1.5rem;
              text-align: center;
            }
            input {
              width: 100%;
              padding: 0.75rem;
              margin-bottom: 1rem;
              border: 1px solid #ddd;
              border-radius: 4px;
              font-size: 1rem;
              box-sizing: border-box;
            }
            button {
              width: 100%;
              padding: 0.75rem;
              background: #3b82f6;
              color: white;
              border: none;
              border-radius: 4px;
              font-size: 1rem;
              cursor: pointer;
            }
            button:hover {
              background: #2563eb;
            }
            .google-btn {
              background: white;
              color: #333;
              border: 1px solid #ddd;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 0.5rem;
            }
            .google-btn:hover {
              background: #f5f5f5;
            }
            .divider {
              display: flex;
              align-items: center;
              margin: 1.5rem 0;
              color: #888;
              font-size: 0.875rem;
            }
            .divider::before,
            .divider::after {
              content: "";
              flex: 1;
              height: 1px;
              background: #ddd;
            }
            .divider::before {
              margin-right: 1rem;
            }
            .divider::after {
              margin-left: 1rem;
            }
            .error {
              color: #ef4444;
              margin-bottom: 1rem;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Login to Access Docs</h1>
            <a href="/docs/auth/google" style="text-decoration: none;">
              <button type="button" class="google-btn">
                <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                  <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </a>
            <div class="divider">or</div>
            <form method="POST" action="/docs/login">
              <input name="email" type="email" placeholder="Email" required />
              <input name="password" type="password" placeholder="Password" required />
              <button type="submit">Login</button>
            </form>
          </div>
          <script>
            // Handle OAuth callback with token in URL fragment
            if (window.location.hash) {
              const params = new URLSearchParams(window.location.hash.substring(1));
              const accessToken = params.get('access_token');
              if (accessToken) {
                fetch('/docs/auth/token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ access_token: accessToken })
                }).then(res => {
                  if (res.ok) {
                    window.location.href = '/docs';
                  }
                });
              }
            }
          </script>
        </body>
      </html>
    `,
      { headers: { "Content-Type": "text/html" } },
    );
  })

  // Handle token from URL fragment (implicit flow)
  .post("/docs/auth/token", async ({ body, cookie }) => {
    const { access_token } = body as { access_token: string };

    if (!access_token) {
      return new Response("Missing token", { status: 400 });
    }

    // Verify the token with Supabase
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(access_token);

    if (error || !user) {
      return new Response("Invalid token", { status: 401 });
    }

    cookie.docs_session.set({
      value: access_token,
      httpOnly: true,
      secure: config.env === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  })

  // Google OAuth initiation
  .get("/docs/auth/google", async () => {
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
  })

  // OAuth callback handler
  .get("/docs/auth/callback", async ({ query, cookie }) => {
    const code = query.code as string | undefined;

    if (!code) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/docs/login" },
      });
    }

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error || !data.session) {
      return new Response(null, {
        status: 302,
        headers: { Location: "/docs/login" },
      });
    }

    cookie.docs_session.set({
      value: data.session.access_token,
      httpOnly: true,
      secure: config.env === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    return new Response(null, {
      status: 302,
      headers: { Location: "/docs" },
    });
  })

  // Handle login
  .post("/docs/login", async ({ body, cookie }) => {
    const { email, password } = body as { email: string; password: string };

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.session) {
      return new Response(
        `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Docs Login</title>
            <style>
              body {
                font-family: system-ui, -apple-system, sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                margin: 0;
                background: #f5f5f5;
              }
              .container {
                background: white;
                padding: 2rem;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                width: 100%;
                max-width: 400px;
              }
              h1 {
                margin: 0 0 1.5rem;
                font-size: 1.5rem;
                text-align: center;
              }
              input {
                width: 100%;
                padding: 0.75rem;
                margin-bottom: 1rem;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 1rem;
                box-sizing: border-box;
              }
              button {
                width: 100%;
                padding: 0.75rem;
                background: #3b82f6;
                color: white;
                border: none;
                border-radius: 4px;
                font-size: 1rem;
                cursor: pointer;
              }
              button:hover {
                background: #2563eb;
              }
              .google-btn {
                background: white;
                color: #333;
                border: 1px solid #ddd;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
              }
              .google-btn:hover {
                background: #f5f5f5;
              }
              .divider {
                display: flex;
                align-items: center;
                margin: 1.5rem 0;
                color: #888;
                font-size: 0.875rem;
              }
              .divider::before,
              .divider::after {
                content: "";
                flex: 1;
                height: 1px;
                background: #ddd;
              }
              .divider::before {
                margin-right: 1rem;
              }
              .divider::after {
                margin-left: 1rem;
              }
              .error {
                color: #ef4444;
                margin-bottom: 1rem;
                text-align: center;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <h1>Login to Access Docs</h1>
              <p class="error">Invalid credentials</p>
              <a href="/docs/auth/google" style="text-decoration: none;">
                <button type="button" class="google-btn">
                  <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
                    <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
                    <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
                    <path d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                    <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>
              </a>
              <div class="divider">or</div>
              <form method="POST" action="/docs/login">
                <input name="email" type="email" placeholder="Email" required />
                <input name="password" type="password" placeholder="Password" required />
                <button type="submit">Login</button>
              </form>
            </div>
            <script>
              // Handle OAuth callback with token in URL fragment
              if (window.location.hash) {
                const params = new URLSearchParams(window.location.hash.substring(1));
                const accessToken = params.get('access_token');
                if (accessToken) {
                  fetch('/docs/auth/token', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ access_token: accessToken })
                  }).then(res => {
                    if (res.ok) {
                      window.location.href = '/docs';
                    }
                  });
                }
              }
            </script>
          </body>
        </html>
      `,
        { status: 401, headers: { "Content-Type": "text/html" } },
      );
    }

    cookie.docs_session.set({
      value: data.session.access_token,
      httpOnly: true,
      secure: config.env === "production",
      maxAge: 60 * 60 * 24, // 1 day
      path: "/",
    });

    return new Response(null, {
      status: 302,
      headers: { Location: "/docs" },
    });
  })

  // Logout
  .post("/docs/logout", ({ cookie }) => {
    cookie.docs_session.remove();
    return new Response(null, {
      status: 302,
      headers: { Location: "/docs/login" },
    });
  })

  // Protect docs routes
  .onBeforeHandle(async ({ path, cookie }) => {
    const publicPaths = [
      "/docs/login",
      "/docs/auth/google",
      "/docs/auth/callback",
      "/docs/auth/token",
    ];
    if (
      path.startsWith("/docs") &&
      !publicPaths.some((p) => path.startsWith(p))
    ) {
      const token = cookie.docs_session?.value;

      if (!token) {
        return new Response(null, {
          status: 302,
          headers: { Location: "/docs/login" },
        });
      }

      // Verify token with Supabase
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser(token);

      if (error || !user) {
        cookie.docs_session.remove();
        return new Response(null, {
          status: 302,
          headers: { Location: "/docs/login" },
        });
      }
    }
  })

  .use(
    swagger({
      path: "/docs",
      documentation: {
        info: {
          title: config.api.title,
          version: config.api.version,
          description: config.api.description,
        },
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Users", description: "User management endpoints" },
        ],
      },
    }),
  )
  .get("/", ({ redirect }) => redirect("/docs"))
  .use(healthcheckRoutes)
  .use(userRoutes)
  .listen(config.port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(
  `📚 API Documentation available at http://${app.server?.hostname}:${app.server?.port}/docs`,
);
