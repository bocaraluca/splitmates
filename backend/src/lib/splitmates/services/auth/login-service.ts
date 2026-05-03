import bcrypt from "bcryptjs";
import type { LoginResponse } from "@/lib/splitmates/model";
import { prisma } from "@/lib/prisma";
import { createSession } from "./session-service";

export type LoginInput = {
  identifier: string;
  password: string;
};

export async function loginUser(input: LoginInput): Promise<LoginResponse> {
  const identifier = input.identifier.trim().toLowerCase();

  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { username: identifier },
        { email: identifier },
      ],
    },
    include: {
      role: {
        include: {
          rolePermissions: {
            include: {
              permission: true,
            },
          },
        },
      },
    },
  });

  if (!user || !bcrypt.compareSync(input.password, user.passwordHash)) {
    throw new Error("Invalid login credentials.");
  }

  const session = await createSession(user.id);

  return {
    token: session.token,
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    },
    role: user.role.title,
    permissions: user.role.rolePermissions.map((rolePermission) => rolePermission.permission.title),
  };
}