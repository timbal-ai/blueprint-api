import { Elysia, t } from "elysia";
import { authMiddleware } from "../auth/middleware";

export const workforceRoutes = new Elysia({ prefix: "/workforce" })
  .use(authMiddleware)
  .get(
    "/",
    async ({ timbal }) => {
      return await timbal.listWorkforces();
    },
    {
      detail: {
        summary: "List all workforces",
        description:
          "Returns the name and ID of every running workforce component",
        tags: ["Workforce"],
      },
    },
  )
  .post(
    "/:id",
    async ({ params, body, timbal }) => {
      return await timbal.callWorkforce(params.id, body ?? {});
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Any(),
      detail: {
        summary: "Call a workforce component",
        description:
          "Resolves and proxies a request to a workforce component by manifest ID",
        tags: ["Workforce"],
      },
    },
  )
  .post(
    "/:id/stream",
    async ({ params, body, timbal }) => {
      return await timbal.streamWorkforce(params.id, body ?? {});
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Any(),
      detail: {
        summary: "Stream a workforce component",
        description:
          "Resolves and streams SSE events from a workforce component by manifest ID",
        tags: ["Workforce"],
      },
    },
  );
