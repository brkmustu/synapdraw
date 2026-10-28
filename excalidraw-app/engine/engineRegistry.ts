import type { CanvasEngine } from "./CanvasEngine";

let activeEngine: CanvasEngine | null = null;
const engineListeners = new Set<(engine: CanvasEngine | null) => void>();

export function registerActiveEngine(engine: CanvasEngine | null): void {
  activeEngine = engine;
  engineListeners.forEach((fn) => fn(activeEngine));
}

export function getActiveEngine(): CanvasEngine | null {
  return activeEngine;
}

export function subscribeActiveEngine(
  listener: (engine: CanvasEngine | null) => void,
): () => void {
  engineListeners.add(listener);
  return () => {
    engineListeners.delete(listener);
  };
}
