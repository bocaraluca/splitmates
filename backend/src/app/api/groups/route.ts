import { createGroupSchema } from "@/lib/splitmates/validation/schemas";
import { jsonError, jsonOk } from "@/lib/splitmates/api/http";
import { mapGroupForResponse } from "@/lib/splitmates/api/group-response";
import { createGroup, getGroupsForUserId, getGroups, getCurrentUserFromRequest } from "@/lib/splitmates";
import { getUserPermissions } from "@/lib/splitmates/services/auth/permissions-service";
import { prisma } from "@/lib/prisma";
import { logHttpAction } from "@/lib/splitmates/api/http-action-log";
import ACTION_TYPES from "@/lib/splitmates/logging/action-types";
import { LogOutcome } from "@/lib/splitmates/services/logging-service";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const currentUser = await getCurrentUserFromRequest(request);
  if (!currentUser) {
    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUPS_GET_UNAUTHORIZED,
      outcome: LogOutcome.failed,
    });

    return jsonError("You must be logged in to view groups.", 401);
  }

  let groupsRaw: any[];
  const userPermissions = await getUserPermissions(currentUser.id);
  if (userPermissions.role === "admin") {
    groupsRaw = await getGroups();
  } else {
    groupsRaw = await getGroupsForUserId(currentUser.id);
  }

  const allUserIds = [...new Set(groupsRaw.flatMap((g: any) => [...(g.memberIds ?? []), ...(g.adminIds ?? [])]))];
  const allUsers = allUserIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: allUserIds } },
        select: { id: true, username: true, email: true, createdAt: true },
      })
    : [];
  const usersById = new Map(allUsers.map((u) => [u.id, u]));

  const groups = groupsRaw.map((group: any) => {
    const toUser = (id: number) => {
      const u = usersById.get(id);
      return u ? { id: u.id, username: u.username, email: u.email, createdAt: u.createdAt.toISOString() } : null;
    };
    return {
      ...group,
      members: (group.memberIds ?? []).map(toUser),
      admins: (group.adminIds ?? []).map(toUser),
      isMember: (group.memberIds ?? []).includes(currentUser.id),
      isAdmin: (group.adminIds ?? []).includes(currentUser.id),
    };
  });

  void logHttpAction({
    request,
    actionType: ACTION_TYPES.GROUPS_GET,
    outcome: LogOutcome.success,
    fallbackUserId: currentUser.id,
    actionJson: { role: userPermissions.role, count: groups.length },
  });

  return jsonOk({ groups });
}

export async function POST(request: Request) {
  try {
    const actor = await getCurrentUserFromRequest(request);
    if (!actor) {
      void logHttpAction({
        request,
        actionType: ACTION_TYPES.GROUPS_CREATE_UNAUTHORIZED,
        outcome: LogOutcome.failed,
      });

      return jsonError("You must be logged in to create a group.", 401);
    }

    const body = await request.json();
    const input = createGroupSchema.parse(body);
    const group = await createGroup(input, actor.id);

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUPS_CREATE,
      outcome: LogOutcome.success,
      fallbackUserId: actor.id,
      actionJson: { groupId: group.id, name: input.name, category: input.category },
    });

    return jsonOk({ group: await mapGroupForResponse(group, actor.id) }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create group.";

    void logHttpAction({
      request,
      actionType: ACTION_TYPES.GROUPS_CREATE_FAILED,
      outcome: LogOutcome.failed,
      actionJson: { error: message },
    });

    return jsonError(message, 400);
  }
}
