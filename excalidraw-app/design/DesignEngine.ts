import type { CanvasEngine } from "../engine/CanvasEngine";
import {
  type Artboard,
  type DesignDocument,
  loadDesignDocument,
  saveDesignDocument,
} from "./model";

export class DesignEngine implements CanvasEngine {
  readonly canvasType = "design" as const;
  private doc: DesignDocument;

  constructor(
    readonly documentId: string,
    private onUpdate?: (doc: DesignDocument) => void,
  ) {
    this.doc = loadDesignDocument(documentId, "Design Document");
  }

  getDocument(): DesignDocument {
    return this.doc;
  }

  setDocument(doc: DesignDocument): void {
    this.doc = doc;
    saveDesignDocument(doc);
    this.onUpdate?.(this.doc);
  }

  supports(eventType: string): boolean {
    return ["design", "html", "clear", "artboard"].includes(eventType);
  }

  async applyEvent(event: any): Promise<{ success: boolean; message?: string }> {
    this.doc = loadDesignDocument(this.documentId, this.doc.name);

    if (event.type === "clear") {
      this.doc.artboards = [];
      saveDesignDocument(this.doc);
      this.onUpdate?.(this.doc);
      return { success: true, message: "Tasarım tuvali temizlendi" };
    }

    if (event.type === "artboard") {
      const width = event.width || 1440;
      const height = event.height || 900;
      const spacing = 80;

      let nextX = 100;
      let nextY = 100;
      if (this.doc.artboards.length > 0) {
        const last = this.doc.artboards[this.doc.artboards.length - 1];
        const lastWidth = typeof last.width === "number" ? last.width : 700;
        nextX = last.x + lastWidth + spacing;
        nextY = last.y;
      }

      const newArtboard: Artboard = {
        id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: event.name || `Artboard ${this.doc.artboards.length + 1}`,
        x: typeof event.x === "number" ? event.x : nextX,
        y: typeof event.y === "number" ? event.y : nextY,
        width,
        height,
        html: event.html || `<div style="padding: 40px; font-family: sans-serif;"><h2>${event.name || "Yeni Artboard"}</h2><p>Tasarımınızı buraya ekleyebilirsiniz.</p></div>`,
        css: event.css || "",
        backgroundColor: event.backgroundColor || "#ffffff",
        locked: event.locked === true,
        allowMove: event.allowMove === true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.doc.artboards.push(newArtboard);
      saveDesignDocument(this.doc);
      this.onUpdate?.(this.doc);
      return {
        success: true,
        message: `Artboard eklendi: ${newArtboard.name} (${width}×${height})`,
      };
    }

    if (event.type === "html" || event.type === "design") {
      const html = event.html || event.code || "";
      const css = event.css || "";
      const width = event.width ?? (event.mode === "mobile" ? 390 : "auto");
      const height = event.height ?? (event.mode === "mobile" ? 844 : "auto");

      // Check if target artboard exists
      let target: Artboard | undefined;
      if (event.artboardId) {
        target = this.doc.artboards.find((a) => a.id === event.artboardId);
      } else if (this.doc.selectedArtboardId) {
        target = this.doc.artboards.find((a) => a.id === this.doc.selectedArtboardId);
      }

      if (target) {
        target.html = html;
        if (css) target.css = css;
        if (event.title) target.name = event.title;
        if (event.width) target.width = event.width;
        if (event.height) target.height = event.height;
        target.updatedAt = Date.now();
      } else {
        const spacing = 80;
        let nextX = 100;
        let nextY = 100;
        if (this.doc.artboards.length > 0) {
          const last = this.doc.artboards[this.doc.artboards.length - 1];
          const lastWidth = typeof last.width === "number" ? last.width : 700;
          nextX = last.x + lastWidth + spacing;
          nextY = last.y;
        }

        const newArtboard: Artboard = {
          id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: event.title || event.name || `Tasarım ${this.doc.artboards.length + 1}`,
          x: typeof event.x === "number" ? event.x : nextX,
          y: typeof event.y === "number" ? event.y : nextY,
          width,
          height,
          html,
          css,
          backgroundColor: event.backgroundColor || "transparent",
          locked: false,
          allowMove: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.doc.artboards.push(newArtboard);
        this.doc.selectedArtboardId = newArtboard.id;
      }

      saveDesignDocument(this.doc);
      this.onUpdate?.(this.doc);
      return { success: true, message: `Tasarım tuvale aktarıldı: ${event.title || "Bileşen"}` };
    }

    return { success: false, message: `Desteklenmeyen olay: ${event.type}` };
  }

  async getContext(): Promise<any> {
    this.doc = loadDesignDocument(this.documentId, this.doc.name);
    return {
      canvasType: "design",
      documentId: this.documentId,
      artboardCount: this.doc.artboards.length,
      artboards: this.doc.artboards.map((a) => ({
        id: a.id,
        name: a.name,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        locked: a.locked,
        allowMove: a.allowMove,
      })),
      totalNodes: this.doc.artboards.length,
    };
  }

  async clear(): Promise<void> {
    this.doc.artboards = [];
    saveDesignDocument(this.doc);
    this.onUpdate?.(this.doc);
  }

  async exportData(): Promise<any> {
    return {
      type: "design_document",
      documentId: this.documentId,
      document: this.doc,
    };
  }
}
