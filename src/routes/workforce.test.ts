import { describe, test, expect, mock, afterEach } from "bun:test";
import { Elysia } from "elysia";
import { TimbalApiError } from "@timbal-ai/timbal-sdk";
import { workforceRoutes } from "./workforce";

type App = Elysia;

const openApps: App[] = [];

async function makeApp(timbal: unknown): Promise<App> {
  const app = new Elysia()
    .decorate("timbal", timbal as any)
    .use(workforceRoutes);
  await new Promise<void>((resolve) => app.listen(0, () => resolve()));
  openApps.push(app);
  return app;
}

function baseUrl(app: App): string {
  const s = (app as any).server;
  return `http://localhost:${s.port}`;
}

async function get(app: App, path: string): Promise<Response> {
  return fetch(`${baseUrl(app)}${path}`);
}

async function postJson(
  app: App,
  path: string,
  body?: unknown,
): Promise<Response> {
  return fetch(`${baseUrl(app)}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.all(openApps.map((a) => a.stop()));
  openApps.length = 0;
});

describe("GET /workforce", () => {
  test("returns the list of workforces", async () => {
    const items = [{ id: "a", name: "A" }];
    const timbal = { listWorkforces: mock(async () => items) };
    const app = await makeApp(timbal);

    const res = await get(app, "/workforce/");

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(items);
    expect(timbal.listWorkforces).toHaveBeenCalledTimes(1);
  });

  test("propagates TimbalApiError status and payload", async () => {
    const timbal = {
      listWorkforces: mock(async () => {
        throw new TimbalApiError("nope", 403, "FORBIDDEN", { foo: "bar" });
      }),
    };
    const app = await makeApp(timbal);

    const res = await get(app, "/workforce/");

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      error: "nope",
      code: "FORBIDDEN",
      details: { foo: "bar" },
    });
  });

  test("clamps out-of-range TimbalApiError statusCode to 502", async () => {
    const timbal = {
      listWorkforces: mock(async () => {
        throw new TimbalApiError("network blip", 0, "NETWORK_ERROR");
      }),
    };
    const app = await makeApp(timbal);

    const res = await get(app, "/workforce/");

    expect(res.status).toBe(502);
  });
});

describe("POST /workforce/:id", () => {
  test("forwards 200 body and content-type", async () => {
    const timbal = {
      callWorkforce: mock(
        async () =>
          new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/foo", { name: "bar" });

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ ok: true });
    expect(timbal.callWorkforce).toHaveBeenCalledWith("foo", { name: "bar" });
  });

  test("propagates upstream 403 verbatim (THE bug)", async () => {
    const upstreamBody = JSON.stringify({ error: "forbidden by upstream" });
    const timbal = {
      callWorkforce: mock(
        async () =>
          new Response(upstreamBody, {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/foo", {});

    expect(res.status).toBe(403);
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
    expect(await res.json()).toEqual({ error: "forbidden by upstream" });
  });

  test("propagates upstream 5xx", async () => {
    const timbal = {
      callWorkforce: mock(
        async () => new Response("boom", { status: 502 }),
      ),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/foo", {});

    expect(res.status).toBe(502);
    expect(await res.text()).toBe("boom");
  });

  test("defaults missing body to empty object", async () => {
    const timbal = {
      callWorkforce: mock(
        async () =>
          new Response("{}", {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    };
    const app = await makeApp(timbal);

    await fetch(`${baseUrl(app)}/workforce/foo`, { method: "POST" });

    expect(timbal.callWorkforce).toHaveBeenCalledWith("foo", {});
  });

  test("strips content-encoding/length so the client doesn't double-decode", async () => {
    const timbal = {
      callWorkforce: mock(
        async () =>
          new Response('{"ok":true}', {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Content-Encoding": "gzip",
              "Content-Length": "11",
            },
          }),
      ),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/foo", {});

    expect(res.status).toBe(200);
    expect(res.headers.get("content-encoding")).toBeNull();
    expect(await res.json()).toEqual({ ok: true });
  });

  test("maps TimbalApiError thrown during resolve to its status", async () => {
    const timbal = {
      callWorkforce: mock(async () => {
        throw new TimbalApiError("auth", 401, "AUTH_ERROR");
      }),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/foo", {});

    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: "auth",
      code: "AUTH_ERROR",
    });
  });

  test("maps 'Workforce component not found' to 404", async () => {
    const timbal = {
      callWorkforce: mock(async () => {
        throw new Error('Workforce component not found for identifier "x"');
      }),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/x", {});

    expect(res.status).toBe(404);
    expect((await res.json()).error).toMatch(/not found/i);
  });

  test("maps 'No running deployment' to 503", async () => {
    const timbal = {
      callWorkforce: mock(async () => {
        throw new Error(
          'No running deployment for workforce "x" on rev "main"',
        );
      }),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/x", {});

    expect(res.status).toBe(503);
  });

  test("unknown errors return 500", async () => {
    const timbal = {
      callWorkforce: mock(async () => {
        throw new Error("kaboom");
      }),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/x", {});

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "kaboom" });
  });
});

describe("POST /workforce/:id/stream", () => {
  test("forwards status, content-type and streaming body", async () => {
    const chunks = ["data: hello\n\n", "data: world\n\n"];
    const timbal = {
      streamWorkforce: mock(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                const enc = new TextEncoder();
                for (const c of chunks) controller.enqueue(enc.encode(c));
                controller.close();
              },
            }),
            {
              status: 200,
              headers: { "Content-Type": "text/event-stream" },
            },
          ),
      ),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/foo/stream", {});

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/event-stream/);
    expect(await res.text()).toBe(chunks.join(""));
  });

  test("propagates upstream 403 from stream endpoint", async () => {
    const timbal = {
      streamWorkforce: mock(
        async () =>
          new Response('{"error":"nope"}', {
            status: 403,
            headers: { "Content-Type": "application/json" },
          }),
      ),
    };
    const app = await makeApp(timbal);

    const res = await postJson(app, "/workforce/foo/stream", {});

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "nope" });
  });
});
