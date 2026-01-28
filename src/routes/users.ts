import { Elysia, t } from "elysia";
import { UserSchema, CreateUserSchema } from "../types/user";
import { userService } from "../services/user.service";

export const userRoutes = new Elysia({ prefix: "/users" })
  .get("/", () => userService.getAll(), {
    response: t.Array(UserSchema),
    detail: {
      summary: "List all users",
      description: "Returns a list of all users",
      tags: ["Users"],
    },
  })
  .get(
    "/:id",
    ({ params, error }) => {
      const user = userService.getById(params.id);
      if (!user) {
        return error(404, { message: "User not found" });
      }
      return user;
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: UserSchema,
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: "Get user by ID",
        description: "Returns a single user by their ID",
        tags: ["Users"],
      },
    }
  )
  .post(
    "/",
    ({ body }) => {
      return userService.create(body);
    },
    {
      body: CreateUserSchema,
      response: UserSchema,
      detail: {
        summary: "Create a new user",
        description: "Creates a new user with the provided data",
        tags: ["Users"],
      },
    }
  )
  .delete(
    "/:id",
    ({ params, error }) => {
      const deleted = userService.delete(params.id);
      if (!deleted) {
        return error(404, { message: "User not found" });
      }
      return { message: "User deleted successfully" };
    },
    {
      params: t.Object({
        id: t.String(),
      }),
      response: {
        200: t.Object({ message: t.String() }),
        404: t.Object({ message: t.String() }),
      },
      detail: {
        summary: "Delete a user",
        description: "Deletes a user by their ID",
        tags: ["Users"],
      },
    }
  );
