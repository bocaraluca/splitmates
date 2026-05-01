import { getUsers } from "@/lib/splitmates/core/state";
import type { GroupRecord } from "@/lib/splitmates/model/types";

export function mapGroupForResponse(group: GroupRecord, actorId: number) {
  const users = getUsers();

  return {
    ...group,
    members: group.memberIds.map((memberId) => users.find((user) => user.id === memberId) ?? null),
    admins: group.adminIds.map((adminId) => users.find((user) => user.id === adminId) ?? null),
    isMember: group.memberIds.includes(actorId),
    isAdmin: group.adminIds.includes(actorId),
  };
}
