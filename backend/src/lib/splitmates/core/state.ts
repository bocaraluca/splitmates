import { EventEmitter } from "node:events";
import type { Id } from "../model/types";

interface GeneratorState {
  timer: NodeJS.Timeout | null;
  running: boolean;
  generatedCount: number;
  groupId: Id | null;
}

export interface SplitmatesRuntimeState {
  emitter: EventEmitter;
  generator: GeneratorState;
}

const globalScope = globalThis as typeof globalThis & {
  __splitmatesState?: SplitmatesRuntimeState;
};

function createInitialState(): SplitmatesRuntimeState {
  return {
    emitter: new EventEmitter(),
    generator: {
      timer: null,
      running: false,
      generatedCount: 0,
      groupId: null,
    },
  };
}

export function getState(): SplitmatesRuntimeState {
  if (!globalScope.__splitmatesState) {
    globalScope.__splitmatesState = createInitialState();
  }

  return globalScope.__splitmatesState;
}

export function resetSplitmatesStateForTests() {
  if (globalScope.__splitmatesState?.generator.timer) {
    clearInterval(globalScope.__splitmatesState.generator.timer);
  }

  delete globalScope.__splitmatesState;
}
