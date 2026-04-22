import { Elysia, t } from "elysia";
import { TimbalApiError } from "@timbal-ai/timbal-sdk";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
  "content-encoding",
  "content-length",
]);

function copyHeaders(upstream: Response): Headers {
  const headers = new Headers();
  upstream.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  return headers;
}

async function forwardResponse(
  upstream: Response,
  set: { status?: number | string },
  context: { method: string; path: string },
): Promise<Response> {
  set.status = upstream.status;
  const headers = copyHeaders(upstream);

  if (!upstream.ok) {
    const text = await upstream.text();
    console.error(
      `[${context.method}] ${context.path} upstream ${upstream.status}: ${text}`,
    );
    return new Response(text, {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    });
  }

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });
}

export const workforceRoutes = new Elysia({ prefix: "/workforce" })
  .onError(({ error, set }) => {
    if (error instanceof TimbalApiError) {
      set.status =
        error.statusCode >= 400 && error.statusCode < 600
          ? error.statusCode
          : 502;
      return {
        error: error.message,
        code: error.code,
        details: error.details,
      };
    }
    const message =
      error instanceof Error ? error.message : String(error);
    if (/not found/i.test(message)) {
      set.status = 404;
      return { error: message };
    }
    if (/no running deployment/i.test(message)) {
      set.status = 503;
      return { error: message };
    }
    set.status = 500;
    return { error: message };
  })
  .get(
    "/",
    async ({ timbal }: any) => {
      return timbal.listWorkforces();
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
    async ({ params, body, timbal, set, request }: any) => {
      const upstream = await timbal.callWorkforce(params.id, body ?? {});
      return forwardResponse(upstream, set, {
        method: request.method,
        path: `/workforce/${params.id}`,
      });
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
    async ({ params, body, timbal, set, request }: any) => {
      const upstream = await timbal.streamWorkforce(params.id, body ?? {});
      return forwardResponse(upstream, set, {
        method: request.method,
        path: `/workforce/${params.id}/stream`,
      });
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
