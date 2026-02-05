import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { swagger } from "@elysiajs/swagger";
import logixlysia from "logixlysia";
import { config } from "./config";
import { authMiddleware } from "./auth/middleware";
import { authRoutes } from "./auth/routes";
import { healthcheckRoutes } from "./routes/healthcheck";
import { verifyRoutes } from "./routes/verify";

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
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              description: "Timbal access token or API key (t2_...)",
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    })
  )
  .get("/docs", () => Bun.file(DOCS_PAGE_PATH), { detail: { hide: true } })
  .get("/", ({ redirect }) => redirect("/docs"), { detail: { hide: true } })
  .use(healthcheckRoutes)
  .use(verifyRoutes)
  .listen(config.port);

console.log(
  `Timbal API is running at http://${app.server?.hostname}:${app.server?.port}`
);
console.log(
  `API Documentation available at http://${app.server?.hostname}:${app.server?.port}/docs`
);
