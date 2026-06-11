import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { startGenerator, stopGenerator } from "@/lib/splitmates/services/generator/generator-service";
import { getState } from "@/lib/splitmates/core/state";
import { emitEvent } from "@/lib/splitmates/core/events";
import { createTestGroup, createTestUser, resetDatabase } from "./db-helpers";

vi.mock("@/lib/splitmates/core/events", () => ({
  emitEvent: vi.fn(),
}));

beforeEach(async () => {
  await resetDatabase();

  vi.useFakeTimers();
  vi.clearAllMocks();

  const state = getState();
  state.generator.running = false;
  state.generator.groupId = null;
  state.generator.generatedCount = 0;
  if (state.generator.timer) {
    clearInterval(state.generator.timer);
    state.generator.timer = null;
  }
});

afterEach(() => {
  stopGenerator();
  vi.useRealTimers();
});

async function setupGroupWithMembers() {
  const raluca = await createTestUser("raluca", "raluca@gmail.com");
  const ana = await createTestUser("ana", "ana@gmail.com");
  const elena = await createTestUser("elena", "elena@gmail.com");
  const group = await createTestGroup(
    "Test group",
    raluca.id,
    [raluca.id, ana.id, elena.id],
    [raluca.id],
  );
  return { raluca, ana, elena, group };
}

describe("generator service", () => {
  it("startGenerator updates state and triggers the started event", async () => {
    const { group } = await setupGroupWithMembers();

    const status = await startGenerator(group.id);

    expect(status.running).toBe(true);
    expect(getState().generator.groupId).toBe(group.id);
    expect(emitEvent).toHaveBeenCalledWith("generator.started", expect.any(Object));
  });

  it("creates a fake expense when the interval ticks", async () => {
    const { group } = await setupGroupWithMembers();

    await startGenerator(group.id);

    const initialCount = await prisma.expense.count({ where: { groupId: group.id } });
    expect(initialCount).toBe(0);

    vi.advanceTimersByTime(1500);

    vi.useRealTimers();

    await vi.waitFor(async () => {
      const newCount = await prisma.expense.count({ where: { groupId: group.id } });
      expect(newCount).toBe(1);
    }, { timeout: 3000, interval: 100 });

    expect(getState().generator.generatedCount).toBe(1);
    expect(emitEvent).toHaveBeenCalledWith("generator.expenseCreated", expect.any(Object));
  });

  it("stopGenerator halts the generator and clears the timer", async () => {
    const { group } = await setupGroupWithMembers();

    await startGenerator(group.id);
    expect(getState().generator.running).toBe(true);
    expect(getState().generator.timer).not.toBeNull();

    const status = stopGenerator();

    expect(status.running).toBe(false);
    expect(getState().generator.timer).toBeNull();
    expect(emitEvent).toHaveBeenCalledWith("generator.stopped", expect.any(Object));
  });
});

describe("generator edge cases", () => {
  it("throws an error if starting with a non-existent group id", async () => {
    await expect(startGenerator(99999)).rejects.toThrow("Group not found.");
  });

  it("returns current status and does nothing if already running", async () => {
    const { group } = await setupGroupWithMembers();
    await startGenerator(group.id);

    const status = await startGenerator(group.id);

    expect(status.running).toBe(true);
  });

  it("picks the first available group if no groupId is provided", async () => {
    const { group } = await setupGroupWithMembers();

    await startGenerator();

    vi.advanceTimersByTime(1500);
    vi.useRealTimers();

    await vi.waitFor(async () => {
      const newCount = await prisma.expense.count({ where: { groupId: group.id } });
      expect(newCount).toBe(1);
    }, { timeout: 3000, interval: 100 });
  });

  it("does nothing if the database has no groups", async () => {
    await startGenerator(); 

    vi.advanceTimersByTime(1500);
    vi.useRealTimers();

    await new Promise(resolve => setTimeout(resolve, 100));

    expect(getState().generator.generatedCount).toBe(0);
  });
});