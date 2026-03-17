import { Elysia, t } from "elysia";
import { timbal, authMiddleware } from "../auth/middleware";

export const workforceRoutes = new Elysia({ prefix: "/workforce" })
  .use(authMiddleware)
  .get(
    "/",
    async ({ accessToken }) => {
      return await timbal.as(accessToken!).listWorkforces();
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
    async ({ params, body, accessToken, status, set }) => {
      try {
        const res = await timbal
          .as(accessToken!)
          .callWorkforce(params.id, body ?? {});
        set.status = res.status;
        return new Response(res.body, { headers: res.headers });
      } catch (err) {
        console.error(err);
        return status(502);
      }
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
    async ({ params, body, accessToken, status, set }) => {
      try {
        const res = await timbal
          .as(accessToken!)
          .streamWorkforce(params.id, body ?? {});

        if (!res.ok) {
          const text = await res.text();
          console.error(`[stream] upstream ${res.status}:`, text);
          set.status = res.status;
          return text;
        }

        set.status = res.status;
        return new Response(res.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (err) {
        console.error(`[stream] fetch failed:`, err);
        return status(502);
      }
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
