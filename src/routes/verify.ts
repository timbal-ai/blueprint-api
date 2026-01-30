import { Elysia, t } from "elysia";

export const verifyRoutes = new Elysia({ prefix: "/verify" })
  .get("/", () => ({
    authenticated: true,
    timestamp: new Date().toISOString(),
  }), {
    response: t.Object({
      authenticated: t.Boolean(),
      timestamp: t.String({ format: "date-time" }),
    }),
    detail: {
      summary: "Verify Auth",
      description: "Returns authentication status",
      tags: ["Auth"],
    },
  });
