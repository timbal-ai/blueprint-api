import { Elysia, t } from "elysia";

export const healthcheckRoutes = new Elysia({ prefix: "/healthcheck" }).get(
  "/",
  () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }),
  {
    response: t.Object({
      status: t.String(),
      timestamp: t.String(),
      uptime: t.Number(),
    }),
    detail: {
      summary: "Health Check",
      description: "Returns the health status of the API",
      tags: ["Health"],
    },
  }
);
