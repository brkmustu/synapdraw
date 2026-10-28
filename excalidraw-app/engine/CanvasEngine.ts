import type { CanvasType } from "../workspace/workspaceStore";

export interface CanvasEngine {
  readonly canvasType: CanvasType;
  readonly documentId: string;

  /**
   * Applies an incoming broadcast/MCP event to this canvas.
   */
  applyEvent(event: any): Promise<{ success: boolean; message?: string }>;

  /**
   * Returns current semantic context of this canvas for AI tools.
   */
  getContext(): Promise<any>;

  /**
   * Clears all content from the canvas.
   */
  clear(): Promise<void>;

  /**
   * Serializes canvas content for persistence or export.
   */
  exportData(): Promise<any>;

  /**
   * Checks if this engine supports a given event type (e.g. "mermaid", "html", "design").
   */
  supports(eventType: string): boolean;
}
