import type { CanvasEngine } from "../engine/CanvasEngine";
import {
  type Artboard,
  type DesignDocument,
  type DesignNodeSummary,
  loadDesignDocument,
  saveDesignDocument,
} from "./model";
import {
  extractShadowDomTree,
  sanitizeAndTagDesignHtml,
  sanitizeDesignBackground,
  sanitizeDesignCss,
  updateNodeInHtml,
} from "./sanitize";

export class DesignEngine implements CanvasEngine {
  readonly canvasType = "design" as const;
  private doc: DesignDocument;

  constructor(
    readonly documentId: string,
    private onUpdate?: (doc: DesignDocument) => void,
    private getShadowRoot?: (artboardId: string) => ShadowRoot | null,
    private getOwnerDocument?: () => Document,
  ) {
    const ownerWin = this.getOwnerDocument?.()?.defaultView || window;
    this.doc = loadDesignDocument(documentId, "Tasarım", ownerWin);
  }

  private get docOwner(): Document {
    return this.getOwnerDocument?.() || document;
  }

  private get winOwner(): Window {
    return this.docOwner.defaultView || window;
  }

  getDocument(): DesignDocument {
    return this.doc;
  }

  setDocument(doc: DesignDocument): void {
    this.doc = doc;
    saveDesignDocument(doc, this.winOwner);
    this.onUpdate?.(this.doc);
  }

  supports(eventType: string): boolean {
    return [
      "design",
      "html",
      "clear",
      "artboard",
      "update_node_styles",
    ].includes(eventType);
  }

  private getNextPlacementCoords(): { x: number; y: number } {
    const spacing = 64;
    if (this.doc.artboards.length === 0) {
      return { x: 100, y: 90 };
    }

    let maxRight = -Infinity;
    let anchorY = 90;
    for (const ab of this.doc.artboards) {
      const abW =
        typeof ab.width === "number"
          ? ab.width
          : typeof ab.measuredWidth === "number" && ab.measuredWidth > 0
          ? ab.measuredWidth
          : 440;
      const right = ab.x + abW;
      if (right > maxRight) {
        maxRight = right;
        anchorY = ab.y;
      }
    }

    return {
      x: Math.round(maxRight + spacing),
      y: Math.round(anchorY),
    };
  }

  async applyEvent(
    event: any,
  ): Promise<{ success: boolean; message?: string }> {
    this.doc = loadDesignDocument(
      this.documentId,
      this.doc.name,
      this.winOwner,
    );

    if (event.type === "clear") {
      this.doc.artboards = [];
      this.doc.selectedArtboardId = null;
      this.doc.selectedNodeId = null;
      saveDesignDocument(this.doc, this.winOwner);
      this.onUpdate?.(this.doc);
      return { success: true, message: "Tasarım tuvali temizlendi" };
    }

    if (event.type === "artboard") {
      const width =
        typeof event.width === "number" ? event.width : (event.width ?? 1440);
      const height =
        typeof event.height === "number" ? event.height : (event.height ?? 900);
      const nextPos = this.getNextPlacementCoords();
      const rawHtml =
        event.html ||
        `<div style="padding: 40px;"><h2>${event.name || "Yeni Artboard"}</h2><p>Tasarım bileşenleri buraya aktarılabilir.</p></div>`;
      const sanitizedHtml = sanitizeAndTagDesignHtml(rawHtml, this.docOwner);
      const isLocked = event.locked === true;

      const newArtboard: Artboard = {
        id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: event.name || `Artboard ${this.doc.artboards.length + 1}`,
        x: typeof event.x === "number" ? event.x : nextPos.x,
        y: typeof event.y === "number" ? event.y : nextPos.y,
        width,
        height,
        html: sanitizedHtml,
        css: sanitizeDesignCss(event.css),
        backgroundColor: sanitizeDesignBackground(
          event.backgroundColor ??
            (width === "auto" ? "transparent" : "#ffffff"),
        ),
        locked: isLocked,
        allowMove: event.allowMove !== undefined ? Boolean(event.allowMove) : !isLocked,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      this.doc.artboards.push(newArtboard);
      this.doc.selectedArtboardId = newArtboard.id;
      this.doc.selectedNodeId = null;
      saveDesignDocument(this.doc, this.winOwner);
      this.onUpdate?.(this.doc);
      return {
        success: true,
        message: `Artboard eklendi: ${newArtboard.name} (${width === "auto" ? "Hug" : `${width}×${height}`})`,
      };
    }

    if (event.type === "html" || event.type === "design") {
      const rawHtml = event.html || event.code || "";
      const html = sanitizeAndTagDesignHtml(rawHtml, this.docOwner);
      const css = sanitizeDesignCss(event.css);
      const width: number | "auto" =
        typeof event.width === "number"
          ? event.width
          : event.mode === "mobile"
          ? 390
          : event.mode === "desktop"
          ? 1440
          : "auto";
      const height: number | "auto" =
        typeof event.height === "number"
          ? event.height
          : event.mode === "mobile"
          ? 844
          : "auto";

      // Only update in-place if artboardId is explicitly passed or mode === "replace"
      let target: Artboard | undefined;
      if (event.artboardId) {
        target = this.doc.artboards.find((a) => a.id === event.artboardId);
      } else if (event.mode === "replace" && this.doc.selectedArtboardId) {
        target = this.doc.artboards.find(
          (a) => a.id === this.doc.selectedArtboardId,
        );
      }

      if (target) {
        target.html = html;
        if (event.css !== undefined) {
          target.css = css;
        }
        if (event.title || event.name) {
          target.name = event.title || event.name;
        }
        target.width = width;
        target.height = height;
        target.backgroundColor = sanitizeDesignBackground(
          event.backgroundColor ??
            (width === "auto" ? "transparent" : target.backgroundColor || "#ffffff"),
        );
        target.updatedAt = Date.now();
        this.doc.selectedArtboardId = target.id;
      } else {
        if (event.mode === "replace") {
          this.doc.artboards = [];
        }
        const nextPos = this.getNextPlacementCoords();
        const isLocked = event.locked === true;

        const newArtboard: Artboard = {
          id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name:
            event.title ||
            event.name ||
            `Tasarım ${this.doc.artboards.length + 1}`,
          x: typeof event.x === "number" ? event.x : nextPos.x,
          y: typeof event.y === "number" ? event.y : nextPos.y,
          width,
          height,
          html,
          css,
          backgroundColor: sanitizeDesignBackground(
            event.backgroundColor ??
              (width === "auto" ? "transparent" : "#ffffff"),
          ),
          locked: isLocked,
          allowMove: !isLocked,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        this.doc.artboards.push(newArtboard);
        this.doc.selectedArtboardId = newArtboard.id;
        this.doc.selectedNodeId = null;
      }

      saveDesignDocument(this.doc, this.winOwner);
      this.onUpdate?.(this.doc);
      return {
        success: true,
        message: `Tasarım aktarıldı: ${event.title || event.name || "Bileşen"}`,
      };
    }

    if (event.type === "update_node_styles") {
      const targetArtboard =
        (event.artboardId &&
          this.doc.artboards.find((a) => a.id === event.artboardId)) ||
        (this.doc.selectedArtboardId &&
          this.doc.artboards.find((a) => a.id === this.doc.selectedArtboardId)) ||
        this.doc.artboards[this.doc.artboards.length - 1];

      if (!targetArtboard) {
        return {
          success: false,
          message: "Güncellenecek aktif bir tasarım/artboard bulunamadı",
        };
      }

      const selector = event.selector || event.nodeId;
      if (!selector) {
        return {
          success: false,
          message: "Hedef düğüm seçicisi (selector/nodeId) belirtilmedi",
        };
      }

      const { html: updatedHtml, updatedCount } = updateNodeInHtml(
        targetArtboard.html,
        selector,
        event.styles || {},
        this.docOwner,
        event.textContent,
      );

      if (updatedCount === 0) {
        return {
          success: false,
          message: `Eşleşen düğüm bulunamadı: ${selector}`,
        };
      }

      targetArtboard.html = updatedHtml;
      targetArtboard.updatedAt = Date.now();
      saveDesignDocument(this.doc, this.winOwner);
      this.onUpdate?.(this.doc);

      return {
        success: true,
        message: `Stil güncellendi: ${selector} (${updatedCount} düğüm)`,
      };
    }

    return { success: false, message: `Desteklenmeyen olay: ${event.type}` };
  }

  async getContext(): Promise<any> {
    this.doc = loadDesignDocument(
      this.documentId,
      this.doc.name,
      this.winOwner,
    );

    const artboardsWithTree = this.doc.artboards.map((a) => {
      let domTree: DesignNodeSummary[] = [];
      const shadowRoot = this.getShadowRoot?.(a.id);
      if (shadowRoot) {
        domTree = extractShadowDomTree(shadowRoot, this.doc.zoom);
      }
      return {
        id: a.id,
        name: a.name,
        x: a.x,
        y: a.y,
        width: a.width,
        height: a.height,
        measuredWidth: a.measuredWidth,
        measuredHeight: a.measuredHeight,
        backgroundColor: a.backgroundColor,
        locked: a.locked,
        allowMove: a.allowMove,
        html: a.html,
        css: a.css,
        domTree,
      };
    });

    return {
      canvasType: "design",
      documentId: this.documentId,
      documentName: this.doc.name,
      selectedArtboardId: this.doc.selectedArtboardId,
      selectedNodeId: this.doc.selectedNodeId,
      artboardCount: this.doc.artboards.length,
      artboards: artboardsWithTree,
      totalNodes: this.doc.artboards.length,
    };
  }

  async clear(): Promise<void> {
    this.doc.artboards = [];
    this.doc.selectedArtboardId = null;
    this.doc.selectedNodeId = null;
    saveDesignDocument(this.doc, this.winOwner);
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
