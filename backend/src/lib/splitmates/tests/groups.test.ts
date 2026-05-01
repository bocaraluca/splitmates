import { beforeEach, describe, expect, it } from "vitest";
import {
  addMemberToGroup,
  createGroup,
  deleteGroup,
  getGroupById,
  getUserRecordByIdentifier,
  leaveGroup,
  listGroups,
  resetSplitmatesStateForTests,
} from "@/lib/splitmates";

beforeEach(() => {
  resetSplitmatesStateForTests();
});

describe("group workflows", () => {
  it("creates a group with the creator as admin", () => {
    const creator = getUserRecordByIdentifier("raluca");
    const group = createGroup({ name: "Study Group", category: "friends" }, creator!.id);

    expect(group.memberIds).toEqual([creator!.id]);
    expect(group.adminIds).toEqual([creator!.id]);
  });

  it("lets admins add and delete groups", () => {
    const creator = getUserRecordByIdentifier("raluca");
    const group = createGroup({ name: "Housemates", category: "household" }, creator!.id);
    const updated = addMemberToGroup(group.id, "ana", creator!.id);

    expect(updated.memberIds).toContain(getUserRecordByIdentifier("ana")!.id);
    expect(deleteGroup(group.id, creator!.id)?.id).toBe(group.id);
  });

  it("keeps a group alive when the last admin leaves and reassigns admin rights", () => {
    const apartment = listGroups().find((group) => group.name === "Apartment")!;
    const owner = getUserRecordByIdentifier("raluca")!;
    const refreshed = leaveGroup(apartment.id, owner.id);

    expect(refreshed.memberIds).not.toContain(owner.id);
    expect(getGroupById(apartment.id)?.adminIds.length).toBeGreaterThan(0);
  });
});

