import { Elysia, t } from "elysia";

export const fileRoutes = new Elysia({ prefix: "/files" }).post(
  "/upload",
  async ({ body, timbal }: any) => {
    const buffer = await body.file.arrayBuffer();
    return timbal.uploadFileFromBuffer(
      buffer,
      body.file.name,
      body.file.type || "application/octet-stream",
    );
  },
  {
    body: t.Object({ file: t.File() }),
    detail: {
      summary: "Upload a file",
      description:
        "Uploads a file for chat attachments. Used by @timbal-ai/timbal-react when attachments are enabled.",
      tags: ["Files"],
    },
  },
);
