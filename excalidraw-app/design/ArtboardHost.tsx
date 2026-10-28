import React, { useEffect, useRef } from "react";
import type { Artboard } from "./model";
import "./ArtboardHost.scss";

interface ArtboardHostProps {
  artboard: Artboard;
  isSelected: boolean;
  onSelect: (artboardId: string) => void;
  onMove: (artboardId: string, deltaX: number, deltaY: number) => void;
  onToggleLock: (artboardId: string) => void;
  onToggleMove: (artboardId: string) => void;
  onDelete: (artboardId: string) => void;
}

export const ArtboardHost: React.FC<ArtboardHostProps> = ({
  artboard,
  isSelected,
  onSelect,
  onMove,
  onToggleLock,
  onToggleMove,
  onDelete,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shadowHostRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // Initialize and update Shadow DOM
  useEffect(() => {
    if (!shadowHostRef.current) return;

    if (!shadowRootRef.current) {
      shadowRootRef.current = shadowHostRef.current.attachShadow({ mode: "open" });
    }

    const shadow = shadowRootRef.current;
    const combinedHtml = `
      <style>
        :host {
          display: block;
          width: ${typeof artboard.width === "number" ? `${artboard.width}px` : "fit-content"};
          height: ${typeof artboard.height === "number" ? `${artboard.height}px` : "auto"};
          overflow: visible;
          box-sizing: border-box;
          background: ${artboard.backgroundColor || "transparent"};
          color: #1e293b;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        }
        * {
          box-sizing: border-box;
        }
        ${artboard.css || ""}
      </style>
      <div class="artboard-inner-content">
        ${artboard.html}
      </div>
    `;

    shadow.innerHTML = combinedHtml;
  }, [artboard.html, artboard.css, artboard.backgroundColor, artboard.width, artboard.height]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    e.stopPropagation();
    onSelect(artboard.id);

    // Can only move if allowMove is true OR if not locked
    const canMove = artboard.allowMove || !artboard.locked;
    if (!canMove) return;

    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.x;
      const dy = moveEvent.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      onMove(artboard.id, dx, dy);
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const isMovable = artboard.allowMove || !artboard.locked;

  return (
    <div
      ref={containerRef}
      className={`artboard-host ${isSelected ? "artboard-host--selected" : ""} ${
        artboard.locked ? "artboard-host--locked" : ""
      }`}
      style={{
        transform: `translate3d(${artboard.x}px, ${artboard.y}px, 0)`,
        width: typeof artboard.width === "number" ? `${artboard.width}px` : "fit-content",
        height: typeof artboard.height === "number" ? `${artboard.height}px` : "auto",
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(artboard.id);
      }}
    >
      <div
        className="artboard-header"
        onMouseDown={handleHeaderMouseDown}
        style={{ cursor: isMovable ? "grab" : "default" }}
      >
        <div className="artboard-title-group">
          <span className="artboard-icon">🖼️</span>
          <span className="artboard-name">{artboard.name}</span>
          {typeof artboard.width === "number" && typeof artboard.height === "number" && (
            <span className="artboard-dimensions">
              {artboard.width} × {artboard.height}
            </span>
          )}
        </div>

        <div className="artboard-actions">
          {/* Lock / Unlock Toggle */}
          <button
            type="button"
            className={`action-btn ${artboard.locked ? "action-btn--active" : ""}`}
            title={artboard.locked ? "Kilitli: Değiştirilemez" : "Kilitle"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock(artboard.id);
            }}
          >
            {artboard.locked ? "🔒" : "🔓"}
          </button>

          {/* Move Lock Toggle */}
          <button
            type="button"
            className={`action-btn ${artboard.allowMove ? "action-btn--active" : ""}`}
            title={
              artboard.allowMove
                ? "Taşıma Serbest (Boyutlandırma Kilitli)"
                : "Taşıma Kilitli"
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleMove(artboard.id);
            }}
          >
            {artboard.allowMove ? "✥🔓" : "✥🔒"}
          </button>

          {/* Delete Artboard */}
          <button
            type="button"
            className="action-btn action-btn--danger"
            title="Artboard'ı Sil"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(artboard.id);
            }}
          >
            ✕
          </button>
        </div>
      </div>

      <div className="artboard-body">
        <div ref={shadowHostRef} className="artboard-shadow-host" />
      </div>
    </div>
  );
};
