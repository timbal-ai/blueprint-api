import { Elysia, t } from "elysia";

export const verifyRoutes = new Elysia({ prefix: "/verify" })
  .get("/", ({ store }) => {
    const user = (store as { user?: { id: string; email: string } }).user;
    return {
      authenticated: true,
      user: user ?? null,
      timestamp: new Date().toISOString(),
    };
  }, {
    response: t.Object({
      authenticated: t.Boolean(),
      user: t.Union([
        t.Object({
          id: t.String(),
          email: t.String(),
        }),
        t.Null(),
      ]),
      timestamp: t.String({ format: "date-time" }),
    }),
    detail: {
      summary: "Verify authentication",
      description: "Returns authentication status and user info if authenticated",
      tags: ["Auth"],
    },
  });
