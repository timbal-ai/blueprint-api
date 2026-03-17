import { Elysia } from "elysia";
import { authMiddleware } from "../auth/middleware";

export const sessionRoutes = new Elysia()
  .use(authMiddleware)
  .get(
    "/me",
    async ({ timbal }) => {
      return await timbal.getSession();
    },
    {
      detail: {
        summary: "Get current user",
        description: "Returns the authenticated user's session info",
        tags: ["Session"],
      },
    },
  );
