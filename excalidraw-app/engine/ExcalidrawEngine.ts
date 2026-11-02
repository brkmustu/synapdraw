import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { CanvasEngine } from "./CanvasEngine";
import { wrapInContainerFrame } from "../utils/containerHelper";
import { getSmartPlacementCoords, extractCanvasSemanticContext } from "../utils/canvasContext";
import { parseHtmlToExcalidraw } from "../utils/htmlToExcalidraw";

export class ExcalidrawEngine implements CanvasEngine {
  readonly canvasType = "sketch" as const;

  constructor(
    readonly documentId: string,
    private api: ExcalidrawImperativeAPI,
  ) {}

  supports(eventType: string): boolean {
    return ["mermaid", "html", "clear", "update", "elements"].includes(eventType);
  }

  async applyEvent(event: any): Promise<{ success: boolean; message?: string }> {
    if (!this.api) {
      return { success: false, message: "Excalidraw API hazır değil" };
    }

    try {
      if (event.type === "mermaid" && event.code) {
        const { parseMermaidToExcalidraw } = await import(
          "@excalidraw/mermaid-to-excalidraw"
        );
        const { convertToExcalidrawElements, restoreElements } = await import(
          "@excalidraw/excalidraw"
        );

        const result = await parseMermaidToExcalidraw(event.code);
        if (result?.elements && result.elements.length > 0) {
          const currentElements =
            event.mode === "append"
              ? this.api.getSceneElements().filter((el) => !el.isDeleted)
              : [];

          const placement = getSmartPlacementCoords(
            currentElements,
            800,
            500,
            event.mode === "append" ? "right" : "replace",
          );

          const isLocked = event.locked ?? false;
          const containerResult = wrapInContainerFrame(
            result.elements as any,
            {
              title: event.title || "Mermaid Diyagramı",
              originX: placement.x,
              originY: placement.y,
              locked: isLocked,
            },
          );

          const converted = convertToExcalidrawElements(
            containerResult.elements as any,
          );
          const restored = restoreElements(converted, null, {
            repairBindings: true,
            refreshDimensions: true,
          });

          this.api.updateScene({
            elements: [...currentElements, ...restored],
          });
          this.api.setViewport?.({
            target: restored,
            fit: "scale-down",
            animation: true,
          });
          return { success: true, message: `Mermaid aktarıldı (${restored.length} öge)` };
        }
      } else if (event.type === "html" && event.html) {
        const { convertToExcalidrawElements, restoreElements } = await import(
          "@excalidraw/excalidraw"
        );

        const currentElements =
          event.mode === "append"
            ? this.api.getSceneElements().filter((el) => !el.isDeleted)
            : [];

        const placement = getSmartPlacementCoords(
          currentElements,
          960,
          600,
          event.mode === "append" ? "right" : "replace",
        );

        const isLocked = event.locked ?? false;
        const result = parseHtmlToExcalidraw(event.html, {
          originX: placement.x,
          originY: placement.y,
          canvasWidth: 1480,
          frameName: event.title || "UI Wireframe Container",
          createFrame: true,
          createContainerCard: true,
          locked: isLocked,
        });

        if (result?.elements && result.elements.length > 0) {
          const converted = convertToExcalidrawElements(result.elements as any);
          const restored = restoreElements(converted, null, {
            repairBindings: true,
            refreshDimensions: true,
          });
          const currentElements =
            event.mode === "append"
              ? this.api.getSceneElements().filter((el) => !el.isDeleted)
              : [];

          this.api.updateScene({
            elements: [...currentElements, ...restored],
          });
          this.api.setViewport?.({
            target: restored,
            fit: "scale-down",
            animation: true,
          });
          return { success: true, message: `HTML aktarıldı (${restored.length} öge)` };
        }
      } else if (event.type === "elements" && Array.isArray(event.elements)) {
        const { convertToExcalidrawElements, restoreElements } = await import(
          "@excalidraw/excalidraw"
        );
        const processedElements = convertToExcalidrawElements(
          event.elements as any,
          {
            regenerateIds: false,
            renderEnvironment: (this.api as any)?.renderEnvironment,
          },
        );
        const restored = restoreElements(processedElements, null, {
          repairBindings: true,
          refreshDimensions: true,
        });
        const currentElements =
          event.mode === "append"
            ? this.api.getSceneElements().filter((el) => !el.isDeleted)
            : [];
        this.api.updateScene({
          elements: [...currentElements, ...restored],
        });
        this.api.setViewport?.({
          target: restored,
          fit: "scale-down",
          animation: true,
        });
        return {
          success: true,
          message: `Çizim güncellendi (${restored.length} öge)`,
        };
      } else if (event.type === "clear") {
        this.api.resetScene();
        return { success: true, message: "Tuval temizlendi" };
      }

      return { success: false, message: `Desteklenmeyen olay: ${event.type}` };
    } catch (err: any) {
      console.error("[ExcalidrawEngine] Error:", err);
      return { success: false, message: err?.message || "İşlem sırasında hata oluştu" };
    }
  }

  async getContext(): Promise<any> {
    return extractCanvasSemanticContext(this.api);
  }

  async clear(): Promise<void> {
    this.api.resetScene();
  }

  async exportData(): Promise<any> {
    return {
      elements: this.api.getSceneElements(),
      appState: this.api.getAppState(),
    };
  }
}
