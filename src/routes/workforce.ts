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

export const workforceRoutes = new Elysia({ prefix: "/workforce" })
  // Elysia deduplicates named plugins — this is for type inference only
  .use(authMiddleware)
  .post(
    "/:id",
    async ({ params, body, accessToken, status, set }) => {
      const deployment = await resolveDeployment(params.id, accessToken!);

      if (!deployment) {
        return status(503);
      }

      const payload = body ?? {};
      payload.context = {
        platform_config: {
          host: process.env.TIMBAL_API_HOST,
          auth: {
            type: "bearer",
            token: accessToken,
          },
          subject: {
            org_id: config.timbal.orgId,
            app_id: deployment.target?.id.toString(),
          },
        },
      };
      const url = `https://${deployment.domain}/run`;

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
      const deployment = await resolveDeployment(params.id, accessToken!);

      if (!deployment) {
        return status(503);
      }

      const payload = body ?? {};
      payload.context = {
        platform_config: {
          host: process.env.TIMBAL_API_HOST,
          auth: {
            type: "bearer",
            token: accessToken,
          },
          subject: {
            org_id: config.timbal.orgId,
            app_id: deployment.target?.id.toString(),
          },
        },
      };
      const url = `https://${deployment.domain}/stream`;

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
