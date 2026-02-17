export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || "development",
  api: {
    title: "Blueprint API",
    version: "1.0.0",
    description: "A production-ready Timbal API",
  },
  timbal: {
    apiUrl: `https://${process.env.TIMBAL_API_HOST || "api.timbal.ai"}`,
    orgId: process.env.TIMBAL_ORG_ID || "",
    projectId: process.env.TIMBAL_PROJECT_ID || "",
  },
} as const;
