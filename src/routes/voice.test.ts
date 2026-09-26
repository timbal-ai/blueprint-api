import { afterEach, describe, expect, mock, test } from "bun:test";
import { Elysia, type AnyElysia } from "elysia";
import { timbalAuth } from "@timbal-ai/timbal-sdk/elysia";
import { workforceRoutes } from "./workforce";

const apps: AnyElysia[] = [];
const saved = new Map<string, string | undefined>();
function env(key: string, value: string | undefined) {
  if (!saved.has(key)) saved.set(key, process.env[key]);
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map(app => app.stop()));
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  saved.clear();
});
const connection = { transport: "livekit", url: "wss://voice.example", token: "caller-only", room: "room-1", identity: "caller-1" };
async function setup(response: () => Response = () => new Response(JSON.stringify(connection), {
  headers: { "Content-Type": "application/json", "x-timbal-voice-session-id": "session-1" },
})) {
  env("TIMBAL_START_WORKFORCE", undefined); env("TIMBAL_WORKFORCE", undefined); env("TIMBAL_STUDIO", undefined);
  const rtc = mock(async (_body: unknown, _options: unknown) => response());
  const get = mock((_id: string) => ({ voice: { rtc } }));
  const app = new Elysia().decorate("timbal", { workforce: { get } }).group("/api", app => app.use(workforceRoutes));
  app.listen(0); apps.push(app);
  const url = `http://localhost:${app.server!.port}/api/workforce/support/voice/session`;
  return { app, get, rtc, url };
}
describe("native LiveKit session route", () => {
  test("uses request client, preserves caller material/session id, disables caching", async () => {
    const f = await setup(); const res = await fetch(f.url, { method: "POST" });
    expect(res.status).toBe(200); expect(await res.json()).toEqual(connection);
    expect(res.headers.get("x-timbal-voice-session-id")).toBe("session-1");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(f.get).toHaveBeenCalledWith("support");
    expect(f.rtc.mock.calls[0]![0]).toEqual({ transport: "livekit" });
    expect((f.rtc.mock.calls[0]![1] as { signal: AbortSignal }).signal).toBeInstanceOf(AbortSignal);
  });
  test("browser cannot override providers, preview, or platform credentials", async () => {
    const f = await setup(); await fetch(f.url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transport: "webrtc", config: { model: "other" }, preview: true, token: "injected" }) });
    expect(f.rtc.mock.calls[0]![0]).toEqual({ transport: "livekit" });
    expect(Object.keys(f.rtc.mock.calls[0]![1] as object)).toEqual(["signal"]);
  });
  test("preserves platform 403, 409 and 503 instead of returning a successful dial", async () => {
    for (const status of [403, 409, 503]) {
      const body = { error: "Voice unavailable", code: "VOICE_UNAVAILABLE" };
      const f = await setup(() => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } }));
      const res = await fetch(f.url, { method: "POST" });
      expect(res.status).toBe(status); expect(await res.json()).toEqual(body);
      expect(res.headers.get("cache-control")).toContain("no-store");
    }
  });
  test("standalone local mode fails explicitly; Studio preview is permitted", async () => {
    const f = await setup(); env("TIMBAL_START_WORKFORCE", "support:7100");
    const local = await fetch(f.url, { method: "POST" });
    expect(local.status).toBe(503); expect(f.rtc).not.toHaveBeenCalled();
    env("TIMBAL_STUDIO", "1");
    expect((await fetch(f.url, { method: "POST" })).status).toBe(200);
  });
  test("the real auth plugin rejects anonymous calls on both mounts", async () => {
    env("TIMBAL_PROJECT_ID", "123");
    const app = new Elysia().use(timbalAuth({ authMode: "legacy", configRefresh: false, configRoute: false, cron: false })).use(workforceRoutes).group("/api", a => a.use(workforceRoutes));
    app.listen(0); apps.push(app);
    for (const prefix of ["", "/api"]) {
      const res = await fetch(`http://localhost:${app.server!.port}${prefix}/workforce/support/voice/session`, { method: "POST" });
      expect(res.status).toBe(401);
    }
  });
});
