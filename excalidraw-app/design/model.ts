export interface DesignNodeSummary {
  nodeId: string;
  tagName: string;
  id?: string;
  className?: string;
  textPreview?: string;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles?: Record<string, string>;
  children: DesignNodeSummary[];
}

export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  width?: number | "auto";
  height?: number | "auto";
  measuredWidth?: number;
  measuredHeight?: number;
  html: string;
  css?: string;
  backgroundColor?: string;
  locked?: boolean;
  allowMove?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DesignDocument {
  id: string;
  name: string;
  artboards: Artboard[];
  selectedArtboardId?: string | null;
  selectedNodeId?: string | null;
  zoom: number;
  panX: number;
  panY: number;
}

const STORAGE_PREFIX = "synapdraw_design_doc_";
const LEGACY_STORAGE_PREFIX = "excalidraw_design_doc_";

export function loadDesignDocument(
  id: string,
  name: string,
  ownerWindow: Window = window,
): DesignDocument {
  try {
    const storage = ownerWindow.localStorage;
    const raw =
      storage.getItem(`${STORAGE_PREFIX}${id}`) ||
      storage.getItem(`${LEGACY_STORAGE_PREFIX}${id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawArtboards: Artboard[] = Array.isArray(parsed.artboards)
        ? parsed.artboards
        : [];

      // Normalize artboards: fix legacy Hug Contents items that accidentally inherited 1200x800 white boxes
      const artboards = rawArtboards.map((a) => {
        const isHugTitle =
          typeof a.name === "string" &&
          a.name.toLowerCase().includes("hug contents");
        return {
          ...a,
          width: isHugTitle ? "auto" : (a.width ?? "auto"),
          height: isHugTitle ? "auto" : (a.height ?? "auto"),
          backgroundColor: isHugTitle
            ? "transparent"
            : (a.backgroundColor ?? "transparent"),
          locked: a.locked ?? false,
          allowMove: a.allowMove ?? true,
        };
      });

      return {
        id,
        name,
        artboards,
        selectedArtboardId: parsed.selectedArtboardId ?? null,
        selectedNodeId: parsed.selectedNodeId ?? parsed.selectedNodeSelector ?? null,
        zoom: typeof parsed.zoom === "number" ? parsed.zoom : 1,
        panX: typeof parsed.panX === "number" ? parsed.panX : 0,
        panY: typeof parsed.panY === "number" ? parsed.panY : 0,
      };
    }
  } catch (err) {
    console.error("[DesignModel] Error loading document:", err);
  }

  return {
    id,
    name,
    artboards: [],
    selectedArtboardId: null,
    selectedNodeId: null,
    zoom: 1,
    panX: 0,
    panY: 0,
  };
}

export function saveDesignDocument(
  doc: DesignDocument,
  ownerWindow: Window = window,
): void {
  try {
    ownerWindow.localStorage.setItem(
      `${STORAGE_PREFIX}${doc.id}`,
      JSON.stringify(doc),
    );
  } catch (err) {
    console.error("[DesignModel] Error saving document:", err);
  }
}
