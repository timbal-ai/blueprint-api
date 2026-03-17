import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import logixlysia from "logixlysia";
import { TimbalApiError } from "@timbal-ai/timbal-sdk";
import { authMiddleware } from "./auth/middleware";
import { authRoutes } from "./auth/routes";
import { healthcheckRoutes } from "./routes/healthcheck";
import { sessionRoutes } from "./routes/session";
import { workforceRoutes } from "./routes/workforce";

const DOCS_PAGE_PATH = "./src/pages/docs.html";

const coreApp = new Elysia()
  .use(authRoutes)
  .use(authMiddleware)
  .use(
    swagger({
      path: "/api-spec",
      documentation: {
        info: {
          title: "Blueprint API",
          version: "1.0.0",
          description: "A production-ready Timbal API",
        },
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Session", description: "Current user session" },
          { name: "Workforce", description: "Workforce component endpoints" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              description:
                "Auth is pre-configured to directly use your Timbal access token. You can also use your API key.",
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    }),
  )
  .get(
    "/docs",
    async ({ path }) => {
      const prefix = path.startsWith("/api") ? "/api" : "";
      const html = await Bun.file(DOCS_PAGE_PATH).text();
      return new Response(html.replaceAll("{{PREFIX}}", prefix), {
        headers: { "Content-Type": "text/html" },
      });
    },
    { detail: { hide: true } },
  )
  .get(
    "/favicon.png",
    ({ redirect }) => redirect("https://content.timbal.ai/assets/favicon.png"),
    { detail: { hide: true } },
  )
  .get(
    "/",
    ({ redirect, path }) => {
      const prefix = path.startsWith("/api") ? "/api" : "";
      return redirect(`${prefix}/docs`);
    },
    { detail: { hide: true } },
  )
  .use(healthcheckRoutes)
  .use(sessionRoutes)
  .use(workforceRoutes);

const app = new Elysia()
  .use(cors())
  .use(
    logixlysia({
      config: {
        showStartupMessage: false,
        customLogFormat: "{now} {level} {duration} {method} {pathname} {status}",
      },
    }),
  )
  .onError({ as: "global" }, ({ error, request, set }) => {
    console.error(`[${request.method}] ${new URL(request.url).pathname}`, error);
    if (error instanceof TimbalApiError) {
      set.status = error.statusCode >= 400 ? error.statusCode : 502;
      return { error: error.message };
    }
  })
  .use(coreApp)
  .group("/api", (app) => app.use(coreApp))
  .listen(Number(process.env.PORT) || 3000);

console.log(
  `Timbal API is running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(
  `API Documentation available at http://${app.server?.hostname}:${app.server?.port}/docs`,
);
