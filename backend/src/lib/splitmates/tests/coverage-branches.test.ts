import { beforeEach, describe, expect, it, vi } from "vitest";
import * as splitmates from "@/lib/splitmates";
import { GET as dashboardGET } from "@/app/api/dashboard/route";
import { GET as eventsGET } from "@/app/api/events/route";
import { POST as generatorStartPOST } from "@/app/api/generator/start/route";
import { POST as logoutPOST } from "@/app/api/auth/logout/route";
import { SESSION_COOKIE_NAME, resolveToken } from "@/lib/splitmates/services/auth/session";

beforeEach(() => {
  splitmates.resetSplitmatesStateForTests();
  vi.restoreAllMocks();
});

function request(url: string, method: "GET" | "POST" = "GET", body?: unknown, token?: string) {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("coverage branches", () => {
  it("covers analytics and service edge branches", () => {
    const creator = splitmates.getUserRecordByIdentifier("raluca")!;
    const partner = splitmates.getUserRecordByIdentifier("ana")!;

    const balancingGroup = splitmates.createGroup({ name: "Balancing", category: "household" }, creator.id);
    splitmates.addMemberToGroup(balancingGroup.id, partner.username, creator.id);

    splitmates.createExpense(balancingGroup.id, creator.id, {
      title: "Shared bill",
      amount: 100,
      currency: "RON",
      category: "utilities",
      date: new Date().toISOString(),
      paidByUserId: creator.id,
      splitType: "equal",
      memberIds: [creator.id, partner.id],
      shares: [],
    });

    splitmates.createSettlement(balancingGroup.id, creator.id, {
      fromUserId: partner.id,
      toUserId: creator.id,
      amount: 50,
    });

    expect(splitmates.balanceSummaryForUser(creator.id, balancingGroup.id).net).toBe(0);

    const emptyGroup = splitmates.createGroup({ name: "Empty", category: "friends" }, creator.id);
    expect(splitmates.getGroupStats(emptyGroup.id)?.categories).toEqual([]);
    expect(splitmates.getGroupStats(999)).toBeNull();
    expect(() => splitmates.getDashboardSummary(999)).toThrow("User not found.");

    const state = splitmates.getState();
    const savedUsers = state.users;
    state.users = [];
    expect(splitmates.balanceSummaryForUser(creator.id, balancingGroup.id).net).toBe(0);
    state.users = savedUsers;

    const filtered = splitmates.listExpenses(balancingGroup.id, 1, 5, "date", "desc", "other", 999);
    expect(filtered.items).toHaveLength(0);

    const editableExpense = splitmates.createExpense(balancingGroup.id, creator.id, {
      title: "Lunch",
      amount: 20,
      currency: "RON",
      category: "food",
      date: new Date().toISOString(),
      paidByUserId: creator.id,
      splitType: "equal",
      memberIds: [creator.id, partner.id],
      shares: [],
    });

    expect(() =>
      splitmates.updateExpense(balancingGroup.id, editableExpense.id, creator.id, {
        title: "Lunch",
        amount: 20,
        currency: "RON",
        category: "food",
        date: new Date().toISOString(),
        paidByUserId: creator.id,
        splitType: "custom",
        memberIds: [],
        shares: [],
      }),
    ).toThrow("At least one member is required for the split.");

    expect(splitmates.getExpenseDetailForGroup(999, editableExpense.id)).toBeNull();

    expect(() => splitmates.createExpense(999, creator.id, {
      title: "Missing",
      amount: 10,
      currency: "RON",
      category: "other",
      date: new Date().toISOString(),
      paidByUserId: creator.id,
      splitType: "equal",
      memberIds: [creator.id],
      shares: [],
    })).toThrow("Group not found.");

    expect(() => splitmates.removeMemberFromGroup(999, creator.id, creator.id)).toThrow("Group not found.");
    expect(() => splitmates.leaveGroup(999, creator.id)).toThrow("Group not found.");
  });

  it("covers group mutation branches", () => {
    const creator = splitmates.getUserRecordByIdentifier("raluca")!;
    const partner = splitmates.getUserRecordByIdentifier("ana")!;

    const group = splitmates.createGroup({ name: "Mutable", category: "friends" }, creator.id);
    splitmates.addMemberToGroup(group.id, partner.username, creator.id);

    const updated = splitmates.updateGroup(group.id, { description: "Updated", category: "trip" }, creator.id);
    expect(updated?.description).toBe("Updated");
    expect(updated?.category).toBe("trip");

    const removedPartner = splitmates.removeMemberFromGroup(group.id, partner.id, creator.id);
    expect(removedPartner?.memberIds).not.toContain(partner.id);

    const soloGroup = splitmates.createGroup({ name: "Solo remove", category: "friends" }, creator.id);
    expect(splitmates.removeMemberFromGroup(soloGroup.id, creator.id, creator.id)?.id).toBe(soloGroup.id);
    expect(splitmates.getGroupById(soloGroup.id)).toBeNull();
  });

  it("covers route error and cleanup branches", async () => {
    vi.spyOn(splitmates, "getDashboardSummary").mockImplementation(() => {
      throw "dashboard exploded";
    });

    const login = splitmates.loginUser({ identifier: "raluca", password: "raluca" });
    const dashboard = await dashboardGET(request("http://localhost/api/dashboard", "GET", undefined, login.token));
    expect(dashboard.status).toBe(400);

    vi.spyOn(splitmates, "startGenerator").mockImplementation(() => {
      throw "generator exploded";
    });
    const generator = await generatorStartPOST(request("http://localhost/api/generator/start", "POST", { groupId: 1 }));
    expect(generator.status).toBe(400);

    const badLogoutRequest = {
      headers: {
        get() {
          throw new Error("broken headers");
        },
      },
    } as unknown as Request;
    const logout = await logoutPOST(badLogoutRequest);
    expect(logout.status).toBe(400);

    const session = splitmates.loginUser({ identifier: "ana", password: "raluca" });
    const stream = await eventsGET();
    const reader = stream.body?.getReader();
    expect(reader).toBeTruthy();
    const first = await reader!.read();
    expect(new TextDecoder().decode(first.value)).toContain("retry");
    await reader!.cancel();

    expect(resolveToken(session.token)?.username).toBe("ana");
    const cookieRequest = new Request("http://localhost/api/test", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${session.token}` },
    });
    expect(cookieRequest.headers.get("cookie")).toContain(SESSION_COOKIE_NAME);
  });
});
