import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createGroup,
  updateGroup,
  deleteGroup,
  addMemberToGroup,
  removeMemberFromGroup,
  getGroupsForUserId,
  leaveGroup,
  getGroups,
} from "@/lib/splitmates/services/groups-service";
import { createTestUser, resetDatabase } from "./db-helpers";

beforeEach(async () => {
  await resetDatabase();
});

describe("groups CRUD", () => {
  it("createGroup persists a group with the creator as admin", async () => {
    const raluca = await createTestUser("raluca", "raluca@example.com");

    const group = await createGroup(
      { name: "Apartment", description: "Shared rent", category: "household" },
      raluca.id,
    );

    expect(group.id).toBeGreaterThan(0);
    expect(group.adminIds).toEqual([raluca.id]);

    const groupInDb = await prisma.group.findUnique({
      where: { id: group.id },
      include: { members: true },
    });
    expect(groupInDb!.name).toBe("Apartment");
    expect(groupInDb!.members).toHaveLength(1);
    expect(groupInDb!.members[0].isAdmin).toBe(true);
  });

  it("updateGroup persists changes", async () => {
    const raluca = await createTestUser("raluca", "raluca@example.com");
    const group = await createGroup({ name: "Old name", category: "household" }, raluca.id);

    await updateGroup(group.id, { name: "New name" }, raluca.id);

    const updated = await prisma.group.findUnique({ where: { id: group.id } });
    expect(updated!.name).toBe("New name");
  });

  it("deleteGroup removes the group from the database", async () => {
    const raluca = await createTestUser("raluca", "raluca@example.com");
    const group = await createGroup({ name: "To delete", category: "household" }, raluca.id);

    await deleteGroup(group.id, raluca.id);

    const found = await prisma.group.findUnique({ where: { id: group.id } });
    expect(found).toBeNull();
  });

  it("addMemberToGroup adds and persists a new member", async () => {
    const raluca = await createTestUser("raluca", "raluca@example.com");
    const ana = await createTestUser("ana", "ana@example.com");
    const group = await createGroup({ name: "Apartment", category: "household" }, raluca.id);

    await addMemberToGroup(group.id, "ana", raluca.id);

    const members = await prisma.groupMember.findMany({ where: { groupId: group.id } });
    expect(members.map((m) => m.userId).sort()).toEqual([raluca.id, ana.id].sort());
  });

  it("removeMemberFromGroup removes a member", async () => {
    const raluca = await createTestUser("raluca", "raluca@example.com");
    const ana = await createTestUser("ana", "ana@example.com");
    const group = await createGroup({ name: "Apartment", category: "household" }, raluca.id);
    await addMemberToGroup(group.id, "ana", raluca.id);

    await removeMemberFromGroup(group.id, ana.id, raluca.id);

    const members = await prisma.groupMember.findMany({ where: { groupId: group.id } });
    expect(members.map((m) => m.userId)).toEqual([raluca.id]);
  });

  it("getGroupsForUserId returns only groups where the user is a member", async () => {
    const raluca = await createTestUser("raluca", "raluca@example.com");
    const ana = await createTestUser("ana", "ana@example.com");
    await createGroup({ name: "Raluca's group", category: "household" }, raluca.id);
    await createGroup({ name: "Ana's group", category: "trip" }, ana.id);

    const ralucasGroups = await getGroupsForUserId(raluca.id);
    expect(ralucasGroups).toHaveLength(1);
    expect(ralucasGroups[0].name).toBe("Raluca's group");
  });
});

describe("groups error handling and edge cases", () => {
  it("createGroup fails if creator does not exist", async () => {
    await expect(createGroup({ name: "Invalid group", category: "other" }, 99999))
      .rejects.toThrow("Creator user was not found.");
  });

  it("updateGroup enforces admin permissions and missing groups", async () => {
    const raluca = await createTestUser("raluca", "raluca@gmail.com");
    const ana = await createTestUser("ana", "ana@gmail.com");
    const group = await createGroup({ name: "G1", category: "other" }, raluca.id);
    await addMemberToGroup(group.id, "ana", raluca.id);

    expect(await updateGroup(99999, { name: "X" }, raluca.id)).toBeNull();

    await expect(updateGroup(group.id, { name: "X" }, ana.id))
      .rejects.toThrow("Only a group admin can perform this action.");
  });

  it("deleteGroup enforces admin permissions and missing groups", async () => {
    const raluca = await createTestUser("raluca", "raluca@gmail.com");
    const ana = await createTestUser("ana", "ana@gmail.com");
    const group = await createGroup({ name: "G1", category: "other" }, raluca.id);
    await addMemberToGroup(group.id, "ana", raluca.id);

    expect(await deleteGroup(99999, raluca.id)).toBeNull();

    await expect(deleteGroup(group.id, ana.id))
      .rejects.toThrow("Only a group admin can perform this action.");
  });

  it("addMemberToGroup enforces admin, missing groups, and missing users", async () => {
    const raluca = await createTestUser("raluca", "raluca@gmail.com");
    const ana = await createTestUser("ana", "ana@gmail.com");
    const group = await createGroup({ name: "G1", category: "other" }, raluca.id);
    await addMemberToGroup(group.id, "ana", raluca.id);

    await expect(addMemberToGroup(99999, "ana", raluca.id)).rejects.toThrow("Group not found.");
    await expect(addMemberToGroup(group.id, "ghost", raluca.id)).rejects.toThrow("No profile exists for that email or username.");
    await expect(addMemberToGroup(group.id, "ghost", ana.id)).rejects.toThrow("Only a group admin can perform this action.");
  });

  it("removeMemberFromGroup handles errors, admin eupdating, and auto-deletion", async () => {
    const raluca = await createTestUser("raluca", "raluca@gmail.com");
    const ana = await createTestUser("ana", "ana@gmail.com");
    const elena = await createTestUser("elena", "elena@gmail.com");
    const group = await createGroup({ name: "G1", category: "other" }, raluca.id);
    await addMemberToGroup(group.id, "ana", raluca.id);

    await expect(removeMemberFromGroup(99999, ana.id, raluca.id)).rejects.toThrow("Group not found.");
    await expect(removeMemberFromGroup(group.id, elena.id, raluca.id)).rejects.toThrow("Target user is not a member of this group.");
    await expect(removeMemberFromGroup(group.id, raluca.id, ana.id)).rejects.toThrow("Only a group admin can perform this action.");

    await removeMemberFromGroup(group.id, raluca.id, raluca.id);
    const membersPromoted = await prisma.groupMember.findMany({ where: { groupId: group.id } });
    expect(membersPromoted).toHaveLength(1);
    expect(membersPromoted[0].userId).toBe(ana.id);
    expect(membersPromoted[0].isAdmin).toBe(true);

    const result = await removeMemberFromGroup(group.id, ana.id, ana.id);
    expect(result).toBeNull();
    const found = await prisma.group.findUnique({ where: { id: group.id } });
    expect(found).toBeNull();
  });

  it("leaveGroup handles normal exit, errors, admin promotion, and auto-deletion", async () => {
    const raluca = await createTestUser("raluca", "raluca@gmail.com");
    const ana = await createTestUser("ana", "ana@gmail.com");
    const group = await createGroup({ name: "G1", category: "other" }, raluca.id);
    await addMemberToGroup(group.id, "ana", raluca.id);

    await expect(leaveGroup(99999, raluca.id)).rejects.toThrow("Group not found.");
    const stranger = await createTestUser("stranger", "s@gmail.com");
    await expect(leaveGroup(group.id, stranger.id)).rejects.toThrow("User is not a member of this group.");

    await leaveGroup(group.id, raluca.id);
    const membersPromoted = await prisma.groupMember.findMany({ where: { groupId: group.id } });
    expect(membersPromoted).toHaveLength(1);
    expect(membersPromoted[0].userId).toBe(ana.id);
    expect(membersPromoted[0].isAdmin).toBe(true);

    const result = await leaveGroup(group.id, ana.id);
    expect(result).toBeNull();
    const found = await prisma.group.findUnique({ where: { id: group.id } });
    expect(found).toBeNull();
  });

  it("getGroups retrieves all groups regardless of the user", async () => {
    const raluca = await createTestUser("raluca", "raluca@gmail.com");
    const ana = await createTestUser("ana", "ana@gmail.com");
    await createGroup({ name: "Group One", category: "other" }, raluca.id);
    await createGroup({ name: "Group Two", category: "other" }, ana.id);

    const allGroups = await getGroups();
    expect(allGroups).toHaveLength(2);
    expect(allGroups.map(g => g.name).sort()).toEqual(["Group One", "Group Two"].sort());
  });
});