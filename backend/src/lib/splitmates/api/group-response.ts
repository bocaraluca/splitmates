import { prisma } from "@/lib/prisma";

interface GroupLike {
  id: number;
  name: string;
  description?: string | null;
  category: string;
  createdAt: Date | string;
  updatedAt?: Date | string;
  memberIds: number[];
  adminIds: number[];
}

export async function mapGroupForResponse(group: GroupLike, actorId: number) {
  const userIds = Array.from(new Set([...group.memberIds, ...group.adminIds]));
  const users = await prisma.user.findMany({ where: { id: { in: userIds } } });
  const usersById = new Map(users.map((user) => [user.id, user]));

  const toUser = (id: number) => {
    const user = usersById.get(id);
    if (!user) return null;
    return {
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt.toISOString(),
    };
  };

  return {
    ...group,
    members: group.memberIds.map((id) => toUser(id)),
    admins: group.adminIds.map((id) => toUser(id)),
    isMember: group.memberIds.includes(actorId),
    isAdmin: group.adminIds.includes(actorId),
  };
}
