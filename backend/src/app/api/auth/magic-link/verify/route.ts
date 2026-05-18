import { z } from "zod";
import { jsonError, jsonSessionOk } from "@/lib/splitmates/api/http";
import { verifyMagicLink } from "@/lib/splitmates/services/auth/magic-link-service";
import { createSession } from "@/lib/splitmates/services/auth/session-service";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(1, "Token is required."),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = schema.parse(body);

    const user = await verifyMagicLink(input.token);

    if (!user) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.AUTH_MAGIC_LINK_VERIFY_INVALID_TOKEN,
        outcome: LogOutcome.failed,
      });
      return jsonError("Invalid or expired magic link.", 400);
    }

    const session = await createSession(user.id);

    const role = await prisma.role.findUnique({
      where: { id: user.roleId },
      include: { rolePermissions: { include: { permission: true } } },
    });

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.AUTH_MAGIC_LINK_VERIFY,
      outcome: LogOutcome.success,
      fallbackUserId: user.id,
    });

    return jsonSessionOk({
      token: session.token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt.toISOString(),
      },
      role: role?.title,
      permissions: role?.rolePermissions.map((rp) => rp.permission.title) ?? [],
    }, session.token);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return jsonError("Request body must be valid JSON.", 400);
    }
    return jsonError("Unable to verify magic link.", 400);
  }
}