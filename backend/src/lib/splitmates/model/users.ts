import type { Id } from "./ids";

export interface User {
  id: Id;
  username: string;
  email: string;
  createdAt: string;
}

export interface UserRecord extends User {
  passwordHash: string;
}

export interface SessionRecord {
  token: string;
  userId: Id;
  createdAt: string;
}

