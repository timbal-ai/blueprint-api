import { t } from "elysia";

export const UserSchema = t.Object({
  id: t.String(),
  name: t.String(),
  email: t.String({ format: "email" }),
  createdAt: t.String({ format: "date-time" }),
});

export const CreateUserSchema = t.Object({
  name: t.String({ minLength: 1 }),
  email: t.String({ format: "email" }),
});

export type User = typeof UserSchema.static;
export type CreateUser = typeof CreateUserSchema.static;
