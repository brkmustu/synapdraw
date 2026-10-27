export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  width?: number | "auto";
  height?: number | "auto";
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
  selectedNodeSelector?: string | null;
  zoom: number;
  panX: number;
  panY: number;
}

const STORAGE_PREFIX = "excalidraw_design_doc_";

export function loadDesignDocument(id: string, name: string): DesignDocument {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        id,
        name,
        artboards: parsed.artboards || [],
        selectedArtboardId: parsed.selectedArtboardId ?? null,
        selectedNodeSelector: parsed.selectedNodeSelector ?? null,
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
    selectedNodeSelector: null,
    zoom: 1,
    panX: 0,
    panY: 0,
  };
}

export function saveDesignDocument(doc: DesignDocument): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${doc.id}`, JSON.stringify(doc));
  } catch (err) {
    console.error("[DesignModel] Error saving document:", err);
  }
}
