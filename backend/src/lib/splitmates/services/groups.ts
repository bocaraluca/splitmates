import type { Id, GroupCategory, GroupRecord } from "../model/types";
import { emitEvent } from "../core/events";
import { findGroupById, findUserByIdentifier, findUserById, getState, nextId } from "../core/state";

interface GroupInput {
  name: string;
  description?: string;
  category: GroupCategory;
}

function ensureUserInGroup(group: GroupRecord, userId: Id) {
  if (!group.memberIds.includes(userId)) {
    throw new Error("User is not a member of this group.");
  }
}

function ensureAdmin(group: GroupRecord, userId: Id) {
  if (!group.adminIds.includes(userId)) {
    throw new Error("Only a group admin can perform this action.");
  }
}

function removeGroupById(groupId: Id) {
  const state = getState();
  const index = state.groups.findIndex((group) => group.id === groupId);
  if (index < 0) {
    return null;
  }

  const [removed] = state.groups.splice(index, 1);
  state.expenses = state.expenses.filter((expense) => expense.groupId !== groupId);
  state.settlements = state.settlements.filter((settlement) => settlement.groupId !== groupId);
  emitEvent("group.deleted", removed);
  return removed;
}

export function createGroup(input: GroupInput, creatorUserId: Id) {
  const creator = findUserById(creatorUserId);
  if (!creator) {
    throw new Error("Creator user was not found.");
  }

  const now = new Date().toISOString();
  const group: GroupRecord = {
    id: nextId("group"),
    name: input.name,
    description: input.description,
    category: input.category,
    createdAt: now,
    updatedAt: now,
    memberIds: [creator.id],
    adminIds: [creator.id],
  };

  getState().groups.push(group);
  emitEvent("group.created", group);
  return group;
}

export function updateGroup(groupId: Id, input: Partial<GroupInput>, actorUserId: Id) {
  const group = findGroupById(groupId);
  if (!group) {
    return null;
  }

  ensureAdmin(group, actorUserId);
  if (input.name) {
    group.name = input.name;
  }
  if (input.description !== undefined) {
    group.description = input.description;
  }
  if (input.category) {
    group.category = input.category;
  }
  group.updatedAt = new Date().toISOString();
  emitEvent("group.updated", group);
  return group;
}

export function deleteGroup(groupId: Id, actorUserId: Id) {
  const group = findGroupById(groupId);
  if (!group) {
    return null;
  }

  ensureAdmin(group, actorUserId);
  return removeGroupById(groupId);
}

export function addMemberToGroup(groupId: Id, identifier: string, actorUserId: Id) {
  const group = findGroupById(groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  ensureAdmin(group, actorUserId);
  const user = findUserByIdentifier(identifier);
  if (!user) {
    throw new Error("No profile exists for that email or username.");
  }

  if (!group.memberIds.includes(user.id)) {
    group.memberIds.push(user.id);
    group.updatedAt = new Date().toISOString();
  }

  emitEvent("group.memberAdded", { groupId, userId: user.id });
  return group;
}

export function removeMemberFromGroup(groupId: Id, targetUserId: Id, actorUserId: Id) {
  const group = findGroupById(groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  if (!group.memberIds.includes(targetUserId)) {
    throw new Error("Target user is not a member of this group.");
  }
  ensureAdmin(group, actorUserId);

  group.memberIds = group.memberIds.filter((memberId) => memberId !== targetUserId);
  group.adminIds = group.adminIds.filter((adminId) => adminId !== targetUserId);

  if (group.memberIds.length > 0 && group.adminIds.length === 0) {
    group.adminIds = [...group.memberIds];
  }

  if (group.memberIds.length === 0) {
    removeGroupById(groupId);
  } else {
    group.updatedAt = new Date().toISOString();
    emitEvent("group.memberRemoved", { groupId, userId: targetUserId });
  }

  return group;
}

export function leaveGroup(groupId: Id, actorUserId: Id) {
  const group = findGroupById(groupId);
  if (!group) {
    throw new Error("Group not found.");
  }

  ensureUserInGroup(group, actorUserId);
  group.memberIds = group.memberIds.filter((memberId) => memberId !== actorUserId);
  group.adminIds = group.adminIds.filter((adminId) => adminId !== actorUserId);

  if (group.memberIds.length > 0 && group.adminIds.length === 0) {
    group.adminIds = [...group.memberIds];
  }

  if (group.memberIds.length === 0) {
    removeGroupById(groupId);
  } else {
    group.updatedAt = new Date().toISOString();
    emitEvent("group.left", { groupId, userId: actorUserId });
  }

  return group;
}

export function listGroups() {
  return [...getState().groups];
}

export function listGroupsForUserId(userId: Id) {
  return getState().groups.filter((group) => group.memberIds.includes(userId));
}

