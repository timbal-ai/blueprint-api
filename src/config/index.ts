import timbalConfig from "../../timbal.config.json";

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
    url: "https://api.timbal.ai",
  },
  timbal: {
    apiUrl: timbalConfig.timbal.apiUrl,
    orgId: timbalConfig.timbal.orgId,
    projectId: timbalConfig.timbal.projectId,
  },
} as const;