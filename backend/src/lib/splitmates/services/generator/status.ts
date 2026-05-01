import { getState } from "@/lib/splitmates/core/state";
import { GENERATOR_INTERVAL_MS } from "./constants";

export function getGeneratorStatus() {
  const state = getState();
  return {
    running: state.generator.running,
    intervalMs: GENERATOR_INTERVAL_MS,
    generatedCount: state.generator.generatedCount,
    groupId: state.generator.groupId,
  };
}
