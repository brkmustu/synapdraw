export type CanvasType = "sketch" | "design";

export interface WorkspaceDocument {
  id: string;
  name: string;
  canvasType: CanvasType;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY_WORKSPACES = "synapdraw_workspaces";
const STORAGE_KEY_ACTIVE_ID = "synapdraw_active_workspace_id";

// Listeners for reactive updates
type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeWorkspaces(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getWorkspaces(): WorkspaceDocument[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORKSPACES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[WorkspaceStore] Failed to read workspaces:", err);
  }

  // Initial migration: create default sketch workspace with existing canvas data
  const defaultWs: WorkspaceDocument = {
    id: "ws_default_sketch",
    name: "Çizim 1",
    canvasType: "sketch",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    // Preserve existing legacy elements into default workspace storage
    const legacyElements = localStorage.getItem("excalidraw");
    if (legacyElements) {
      localStorage.setItem(`synapdraw_ws_${defaultWs.id}_elements`, legacyElements);
    }
    const legacyState = localStorage.getItem("excalidraw-state");
    if (legacyState) {
      localStorage.setItem(`synapdraw_ws_${defaultWs.id}_state`, legacyState);
    }

    localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify([defaultWs]));
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, defaultWs.id);
  } catch (err) {
    console.error("[WorkspaceStore] Migration error:", err);
  }

  return [defaultWs];
}

export function getActiveWorkspaceId(): string {
  const workspaces = getWorkspaces();
  const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
  if (savedId && workspaces.some((w) => w.id === savedId)) {
    return savedId;
  }
  const fallback = workspaces[0]?.id || "ws_default_sketch";
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, fallback);
  return fallback;
}

export function getActiveWorkspace(): WorkspaceDocument {
  const workspaces = getWorkspaces();
  const activeId = getActiveWorkspaceId();
  return workspaces.find((w) => w.id === activeId) || workspaces[0];
}

export function setActiveWorkspaceId(id: string): void {
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
  notify();
}

export function createWorkspace(
  name: string,
  canvasType: CanvasType,
): WorkspaceDocument {
  const workspaces = getWorkspaces();
  const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const cleanName = name.trim() || (canvasType === "design" ? "Tasarım" : "Çizim");

  const newDoc: WorkspaceDocument = {
    id,
    name: cleanName,
    canvasType,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updated = [...workspaces, newDoc];
  localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(updated));
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
  notify();
  return newDoc;
}

export function deleteWorkspace(id: string): boolean {
  const workspaces = getWorkspaces();
  if (workspaces.length <= 1) {
    return false; // Prevent deleting the last workspace
  }

  const updated = workspaces.filter((w) => w.id !== id);
  localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(updated));

  // Clean up storage for deleted workspace
  try {
    localStorage.removeItem(`synapdraw_ws_${id}_elements`);
    localStorage.removeItem(`synapdraw_ws_${id}_state`);
    localStorage.removeItem(`synapdraw_design_doc_${id}`);
  } catch {}

  const activeId = getActiveWorkspaceId();
  if (activeId === id) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, updated[0].id);
  }

  notify();
  return true;
}

export function renameWorkspace(id: string, newName: string): void {
  const workspaces = getWorkspaces();
  const target = workspaces.find((w) => w.id === id);
  if (!target || !newName.trim()) return;

  target.name = newName.trim();
  target.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(workspaces));
  notify();
}
