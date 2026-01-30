import { join } from "path";

interface TimbalConfig {
  auth: {
    provider: string;
    config: {
      url: string;
      anonKey: string;
    };
  };
  timbal: {
    apiUrl: string;
    orgId: string;
    projectId: string;
  };
}

const timbalConfigPath = join(import.meta.dir, "../../timbal.config.json");
const timbalConfig: TimbalConfig = await Bun.file(timbalConfigPath).json();

export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || "development",
  baseUrl: process.env.BASE_URL || "http://localhost:3000",
  api: {
    title: "Blueprint API",
    version: "1.0.0",
    description: "A production-ready Timbal API",
  },
  supabase: {
    url: timbalConfig.auth.config.url,
    anonKey: timbalConfig.auth.config.anonKey,
  },
  timbal: {
    apiUrl: timbalConfig.timbal.apiUrl,
    orgId: timbalConfig.timbal.orgId,
    projectId: timbalConfig.timbal.projectId,
  },
} as const;