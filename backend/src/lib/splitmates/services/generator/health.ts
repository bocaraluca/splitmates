import { getState } from "@/lib/splitmates/core/state";
import { getGeneratorStatus } from "./status";

export function getHealthSnapshot() {
  const state = getState();
  return {
    users: state.users.length,
    groups: state.groups.length,
    expenses: state.expenses.length,
    settlements: state.settlements.length,
    generator: getGeneratorStatus(),
  };
}
