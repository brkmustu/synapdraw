import type { CanvasEngine } from "./CanvasEngine";
import { getActiveWorkspaceId, getSplitWorkspaceId } from "../workspace/workspaceStore";

let fallbackEngine: CanvasEngine | null = null;
const enginesByDocId = new Map<string, CanvasEngine>();
const engineListeners = new Set<(engine: CanvasEngine | null) => void>();

function notifyListeners() {
  const current = getActiveEngine();
  engineListeners.forEach((fn) => fn(current));
}

export function registerActiveEngine(
  engine: CanvasEngine | null,
  documentId?: string,
): void {
  if (!engine) {
    if (documentId) {
      enginesByDocId.delete(documentId);
      if (fallbackEngine?.documentId === documentId) {
        const remaining = Array.from(enginesByDocId.values());
        fallbackEngine = remaining[remaining.length - 1] || null;
      }
    } else {
      fallbackEngine = null;
    }
    notifyListeners();
    return;
  }

  enginesByDocId.set(engine.documentId, engine);
  fallbackEngine = engine;
  notifyListeners();
}

export function unregisterEngine(documentId: string): void {
  registerActiveEngine(null, documentId);
}

export function getActiveEngine(preferredEventType?: string): CanvasEngine | null {
  const activeId = getActiveWorkspaceId();
  const splitId = getSplitWorkspaceId();

  const primary = activeId ? enginesByDocId.get(activeId) || null : null;
  const secondary = splitId ? enginesByDocId.get(splitId) || null : null;

  if (preferredEventType) {
    if (primary && primary.supports(preferredEventType)) {
      return primary;
    }
    if (secondary && secondary.supports(preferredEventType)) {
      return secondary;
    }
    for (const eng of enginesByDocId.values()) {
      if (eng.supports(preferredEventType)) {
        return eng;
      }
    }
  }

  return primary || secondary || fallbackEngine;
}

export function subscribeActiveEngine(
  listener: (engine: CanvasEngine | null) => void,
): () => void {
  engineListeners.add(listener);
  return () => {
    engineListeners.delete(listener);
  };
}

