import { beforeEach, describe, expect, it } from "vitest";
import { GET as graphqlGET, POST as graphqlPOST } from "./route";
import { getUserRecordByIdentifier, resetSplitmatesStateForTests } from "@/lib/splitmates";

beforeEach(() => {
  resetSplitmatesStateForTests();
});

function graphqlRequest(query: string | undefined, variables?: Record<string, unknown>, token?: string) {
  return new Request("http://localhost/api/graphql", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(query === undefined ? { variables } : { query, variables }),
  });
}


async function readJson(response: Response): Promise<Record<string, unknown>> {
  return response.json();
}

describe("graphql api route", () => {
  it("serves the health-style GET response and rejects malformed requests", async () => {
    const response = await graphqlGET();
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, graphql: "/api/graphql" });

    const missingQuery = await graphqlPOST(graphqlRequest(undefined));
    expect(missingQuery.status).toBe(400);
    await expect(readJson(missingQuery)).resolves.toMatchObject({
      errors: [{ message: "Missing GraphQL query." }],
    });

    const malformed = await graphqlPOST(
      new Request("http://localhost/api/graphql", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{ not valid json",
      }),
    );
    expect(malformed.status).toBe(400);
  });

  it("supports public queries and blocks protected mutations", async () => {
    const publicQuery = await graphqlPOST(
      graphqlRequest(
        `query PublicSnapshot {
          me { id username }
          groups { id name category }
          dashboard { userId overall }
          generatorStatus { running intervalMs generatedCount groupId }
        }`,
      ),
    );

    expect(publicQuery.status).toBe(200);
    const publicBody = await readJson(publicQuery);
    expect(publicBody.data.me).toBeNull();
    expect(publicBody.data.groups.length).toBeGreaterThan(0);
    expect(publicBody.data.dashboard.userId).toBeGreaterThan(0);
    expect(publicBody.data.generatorStatus.running).toBe(false);

    const unauthorized = await graphqlPOST(
      graphqlRequest(
        `mutation CreateGroup($input: GroupInput!) {
          createGroup(input: $input) {
            group { id }
          }
        }`,
        { input: { name: "Nope", category: "friends" } },
      ),
    );

    expect(unauthorized.status).toBe(400);
    await expect(readJson(unauthorized)).resolves.toMatchObject({
      errors: [{ message: "You must be logged in." }],
    });
  });

  it("runs authenticated graphql mutations end to end", async () => {
    const partner = getUserRecordByIdentifier("ana")!;

    const registerResponse = await graphqlPOST(
      graphqlRequest(
        `mutation Register($username: String!, $email: String!, $password: String!, $confirmPassword: String!) {
          register(username: $username, email: $email, password: $password, confirmPassword: $confirmPassword) {
            token
            user { id username email }
          }
        }`,
        {
          username: "graphql-user",
          email: "graphql-user@example.com",
          password: "secret123",
          confirmPassword: "secret123",
        },
      ),
    );
    expect(registerResponse.status).toBe(200);
    const registerBody = await readJson(registerResponse);
    const registeredUserId = Number(registerBody.data.register.user.id);

    const loginResponse = await graphqlPOST(
      graphqlRequest(
        `mutation Login($identifier: String!, $password: String!) {
          login(identifier: $identifier, password: $password) {
            token
            user { id username }
          }
        }`,
        { identifier: "graphql-user", password: "secret123" },
      ),
    );
    expect(loginResponse.status).toBe(200);
    const loginBody = await readJson(loginResponse);
    const token = String(loginBody.data.login.token);

    const createGroupResponse = await graphqlPOST(
      graphqlRequest(
        `mutation CreateGroup($input: GroupInput!) {
          createGroup(input: $input) {
            group { id name category memberIds adminIds isMember isAdmin }
          }
        }`,
        { input: { name: "GraphQL Primary", category: "friends" } },
        token,
      ),
    );
    expect(createGroupResponse.status).toBe(200);
    const createGroupBody = await readJson(createGroupResponse);
    const groupId = Number(createGroupBody.data.createGroup.group.id);

    const updateGroupResponse = await graphqlPOST(
      graphqlRequest(
        `mutation UpdateGroup($groupId: Int!, $input: GroupPatchInput!) {
          updateGroup(groupId: $groupId, input: $input) {
            group { id name description category }
          }
        }`,
        { groupId, input: { name: "GraphQL Primary Updated" } },
        token,
      ),
    );
    expect(updateGroupResponse.status).toBe(200);

    const addMemberResponse = await graphqlPOST(
      graphqlRequest(
        `mutation AddMember($groupId: Int!, $identifier: String!) {
          addMember(groupId: $groupId, identifier: $identifier) {
            group { id memberIds adminIds }
          }
        }`,
        { groupId, identifier: partner.username },
        token,
      ),
    );
    expect(addMemberResponse.status).toBe(200);

    const createExpenseResponse = await graphqlPOST(
      graphqlRequest(
        `mutation CreateExpense($groupId: Int!, $input: ExpenseInput!) {
          createExpense(groupId: $groupId, input: $input) {
            expense { id amount splitType memberIds shares { userId amount } }
          }
        }`,
        {
          groupId,
          input: {
            title: "Internet",
            amount: 100,
            currency: "RON",
            category: "utilities",
            date: new Date().toISOString(),
            paidByUserId: registeredUserId,
            splitType: "equal",
            memberIds: [registeredUserId, partner.id],
            shares: [],
          },
        },
        token,
      ),
    );
    expect(createExpenseResponse.status).toBe(200);
    const expenseId = Number((await readJson(createExpenseResponse)).data.createExpense.expense.id);

    const invalidExpensesQuery = await graphqlPOST(
      graphqlRequest(
        `query InvalidExpenses($groupId: Int!) {
          expenses(groupId: $groupId, pagination: { page: 1, pageSize: 8 }) {
            totalItems
          }
        }`,
        { groupId },
        token,
      ),
    );
    expect(invalidExpensesQuery.status).toBe(400);

    const updateExpenseResponse = await graphqlPOST(
      graphqlRequest(
        `mutation UpdateExpense($groupId: Int!, $expenseId: Int!, $input: ExpenseInput!) {
          updateExpense(groupId: $groupId, expenseId: $expenseId, input: $input) {
            expense { id amount splitType memberIds shares { userId amount } }
          }
        }`,
        {
          groupId,
          expenseId,
          input: {
            title: "Internet",
            amount: 120,
            currency: "RON",
            category: "utilities",
            date: new Date().toISOString(),
            paidByUserId: registeredUserId,
            splitType: "custom",
            memberIds: [registeredUserId, partner.id],
            shares: [
              { userId: registeredUserId, amount: 70 },
              { userId: partner.id, amount: 50 },
            ],
          },
        },
        token,
      ),
    );
    expect(updateExpenseResponse.status).toBe(200);

    const queryResponse = await graphqlPOST(
      graphqlRequest(
        `query GroupSnapshot($groupId: Int!, $expenseId: Int!) {
          group(groupId: $groupId) {
            id
            name
            isMember
            isAdmin
          }
          expense(groupId: $groupId, expenseId: $expenseId) {
            id
            title
            amount
            paidBy { id username }
          }
          expenses(groupId: $groupId, pagination: { page: 1, pageSize: 5 }) {
            items { id title amount }
            totalItems
          }
          groupStats(groupId: $groupId) {
            groupId
            totalSpent
            categories { category amount percentage }
          }
        }`,
        { groupId, expenseId },
        token,
      ),
    );
    expect(queryResponse.status).toBe(200);

    const invalidUpdateGroup = await graphqlPOST(
      graphqlRequest(
        `mutation UpdateMissingGroup($groupId: Int!) {
          updateGroup(groupId: $groupId, input: { name: "Nope" }) {
            group { id }
          }
        }`,
        { groupId: 999999 },
        token,
      ),
    );
    expect(invalidUpdateGroup.status).toBe(400);

    const settlementResponse = await graphqlPOST(
      graphqlRequest(
        `mutation CreateSettlement($groupId: Int!, $input: SettlementInput!) {
          createSettlement(groupId: $groupId, input: $input) {
            settlement { id amount fromUserId toUserId }
          }
        }`,
        {
          groupId,
          input: {
            fromUserId: partner.id,
            toUserId: registeredUserId,
            amount: 10,
          },
        },
        token,
      ),
    );
    expect(settlementResponse.status).toBe(200);

    const settlementsResponse = await graphqlPOST(
      graphqlRequest(
        `query Settlements($groupId: Int!) {
          settlements(groupId: $groupId) {
            id
            amount
          }
        }`,
        { groupId },
        token,
      ),
    );
    expect(settlementsResponse.status).toBe(200);

    const invalidDeleteExpense = await graphqlPOST(
      graphqlRequest(
        `mutation DeleteMissingExpense($groupId: Int!, $expenseId: Int!) {
          deleteExpense(groupId: $groupId, expenseId: $expenseId) {
            expense { id }
          }
        }`,
        { groupId, expenseId: 999999 },
        token,
      ),
    );
    expect(invalidDeleteExpense.status).toBe(400);

    const deleteExpenseResponse = await graphqlPOST(
      graphqlRequest(
        `mutation DeleteExpense($groupId: Int!, $expenseId: Int!) {
          deleteExpense(groupId: $groupId, expenseId: $expenseId) {
            expense { id }
          }
        }`,
        { groupId, expenseId },
        token,
      ),
    );
    expect(deleteExpenseResponse.status).toBe(200);

    const generatorStartResponse = await graphqlPOST(
      graphqlRequest(
        `mutation StartGenerator($groupId: Int) {
          startGenerator(groupId: $groupId) {
            status { running intervalMs generatedCount groupId }
          }
        }`,
        { groupId },
        token,
      ),
    );
    expect(generatorStartResponse.status).toBe(200);

    const generatorStopResponse = await graphqlPOST(
      graphqlRequest(
        `mutation StopGenerator {
          stopGenerator {
            status { running intervalMs generatedCount groupId }
          }
        }`,
        undefined,
        token,
      ),
    );
    expect(generatorStopResponse.status).toBe(200);

    const removeMemberResponse = await graphqlPOST(
      graphqlRequest(
        `mutation RemoveMember($groupId: Int!, $userId: Int!) {
          removeMember(groupId: $groupId, userId: $userId) {
            group { id memberIds adminIds }
          }
        }`,
        { groupId, userId: partner.id },
        token,
      ),
    );
    expect(removeMemberResponse.status).toBe(200);

    const leaveGroupResponse = await graphqlPOST(
      graphqlRequest(
        `mutation LeaveGroup($groupId: Int!) {
          leaveGroup(groupId: $groupId) {
            group { id }
          }
        }`,
        { groupId },
        token,
      ),
    );
    expect(leaveGroupResponse.status).toBe(200);

    const disposableGroupResponse = await graphqlPOST(
      graphqlRequest(
        `mutation CreateDisposableGroup($input: GroupInput!) {
          createGroup(input: $input) {
            group { id }
          }
        }`,
        { input: { name: "Disposable", category: "trip" } },
        token,
      ),
    );
    const disposableGroupId = Number((await readJson(disposableGroupResponse)).data.createGroup.group.id);

    const deleteGroupResponse = await graphqlPOST(
      graphqlRequest(
        `mutation DeleteGroup($groupId: Int!) {
          deleteGroup(groupId: $groupId) {
            group { id }
          }
        }`,
        { groupId: disposableGroupId },
        token,
      ),
    );
    expect(deleteGroupResponse.status).toBe(200);
  });
});
