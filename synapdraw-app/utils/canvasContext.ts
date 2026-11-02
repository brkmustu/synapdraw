import type {
  ExcalidrawElement,
  NonDeletedExcalidrawElement,
} from "@excalidraw/element/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

export interface CanvasSemanticNode {
  id: string;
  type: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  backgroundColor?: string;
  strokeColor?: string;
  isContainer?: boolean;
  containerId?: string | null;
  boundElements?: Array<{ id: string; type: string }>;
  role?: string;
  locked?: boolean;
  groupIds?: readonly string[];
  frameId?: string | null;
}

export interface CanvasSemanticContext {
  totalElements: number;
  selectedCount: number;
  hasSelection: boolean;
  bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  } | null;
  selectedBounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
  } | null;
  nodes: CanvasSemanticNode[];
}

/**
 * Calculates bounding box for an array of elements.
 */
export function calculateElementsBounds(elements: readonly ExcalidrawElement[]) {
  if (elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const el of elements) {
    if (el.isDeleted) continue;
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + el.width);
    maxY = Math.max(maxY, el.y + el.height);
  }

  if (minX === Infinity) return null;

  return {
    minX: Math.round(minX),
    minY: Math.round(minY),
    maxX: Math.round(maxX),
    maxY: Math.round(maxY),
    width: Math.round(maxX - minX),
    height: Math.round(maxY - minY),
  };
}

/**
 * Extracts a concise semantic summary of the canvas for LLM context.
 */
export function extractCanvasSemanticContext(
  api: ExcalidrawImperativeAPI,
  selectedOnly: boolean = false,
): CanvasSemanticContext {
  const elements = api.getSceneElements().filter((el) => !el.isDeleted);
  const appState = api.getAppState();
  const selectedIds = appState.selectedElementIds || {};

  const selectedElements = elements.filter((el) => selectedIds[el.id]);
  const targetElements = selectedOnly && selectedElements.length > 0 ? selectedElements : elements;

  const totalBounds = calculateElementsBounds(elements);
  const selectedBounds = calculateElementsBounds(selectedElements);

  const textMap = new Map<string, string>();
  for (const el of elements) {
    if (el.type === "text" && "text" in el && typeof (el as any).text === "string") {
      textMap.set(el.id, (el as any).text.trim());
    }
  }

  const nodes: CanvasSemanticNode[] = [];

  for (const el of targetElements) {
    // If it's a bound text element, we include its text on its parent container
    if (el.type === "text" && "containerId" in el && (el as any).containerId) {
      continue;
    }

    let nodeText: string | undefined = undefined;
    if (el.type === "text") {
      nodeText = (el as any).text;
    } else if (el.boundElements?.length) {
      const boundTextId = el.boundElements.find((b) => b.type === "text")?.id;
      if (boundTextId && textMap.has(boundTextId)) {
        nodeText = textMap.get(boundTextId);
      }
    }

    // Deduce semantic role
    let role: string = el.type;
    if (el.type === "rectangle") {
      if (el.height <= 50 && el.width <= 220 && nodeText) {
        role = "button";
      } else if (el.height <= 55 && el.width > 150) {
        role = "input";
      } else if (el.width >= 200 && el.height >= 120) {
        role = "card/container";
      }
    } else if (el.type === "arrow") {
      role = "arrow/connector";
    }

    nodes.push({
      id: el.id,
      type: el.type,
      text: nodeText,
      x: Math.round(el.x),
      y: Math.round(el.y),
      width: Math.round(el.width),
      height: Math.round(el.height),
      backgroundColor: el.backgroundColor !== "transparent" ? el.backgroundColor : undefined,
      strokeColor: el.strokeColor,
      isContainer: !!el.boundElements?.some((b) => b.type === "text"),
      containerId: (el as any).containerId || null,
      role,
      locked: !!el.locked,
      groupIds: el.groupIds,
      frameId: el.frameId || null,
    });
  }

  return {
    totalElements: elements.length,
    selectedCount: selectedElements.length,
    hasSelection: selectedElements.length > 0,
    bounds: totalBounds,
    selectedBounds,
    nodes,
  };
}

/**
 * Formats the semantic context into a compact markdown representation for the LLM.
 */
export function formatContextForPrompt(context: CanvasSemanticContext): string {
  if (context.totalElements === 0) {
    return "Tuval şu an tamamen boş.";
  }

  const lines: string[] = [];
  lines.push(`Mevcut Tuval Özeti (${context.totalElements} eleman):`);
  if (context.bounds) {
    lines.push(
      `- Tuval Alanı: X:[${context.bounds.minX} .. ${context.bounds.maxX}], Y:[${context.bounds.minY} .. ${context.bounds.maxY}] (Genişlik: ${context.bounds.width}px, Yükseklik: ${context.bounds.height}px)`,
    );
  }

  if (context.hasSelection && context.selectedBounds) {
    lines.push(
      `- KULLANICI SEÇİMİ: ${context.selectedCount} eleman seçili. Seçim Alanı: X:[${context.selectedBounds.minX} .. ${context.selectedBounds.maxX}], Y:[${context.selectedBounds.minY} .. ${context.selectedBounds.maxY}]`,
    );
  }

  lines.push(`- Mevcut Başlıca Bileşenler:`);
  for (const node of context.nodes.slice(0, 35)) {
    const textInfo = node.text ? ` "${node.text.replace(/\n/g, " ")}"` : "";
    lines.push(
      `  * [${node.role || node.type}] ID:${node.id}${textInfo} (Konum: x:${node.x}, y:${node.y}, boyut: ${node.width}x${node.height})`,
    );
  }

  if (context.nodes.length > 35) {
    lines.push(`  * ... ve ${context.nodes.length - 35} diğer bileşen.`);
  }

  return lines.join("\n");
}

/**
 * Computes non-overlapping placement coordinates for a new diagram.
 */
export function getSmartPlacementCoords(
  existingElements: readonly ExcalidrawElement[],
  newWidth: number = 600,
  newHeight: number = 400,
  mode: "right" | "bottom" | "replace" = "right",
  selectedBounds?: { minX: number; minY: number; maxX: number; maxY: number } | null,
): { x: number; y: number } {
  if (mode === "replace") {
    if (selectedBounds) {
      return { x: selectedBounds.minX, y: selectedBounds.minY };
    }
    return { x: 100, y: 100 };
  }

  const bounds = calculateElementsBounds(existingElements);
  if (!bounds) {
    return { x: 100, y: 100 };
  }

  const GAP = 120;

  if (mode === "bottom") {
    return {
      x: bounds.minX,
      y: bounds.maxY + GAP,
    };
  }

  // Default: "right"
  return {
    x: bounds.maxX + GAP,
    y: Math.max(bounds.minY, 80),
  };
}
