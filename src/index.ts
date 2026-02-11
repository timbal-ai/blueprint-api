import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import logixlysia from "logixlysia";
import { config } from "./config";
import { authMiddleware } from "./auth/middleware";
import { authRoutes } from "./auth/routes";
import { healthcheckRoutes } from "./routes/healthcheck";
import { verifyRoutes } from "./routes/verify";
import { workforceRoutes } from "./routes/workforce";

const DOCS_PAGE_PATH = "./src/pages/docs.html";

const app = new Elysia()
  .use(cors())
  .use(logixlysia())
  .use(authRoutes)
  .use(authMiddleware)
  .use(
    swagger({
      path: "/api-spec",
      documentation: {
        info: {
          title: config.api.title,
          version: config.api.version,
          description: config.api.description,
        },
        tags: [
          { name: "Health", description: "Health check endpoints" },
          { name: "Auth", description: "Authentication verification" },
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
  .get("/docs", () => Bun.file(DOCS_PAGE_PATH), { detail: { hide: true } })
  .get("/favicon.png", ({ redirect }) => redirect("https://content.timbal.ai/assets/favicon.png"), { detail: { hide: true } })
  .get("/", ({ redirect }) => redirect("/docs"), { detail: { hide: true } })
  .use(healthcheckRoutes)
  .use(verifyRoutes)
  .use(workforceRoutes)
  .listen(config.port);

console.log(
  `Timbal API is running at http://${app.server?.hostname}:${app.server?.port}`,
);
console.log(
  `API Documentation available at http://${app.server?.hostname}:${app.server?.port}/docs`,
);
