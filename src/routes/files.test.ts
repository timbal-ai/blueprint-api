import { describe, test, expect, mock, afterEach } from "bun:test";
import { Elysia } from "elysia";
import { fileRoutes } from "./files";

type App = Elysia;

const openApps: App[] = [];

async function makeApp(timbal: unknown): Promise<App> {
  const app = new Elysia()
    .decorate("timbal", timbal as any)
    .use(fileRoutes);
  await new Promise<void>((resolve) => app.listen(0, () => resolve()));
  openApps.push(app);
  return app;
}

function baseUrl(app: App): string {
  const s = (app as any).server;
  return `http://localhost:${s.port}`;
}

async function postUpload(app: App, file: File): Promise<Response> {
  const fd = new FormData();
  fd.append("file", file);
  return fetch(`${baseUrl(app)}/files/upload`, {
    method: "POST",
    body: fd,
  });
}

afterEach(async () => {
  await Promise.all(openApps.map((a) => a.stop()));
  openApps.length = 0;
});

describe("POST /files/upload", () => {
  test("returns uploaded file metadata with url", async () => {
    const uploaded = {
      id: "42",
      name: "photo.png",
      content_type: "image/png",
      content_length: 5,
      url: "https://cdn.example.com/f.png",
      created_at: "2026-01-01T00:00:00Z",
    };
    const timbal = {
      uploadFileFromBuffer: mock(async () => uploaded),
    };
    const app = await makeApp(timbal);

    const res = await postUpload(
      app,
      new File(["hello"], "photo.png", { type: "image/png" }),
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(uploaded);
    expect(timbal.uploadFileFromBuffer).toHaveBeenCalledTimes(1);
    const [buffer, name, type] = (timbal.uploadFileFromBuffer as ReturnType<
      typeof mock
    >).mock.calls[0] as [ArrayBuffer, string, string];
    expect(name).toBe("photo.png");
    expect(type).toBe("image/png");
    expect(new TextDecoder().decode(new Uint8Array(buffer))).toBe("hello");
  });

  test("defaults content type when file type is empty", async () => {
    const timbal = {
      uploadFileFromBuffer: mock(async () => ({
        id: "1",
        url: "https://cdn.example.com/f.bin",
      })),
    };
    const app = await makeApp(timbal);

    await postUpload(app, new File(["x"], "data.bin", { type: "" }));

    const [, , type] = (timbal.uploadFileFromBuffer as ReturnType<typeof mock>)
      .mock.calls[0] as [ArrayBuffer, string, string];
    expect(type).toBe("application/octet-stream");
  });
});
