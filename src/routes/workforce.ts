import { Elysia, t } from "elysia";
import { TimbalApiError } from "@timbal-ai/timbal-sdk";

/**
 * Under `timbal start`, every workforce member runs as a local Python process
 * and the `RunContext.platform_config` is auto-resolved from env (`TIMBAL_API_KEY`,
 * `TIMBAL_ORG_ID`, `TIMBAL_APP_ID`). Those env vars come from the developer's
 * `~/.timbal/credentials` (set by `timbal configure`), so without intervention
 * every logged-in UI user's traces would be attributed to the developer's account.
 *
 * We forward the per-request user token in `context.platform_config.auth` so the
 * Python runtime uses the real user as the trace subject. We intentionally omit
 * `subject` — the workforce member already knows its own `org_id`/`app_id` from
 * its own `.env` and Python's `resolve_platform_config` fills the subject from
 * those env vars when not provided.
 *
 * In remote (deployed) mode this is a no-op: the deployed workforce process has
 * its own platform creds and we don't want to override the deployed app identity
 * with a transient user token.
 */
function isLocalWorkforceEnvironment(): boolean {
  return Boolean(
    process.env.TIMBAL_START_WORKFORCE?.trim() ||
      process.env.TIMBAL_WORKFORCE?.trim(),
  );
}

function buildPlatformConfig(
  token: string | null | undefined,
): Record<string, unknown> | null {
  if (!isLocalWorkforceEnvironment()) return null;
  if (!token) return null;
  const host = process.env.TIMBAL_API_HOST?.trim();
  if (!host) return null;
  return { host, auth: { type: "bearer", token } };
}

function injectPlatformConfig(
  body: unknown,
  platformConfig: Record<string, unknown> | null,
): unknown {
  if (!platformConfig) return body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { context: { platform_config: platformConfig } };
  }
  const b = body as Record<string, unknown>;
  const ctx =
    b.context && typeof b.context === "object" && !Array.isArray(b.context)
      ? (b.context as Record<string, unknown>)
      : {};
  if (ctx.platform_config) return body;
  return { ...b, context: { ...ctx, platform_config: platformConfig } };
}

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
      // Pass through real HTTP statuses; map SDK-internal preconditions
      // (timeout / network / missing auth → statusCode 0) to 502.
      set.status =
        error.isClientError() || error.isServerError() ? error.statusCode : 502;
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
    async ({ params, body, timbal, token, set, request }: any) => {
      const enrichedBody = injectPlatformConfig(
        body ?? {},
        buildPlatformConfig(token),
      );
      const upstream = await timbal.callWorkforce(
        params.id,
        enrichedBody as Record<string, unknown>,
      );
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
    async ({ params, body, timbal, token, set, request }: any) => {
      const enrichedBody = injectPlatformConfig(
        body ?? {},
        buildPlatformConfig(token),
      );
      const upstream = await timbal.streamWorkforce(
        params.id,
        enrichedBody as Record<string, unknown>,
      );
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
