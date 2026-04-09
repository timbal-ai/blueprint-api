import { Elysia } from "elysia";

export const sessionRoutes = new Elysia()
  .get(
    "/me",
    async ({ timbal }: any) => {
      return timbal.getSession();
    },
    {
      detail: {
        summary: "Get current user",
        description: "Returns the authenticated user's session info",
        tags: ["Session"],
      },
    },
  );
