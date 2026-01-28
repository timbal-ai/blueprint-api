import type { User, CreateUser } from "../types/user";

const mockUsers: User[] = [
  {
    id: "1",
    name: "Alice Johnson",
    email: "alice@example.com",
    createdAt: "2024-01-15T10:30:00Z",
  },
  {
    id: "2",
    name: "Bob Smith",
    email: "bob@example.com",
    createdAt: "2024-02-20T14:45:00Z",
  },
  {
    id: "3",
    name: "Charlie Brown",
    email: "charlie@example.com",
    createdAt: "2024-03-10T09:15:00Z",
  },
];

export const userService = {
  getAll(): User[] {
    return mockUsers;
  },

  getById(id: string): User | undefined {
    return mockUsers.find((user) => user.id === id);
  },

  create(data: CreateUser): User {
    const newUser: User = {
      id: String(mockUsers.length + 1),
      ...data,
      createdAt: new Date().toISOString(),
    };
    mockUsers.push(newUser);
    return newUser;
  },

  delete(id: string): boolean {
    const index = mockUsers.findIndex((user) => user.id === id);
    if (index === -1) return false;
    mockUsers.splice(index, 1);
    return true;
  },
};
