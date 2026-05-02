import type { Id } from "./ids";

export interface GeneratorStatus {
  running: boolean;
  intervalMs: number;
  generatedCount: number;
  groupId: Id | null;
}

