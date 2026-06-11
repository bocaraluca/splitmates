import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { getCurrentUserFromRequest } from "@/lib/splitmates";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const actor = await getCurrentUserFromRequest(request);
  if (!actor) return jsonError("Unauthorized.", 401);

  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    select: { id: true, username: true, email: true, stripeAccountId: true, createdAt: true },
  });

  if (!user) return jsonError("User not found.", 404);

  return jsonOk({ user: { ...user, createdAt: user.createdAt.toISOString() } });
}

const updateProfileSchema = z.object({
  username: z.string().min(2).max(32).regex(/^[a-z0-9_]+$/, "Username can only contain lowercase letters, numbers and underscores.").optional(),
  email: z.string().email("Invalid email address.").optional(),
}).refine((data) => data.username || data.email, { message: "Provide at least username or email." });

export async function PATCH(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) return jsonError("Unauthorized.", 401);

    const body = await request.json();
    const input = updateProfileSchema.parse(body);

    if (input.username) {
      const existing = await prisma.user.findFirst({
        where: { username: input.username, NOT: { id: actor.id } },
      });
      if (existing) return jsonError("Username already taken.", 409);
    }

    if (input.email) {
      const existing = await prisma.user.findFirst({
        where: { email: input.email, NOT: { id: actor.id } },
      });
      if (existing) return jsonError("Email already in use.", 409);
    }

    const user = await prisma.user.update({
      where: { id: actor.id },
      data: {
        ...(input.username ? { username: input.username } : {}),
        ...(input.email ? { email: input.email } : {}),
      },
      select: { id: true, username: true, email: true, stripeAccountId: true, createdAt: true },
    });

    return jsonOk({ user: { ...user, createdAt: user.createdAt.toISOString() } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update profile.";
    return jsonError(message, 400);
  }
}
