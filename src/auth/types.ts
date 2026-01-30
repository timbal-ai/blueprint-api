export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthContext {
  user: AuthUser | null;
  accessToken: string | null;
}
