export const config = {
  port: Number(process.env.PORT) || 3000,
  env: process.env.NODE_ENV || "development",
  api: {
    title: "Blueprint API",
    version: "1.0.0",
    description: "A production-ready Elysia API",
  },
} as const;
