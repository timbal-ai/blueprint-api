import { Elysia } from "elysia";
import { getClient, authMiddleware } from "../auth/middleware";

export const sessionRoutes = new Elysia()
  .use(authMiddleware)
  .get(
    "/me",
    async ({ accessToken }) => {
      return await getClient(accessToken).getSession();
    },
    {
      detail: {
        summary: "Get current user",
        description: "Returns the authenticated user's session info",
        tags: ["Auth"],
      },
    },
  );
