import type { User } from "./users";

export interface LoginResponse {
  token: string;
  user: User;
  role: string;
  permissions: string[];
}
