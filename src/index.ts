import { Elysia } from "elysia";
import { swagger } from "@elysiajs/swagger";
import { config } from "./config";
import { healthcheckRoutes } from "./routes/healthcheck";
import { userRoutes } from "./routes/users";

const app = new Elysia()
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
