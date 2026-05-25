import { prisma } from "@/lib/prisma";
import type { GroupCategory } from "../model/types";
import { emitEvent } from "../core/events";
import { requirePermission } from "./auth/permissions-service";

interface GroupInput {
  name: string;
  description?: string;
  category: GroupCategory;
}

async function formatGroupData(group: any, members: any[]): Promise<any> {
  return {
    id: group.id,
    name: group.name,
    description: group.description || null,
    category: group.category,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
    createdByUserId: group.createdByUserId,
    memberIds: members.map((m) => m.userId),
    adminIds: members.filter((m) => m.isAdmin).map((m) => m.userId),
  };
}

export async function createGroup(input: GroupInput, userId: number): Promise<any> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error("Creator user was not found.");
  }

  const group = await prisma.group.create({
    data: {
      name: input.name,
      description: input.description,
      category: input.category,
      createdByUserId: userId,
      members: {
        create: {
          userId: userId,
          isAdmin: true,
        },
      },
    },
    include: {
      members: true,
    },
  });

  const formatted = await formatGroupData(group, group.members);
  emitEvent("group.created", formatted);
  return formatted;
}

export async function updateGroup(groupId: number, input: Partial<GroupInput>, userId: number): Promise<any | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    return null;
  }

  const isAdmin = group.members.some((m) => m.userId === userId && m.isAdmin);
  if (!isAdmin) {
    try {
      await requirePermission(userId, "Edit any group");
    } catch {
      throw new Error("Only a group admin can perform this action.");
    }
  }

  const updated = await prisma.group.update({
    where: { id: groupId },
    data: {
      name: input.name,
      description: input.description !== undefined ? input.description : group.description,
      category: input.category,
    },
    include: { members: true },
  });

  const formatted = await formatGroupData(updated, updated.members);
  emitEvent("group.updated", formatted);
  return formatted;
}

export async function deleteGroup(groupId: number, userId: number): Promise<any | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    return null;
  }

  const isAdmin = group.members.some((m) => m.userId === userId && m.isAdmin);
  if (!isAdmin) {
    try {
      await requirePermission(userId, "Delete any group");
    } catch {
      throw new Error("Only a group admin can perform this action.");
    }
  }

  await prisma.group.delete({ where: { id: groupId } });

  const formatted = await formatGroupData(group, group.members);
  emitEvent("group.deleted", formatted);
  return formatted;
}

export async function addMemberToGroup(groupId: number, identifier: string, userId: number): Promise<any> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    throw new Error("Group not found.");
  }

  const isAdmin = group.members.some((m) => m.userId === userId && m.isAdmin);
  if (!isAdmin) {
    try {
      await requirePermission(userId, "Edit any group");
    } catch {
      throw new Error("Only a group admin can perform this action.");
    }
  }

  const newUser = await prisma.user.findFirst({
    where: {
      OR: [{ username: identifier }, { email: identifier }],
    },
  });

  if (!newUser) {
    throw new Error("No profile exists for that email or username.");
  }

  const alreadyMember = group.members.find((m) => m.userId === newUser.id);
  if (!alreadyMember) {
    await prisma.groupMember.create({
      data: {
        groupId,
        userId: newUser.id,
        isAdmin: false,
      },
    });
  }

  const updatedGroup = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  const formatted = await formatGroupData(updatedGroup!, updatedGroup!.members);
  emitEvent("group.memberAdded", { groupId, userId: newUser.id });
  return formatted;
}

export async function removeMemberFromGroup(groupId: number, memberUserId: number, userId: number): Promise<any | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    throw new Error("Group not found.");
  }

  const memberExists = group.members.find((m) => m.userId === memberUserId);
  if (!memberExists) {
    throw new Error("Target user is not a member of this group.");
  }

  const isAdmin = group.members.some((m) => m.userId === userId && m.isAdmin);
  if (!isAdmin) {
    try {
      await requirePermission(userId, "Edit any group");
    } catch {
      throw new Error("Only a group admin can perform this action.");
    }
  }

  await prisma.groupMember.delete({
    where: {
      groupId_userId: {
        groupId,
        userId: memberUserId,
      },
    },
  });

  const allMembers = await prisma.groupMember.findMany({ where: { groupId } });

  if (allMembers.length === 0) {
    await prisma.group.delete({ where: { id: groupId } });
    return null;
  }

  const adminCount = allMembers.filter((m) => m.isAdmin).length;
  if (adminCount === 0) {
    await prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: allMembers[0]!.userId,
        },
      },
      data: { isAdmin: true },
    });
  }

  const updatedGroup = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  const formatted = await formatGroupData(updatedGroup!, updatedGroup!.members);
  emitEvent("group.memberRemoved", { groupId, userId: memberUserId });
  return formatted;
}

export async function leaveGroup(groupId: number, userId: number): Promise<any | null> {
  const group = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  if (!group) {
    throw new Error("Group not found.");
  }

  const isMember = group.members.some((m) => m.userId === userId);
  if (!isMember) {
    throw new Error("User is not a member of this group.");
  }

  await prisma.groupMember.delete({
    where: {
      groupId_userId: {
        groupId,
        userId: userId,
      },
    },
  });

  const allMembers = await prisma.groupMember.findMany({ where: { groupId } });

  if (allMembers.length === 0) {
    await prisma.group.delete({ where: { id: groupId } });
    return null;
  }

  const adminCount = allMembers.filter((m) => m.isAdmin).length;
  if (adminCount === 0) {
    await prisma.groupMember.update({
      where: {
        groupId_userId: {
          groupId,
          userId: allMembers[0]!.userId,
        },
      },
      data: { isAdmin: true },
    });
  }

  const updatedGroup = await prisma.group.findUnique({
    where: { id: groupId },
    include: { members: true },
  });

  const formatted = await formatGroupData(updatedGroup!, updatedGroup!.members);
  emitEvent("group.left", { groupId, userId: userId });
  return formatted;
}

export async function getGroups(): Promise<any[]> {
  const groups = await prisma.group.findMany({
    include: { members: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Promise.all(groups.map((g) => formatGroupData(g, g.members)));
}

export async function getGroupsForUserId(userId: number): Promise<any[]> {
  const groups = await prisma.group.findMany({
    where: { members: { some: { userId } } },
    include: { members: true },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return Promise.all(groups.map((g) => formatGroupData(g, g.members)));
}