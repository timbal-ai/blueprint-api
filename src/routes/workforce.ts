import { readdir, readFile } from "fs/promises";
import { resolve } from "path";
import { Elysia, t } from "elysia";
import { config } from "../config";
import { authMiddleware } from "../auth/middleware";

const deploymentCache = new Map<string, any>();

async function resolveDeployment(id: string, token: string): Promise<any> {
  const cached = deploymentCache.get(id);
  if (cached) return cached;

  console.log(`Resolving deployment for workforce ${id}`);
  const url = new URL(
    `${config.timbal.apiUrl}/orgs/${config.timbal.orgId}/projects/${config.timbal.projectId}/deployments`,
  );
  url.searchParams.set("status", "running");
  url.searchParams.set("project_env_id", process.env.TIMBAL_PROJECT_ENV_ID!);
  url.searchParams.set("manifest_id", id);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return null;

    const data = await res.json();

    const deployment = (data?.deployments ?? [])[0];

    if (!deployment?.domain) return null;

    deploymentCache.set(id, deployment);
    console.log(`Cached deployment for workforce ${id}:`, deployment);
    return deployment;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function listWorkforces(token: string): Promise<{ id: string }[]> {
  const url = new URL(
    `${config.timbal.apiUrl}/orgs/${config.timbal.orgId}/projects/${config.timbal.projectId}/deployments`,
  );
  url.searchParams.set("status", "running");
  url.searchParams.set("project_env_id", process.env.TIMBAL_PROJECT_ENV_ID!);

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const deployments = data?.deployments ?? [];

    const seen = new Set<string>();
    const results: { id: string }[] = [];

    for (const d of deployments) {
      const id = d.target?.manifest_id;
      if (id && !seen.has(id)) {
        seen.add(id);
        results.push({ id });
      }
    }

    return results;
  } catch (err) {
    console.error("Failed to list workforces:", err);
    return [];
  }
}

const WORKFORCE_DIR = resolve(import.meta.dir, "../../../workforce");

async function listWorkforcesFromManifests(): Promise<{ id: string }[]> {
  const entries = await readdir(WORKFORCE_DIR, { withFileTypes: true });
  const results: { id: string }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    try {
      const yaml = await readFile(
        resolve(WORKFORCE_DIR, entry.name, "timbal.yaml"),
        "utf-8",
      );
      const match = yaml.match(/_id:\s*"([^"]+)"/);
      if (match) results.push({ id: match[1] });
    } catch {
      // no timbal.yaml — skip
    }
  }

  return results;
}

async function resolveLocalDeployment(
  manifestId: string,
): Promise<string | null> {
  const entries = await readdir(WORKFORCE_DIR, { withFileTypes: true });
  const dirs = entries
    .filter((e) => e.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));
  const basePort = Number(process.env.WORKFORCE_LOCAL_BASE_PORT) || 4455;

  for (let i = 0; i < dirs.length; i++) {
    try {
      const yaml = await readFile(
        resolve(WORKFORCE_DIR, dirs[i].name, "timbal.yaml"),
        "utf-8",
      );
      const match = yaml.match(/_id:\s*"([^"]+)"/);
      if (match?.[1] === manifestId) {
        return `http://localhost:${basePort + i}`;
      }
    } catch {
      // no timbal.yaml — skip
    }
  }

  return null;
}

export const workforceRoutes = new Elysia({ prefix: "/workforce" })
  // Elysia deduplicates named plugins — this is for type inference only
  .use(authMiddleware)
  .get(
    "/",
    async ({ accessToken }) => {
      if (!process.env.TIMBAL_PROJECT_ENV_ID) {
        return await listWorkforcesFromManifests();
      }
      return await listWorkforces(accessToken!);
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
      const isLocal = !process.env.TIMBAL_PROJECT_ENV_ID;
      let url: string;

      if (isLocal) {
        const base = await resolveLocalDeployment(params.id);
        if (!base) return status(503);
        url = `${base}/run`;
      } else {
        const deployment = await resolveDeployment(params.id, accessToken!);
        if (!deployment) return status(503);
        url = `https://${deployment.domain}/run`;
      }

      const payload = body ?? {};
      if (!isLocal) {
        if (!payload.context) {
          payload.context = {};
        }
        payload.context.platform_config = {
          host: process.env.TIMBAL_API_HOST,
          auth: {
            type: "bearer",
            token: accessToken,
          },
        };
      }

      try {
        const res = await fetch(url, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        set.status = res.status;
        return new Response(res.body, {
          headers: res.headers,
        });
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
      const isLocal = !process.env.TIMBAL_PROJECT_ENV_ID;
      let url: string;

      if (isLocal) {
        const base = await resolveLocalDeployment(params.id);
        if (!base) return status(503);
        url = `${base}/stream`;
      } else {
        const deployment = await resolveDeployment(params.id, accessToken!);
        if (!deployment) return status(503);
        url = `https://${deployment.domain}/stream`;
      }

      const payload = body ?? {};
      if (!isLocal) {
        if (!payload.context) {
          payload.context = {};
        }
        payload.context.platform_config = {
          host: process.env.TIMBAL_API_HOST,
          auth: {
            type: "bearer",
            token: accessToken,
          },
        };
      }

      try {
        const res = await fetch(url, {
          method: "POST",
          body: JSON.stringify(payload),
        });

        set.status = res.status;
        return new Response(res.body, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (err) {
        console.error(err);
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
