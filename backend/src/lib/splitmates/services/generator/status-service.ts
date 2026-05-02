import { getState } from "@/lib/splitmates/core/state";

const GENERATOR_INTERVAL_MS = 1500;

export function getGeneratorStatus() {
  const state = getState();
  return {
    running: state.generator.running,
    intervalMs: GENERATOR_INTERVAL_MS,
    generatedCount: state.generator.generatedCount,
    groupId: state.generator.groupId,
  };
}
