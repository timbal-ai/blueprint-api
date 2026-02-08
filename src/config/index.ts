export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || "development",
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  api: {
    title: "Blueprint API",
    version: "1.0.0",
    description: "A production-ready Timbal API",
  },
  auth: {
    url: `https://${process.env.TIMBAL_API_HOST || "api.timbal.ai"}`,
  },
  timbal: {
    apiUrl: `https://${process.env.TIMBAL_API_HOST || "api.timbal.ai"}`,
    orgId: process.env.TIMBAL_ORG_ID || "",
    projectId: process.env.TIMBAL_PROJECT_ID || "",
  },
} as const;
