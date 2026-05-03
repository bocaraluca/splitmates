import bcrypt from "bcryptjs";
import type { LoginResponse } from "@/lib/splitmates/model";
import { prisma } from "@/lib/prisma";
import { createSession } from "./session-service";

export type SignupInput = {
  username: string;
  email: string;
  password: string;
};

export async function signupUser(input: SignupInput): Promise<LoginResponse> {
  const username = input.username.trim().toLowerCase();
  const email = input.email.trim().toLowerCase();

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { username },
        { email },
      ],
    },
  });

  if (existingUser) {
    if (existingUser.username.toLowerCase() === username.toLowerCase()) {
      throw new Error("Username already exists.");
    }

    throw new Error("Email already exists.");
  }

  const userRole = await prisma.role.findUnique({ where: { title: "user" } });
  if (!userRole) {
    throw new Error("Default 'user' role is missing. Run the seed first.");
  }

  const user = await prisma.user.create({
    data: {
      username,
      email,
      passwordHash: bcrypt.hashSync(input.password, 10),
      roleId: userRole.id,
    },
  });

  const session = await createSession(user.id);

  return {
    token: session.token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
  };
}
