import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import logixlysia from "logixlysia";
import { config } from "./config";
import { authMiddleware } from "./auth/middleware";
import { authRoutes } from "./auth/routes";
import { healthcheckRoutes } from "./routes/healthcheck";
import { userRoutes } from "./routes/users";

const DOCS_PAGE_PATH = "./src/auth/pages/docs.html";

const app = new Elysia()
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
          { name: "Users", description: "User management endpoints" },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: "http",
              scheme: "bearer",
              bearerFormat: "JWT",
              description: "Your access token is auto-filled from your session cookie. Copy it for external use.",
            },
            apiKey: {
              type: "apiKey",
              in: "header",
              name: "x-api-key",
              description: "API key for machine-to-machine authentication",
            },
          },
        },
        security: [{ bearerAuth: [] }, { apiKey: [] }],
      },
    })
  )
  // Custom docs page with auto-filled Bearer token
  .get("/docs", () => Bun.file(DOCS_PAGE_PATH))
  .get("/", ({ redirect }) => redirect("/docs"))
  .use(healthcheckRoutes)
  .use(userRoutes)
  .listen(config.port);

console.log(
  `🦊 Elysia is running at http://${app.server?.hostname}:${app.server?.port}`
);
console.log(
  `📚 API Documentation available at http://${app.server?.hostname}:${app.server?.port}/docs`
);
