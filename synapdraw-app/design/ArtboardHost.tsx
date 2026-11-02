import React, { useEffect, useRef, useState } from "react";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import {
  LockedIconFilled,
  MoveUnlockedIcon,
  TrashIcon,
  DuplicateIcon,
  codeIcon,
  frameToolIcon,
  PinIcon,
} from "@excalidraw/excalidraw/components/icons";
import type { Artboard } from "./model";
import {
  sanitizeAndTagDesignHtml,
  sanitizeDesignBackground,
  sanitizeDesignCss,
} from "./sanitize";
import "./ArtboardHost.scss";

interface ArtboardHostProps {
  artboard: Artboard;
  zoom: number;
  activeTool: "select" | "hand" | "inspect";
  isSelected: boolean;
  selectedNodeId: string | null;
  onSelect: (artboardId: string, nodeId?: string | null) => void;
  onMoveStart?: (artboardId: string) => void;
  onMove: (artboardId: string, deltaX: number, deltaY: number) => void;
  onMoveEnd?: (artboardId: string) => void;
  onSetLockMode: (artboardId: string, mode: "full-lock" | "moveable") => void;
  onRename: (artboardId: string, newName: string) => void;
  onDuplicate: (artboardId: string) => void;
  onExportCode: (artboardId: string) => void;
  onDelete: (artboardId: string) => void;
  onMeasuredSize?: (artboardId: string, width: number, height: number) => void;
  onRegisterShadowRoot?: (
    artboardId: string,
    shadowRoot: ShadowRoot | null,
  ) => void;
  linkedTasks?: { id: string; key: string; title: string; status: string }[];
  onOpenLinkedTask?: (taskId: string) => void;
  onContextMenu?: (artboardId: string, event: React.MouseEvent) => void;
}

interface NodeBoxOverlay {
  nodeId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const ArtboardHost: React.FC<ArtboardHostProps> = ({
  artboard,
  zoom,
  activeTool,
  isSelected,
  selectedNodeId,
  onSelect,
  onMoveStart,
  onMove,
  onMoveEnd,
  onSetLockMode,
  onRename,
  onDuplicate,
  onExportCode,
  onDelete,
  onMeasuredSize,
  onRegisterShadowRoot,
  linkedTasks,
  onOpenLinkedTask,
  onContextMenu,
}) => {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const shadowHostRef = useRef<HTMLDivElement | null>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const [isEditingName, setIsEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(artboard.name);
  const [measured, setMeasured] = useState<{ w: number; h: number }>({
    w:
      typeof artboard.width === "number"
        ? artboard.width
        : artboard.measuredWidth || 0,
    h:
      typeof artboard.height === "number"
        ? artboard.height
        : artboard.measuredHeight || 0,
  });

  const [hoveredNodeBox, setHoveredNodeBox] = useState<NodeBoxOverlay | null>(
    null,
  );
  const [selectedNodeBox, setSelectedNodeBox] = useState<NodeBoxOverlay | null>(
    null,
  );

  useEffect(() => {
    setNameDraft(artboard.name);
  }, [artboard.name]);

  // Initialize and update Shadow DOM + ResizeObserver
  useEffect(() => {
    const hostEl = shadowHostRef.current;
    if (!hostEl) return;

    const ownerDoc = hostEl.ownerDocument;
    const ownerWin = ownerDoc.defaultView;

    if (!shadowRootRef.current) {
      shadowRootRef.current = hostEl.attachShadow({ mode: "open" });
      onRegisterShadowRoot?.(artboard.id, shadowRootRef.current);
    }

    const shadow = shadowRootRef.current;
    const safeHtml = sanitizeAndTagDesignHtml(artboard.html, ownerDoc);
    const safeCss = sanitizeDesignCss(artboard.css);

    const isFixedW = typeof artboard.width === "number";
    const isFixedH = typeof artboard.height === "number";
    const bg = sanitizeDesignBackground(artboard.backgroundColor);

    shadow.innerHTML = `<div class="artboard-inner-content">${safeHtml}</div>`;
    const styleEl = ownerDoc.createElement("style");
    styleEl.textContent = `
      :host {
        display: block;
        width: ${isFixedW ? `${artboard.width}px` : "fit-content"};
        height: ${isFixedH ? `${artboard.height}px` : "auto"};
        box-sizing: border-box;
        background: ${bg};
        color: #1b1b1f;
        font-family: Assistant, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      .artboard-inner-content {
        display: ${isFixedW ? "block" : " inline-block"};
        width: ${isFixedW ? "100%" : "fit-content"};
        height: ${isFixedH ? "100%" : "auto"};
      }
      ${safeCss}
    `;
    shadow.prepend(styleEl);

    const innerEl = shadow.querySelector(
      ".artboard-inner-content",
    ) as HTMLElement | null;
    if (!innerEl || !ownerWin) return;

    const measureNow = () => {
      const w = Math.round(
        isFixedW
          ? (artboard.width as number)
          : innerEl.offsetWidth || innerEl.scrollWidth || 0,
      );
      const h = Math.round(
        isFixedH
          ? (artboard.height as number)
          : innerEl.offsetHeight || innerEl.scrollHeight || 0,
      );
      if (w > 0 && h > 0) {
        setMeasured((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
        onMeasuredSize?.(artboard.id, w, h);
      }
    };

    measureNow();
    const RO = (ownerWin as any).ResizeObserver as
      | typeof ResizeObserver
      | undefined;
    let observer: ResizeObserver | null = null;
    if (RO) {
      observer = new RO(() => measureNow());
      observer.observe(innerEl);
    }

    return () => {
      observer?.disconnect();
    };
  }, [
    artboard.id,
    artboard.html,
    artboard.css,
    artboard.backgroundColor,
    artboard.width,
    artboard.height,
    onMeasuredSize,
    onRegisterShadowRoot,
  ]);

  useEffect(() => {
    return () => {
      onRegisterShadowRoot?.(artboard.id, null);
    };
  }, [artboard.id, onRegisterShadowRoot]);

  // Compute selected node overlay box whenever selectedNodeId or measured size changes
  useEffect(() => {
    const shadow = shadowRootRef.current;
    const hostEl = shadowHostRef.current;
    if (!shadow || !hostEl || !isSelected || !selectedNodeId) {
      setSelectedNodeBox(null);
      return;
    }

    const targetEl = shadow.querySelector(
      `[data-node-id="${CSS.escape(selectedNodeId)}"]`,
    );
    if (!targetEl) {
      setSelectedNodeBox(null);
      return;
    }

    const hostRect = hostEl.getBoundingClientRect();
    const elRect = targetEl.getBoundingClientRect();
    const safeZoom = zoom > 0 ? zoom : 1;
    const tag = targetEl.tagName.toLowerCase();
    const cls =
      typeof targetEl.className === "string" && targetEl.className.trim()
        ? `.${targetEl.className.trim().split(/\s+/)[0]}`
        : "";
    const w = Math.round(elRect.width / safeZoom);
    const h = Math.round(elRect.height / safeZoom);

    setSelectedNodeBox({
      nodeId: selectedNodeId,
      label: `${tag}${cls} · ${w} × ${h}`,
      x: Math.round((elRect.left - hostRect.left) / safeZoom),
      y: Math.round((elRect.top - hostRect.top) / safeZoom),
      width: w,
      height: h,
    });
  }, [
    isSelected,
    selectedNodeId,
    measured,
    zoom,
    artboard.html,
    artboard.css,
  ]);

  // Dual-mode lock state matching Excalidraw's UnlockPopup:
  // Full Lock: artboard.locked === true && !artboard.allowMove
  // Moveable Mode: !isFullLocked
  const isFullLocked = Boolean(artboard.locked && !artboard.allowMove);
  const isMovable = !isFullLocked;

  const startDrag = (e: React.MouseEvent) => {
    if (e.button !== 0 || activeTool === "hand") return;
    const ownerDoc = containerRef.current?.ownerDocument;
    if (!ownerDoc) return;

    e.stopPropagation();

    // In inspect mode (or Alt+Click), clicking inside the shadow host inspects the inner DOM element
    if (
      (activeTool === "inspect" || e.altKey) &&
      shadowRootRef.current &&
      shadowHostRef.current &&
      shadowHostRef.current.contains(e.target as Node)
    ) {
      const innerTarget = shadowRootRef.current.elementFromPoint(
        e.clientX,
        e.clientY,
      );
      const tagged = innerTarget?.closest("[data-node-id]");
      if (tagged) {
        const nodeId = tagged.getAttribute("data-node-id");
        onSelect(artboard.id, nodeId);
        return;
      }
    }

    onSelect(artboard.id, null);

    if (!isMovable) return;

    isDraggingRef.current = true;
    hasMovedRef.current = false;
    dragStartRef.current = { x: e.clientX, y: e.clientY };
    const safeZoom = zoom > 0 ? zoom : 1;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const rawDx = moveEvent.clientX - dragStartRef.current.x;
      const rawDy = moveEvent.clientY - dragStartRef.current.y;

      if (!hasMovedRef.current && Math.hypot(rawDx, rawDy) < 3) {
        return;
      }
      if (!hasMovedRef.current) {
        hasMovedRef.current = true;
        onMoveStart?.(artboard.id);
      }

      dragStartRef.current = { x: moveEvent.clientX, y: moveEvent.clientY };
      onMove(artboard.id, rawDx / safeZoom, rawDy / safeZoom);
    };

    const handleMouseUp = () => {
      if (isDraggingRef.current && hasMovedRef.current) {
        onMoveEnd?.(artboard.id);
      }
      isDraggingRef.current = false;
      hasMovedRef.current = false;
      ownerDoc.removeEventListener("mousemove", handleMouseMove);
      ownerDoc.removeEventListener("mouseup", handleMouseUp);
    };

    ownerDoc.addEventListener("mousemove", handleMouseMove);
    ownerDoc.addEventListener("mouseup", handleMouseUp);
  };

  const handleBodyMouseMove = (e: React.MouseEvent) => {
    if (activeTool !== "inspect" && !e.altKey) {
      if (hoveredNodeBox) setHoveredNodeBox(null);
      return;
    }
    const shadow = shadowRootRef.current;
    const hostEl = shadowHostRef.current;
    if (!shadow || !hostEl) return;

    const innerTarget = shadow.elementFromPoint(e.clientX, e.clientY);
    const tagged = innerTarget?.closest("[data-node-id]");
    if (!tagged) {
      setHoveredNodeBox(null);
      return;
    }

    const nodeId = tagged.getAttribute("data-node-id") || "";
    const hostRect = hostEl.getBoundingClientRect();
    const elRect = tagged.getBoundingClientRect();
    const safeZoom = zoom > 0 ? zoom : 1;
    const tag = tagged.tagName.toLowerCase();
    const cls =
      typeof tagged.className === "string" && tagged.className.trim()
        ? `.${tagged.className.trim().split(/\s+/)[0]}`
        : "";
    const w = Math.round(elRect.width / safeZoom);
    const h = Math.round(elRect.height / safeZoom);

    setHoveredNodeBox({
      nodeId,
      label: `${tag}${cls} · ${w} × ${h}`,
      x: Math.round((elRect.left - hostRect.left) / safeZoom),
      y: Math.round((elRect.top - hostRect.top) / safeZoom),
      width: w,
      height: h,
    });
  };

  const commitName = () => {
    setIsEditingName(false);
    if (nameDraft.trim() && nameDraft.trim() !== artboard.name) {
      onRename(artboard.id, nameDraft.trim());
    } else {
      setNameDraft(artboard.name);
    }
  };

  const isHug = artboard.width === "auto" || artboard.width === undefined;
  const hasExplicitBackground =
    Boolean(artboard.backgroundColor) &&
    artboard.backgroundColor !== "transparent";
  const displayW =
    typeof artboard.width === "number" ? artboard.width : measured.w;
  const displayH =
    typeof artboard.height === "number" ? artboard.height : measured.h;

  return (
    <div
      ref={containerRef}
      className={[
        "artboard-host",
        isSelected ? "artboard-host--selected" : "",
        isFullLocked ? "artboard-host--locked" : "artboard-host--moveable",
        hasExplicitBackground ? "artboard-host--has-surface" : "artboard-host--hug-surface",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        transform: `translate3d(${Math.round(artboard.x)}px, ${Math.round(artboard.y)}px, 0)`,
        width:
          typeof artboard.width === "number"
            ? `${artboard.width}px`
            : "fit-content",
        height:
          typeof artboard.height === "number"
            ? `${artboard.height}px`
            : "auto",
        background: hasExplicitBackground
          ? artboard.backgroundColor
          : "transparent",
      }}
      onMouseDown={startDrag}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSelect(artboard.id, null);
        onContextMenu?.(artboard.id, e);
      }}
    >
      {/* Excalidraw Frame-style Header */}
      <div
        className="artboard-header"
        style={{
          cursor:
            activeTool === "hand"
              ? "grab"
              : isMovable
              ? "grab"
              : "default",
        }}
      >
        <div className="artboard-title-group">
          <span className="artboard-icon">{frameToolIcon}</span>
          {isEditingName ? (
            <input
              type="text"
              className="artboard-name-input"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitName();
                if (e.key === "Escape") {
                  setNameDraft(artboard.name);
                  setIsEditingName(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              autoFocus
            />
          ) : (
            <span
              className="artboard-name"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditingName(true);
              }}
              title={t("sdlc.design.doubleClickRenameTitle")}
            >
              {artboard.name}
            </span>
          )}
          {displayW > 0 && displayH > 0 && (
            <span className="artboard-dimensions">
              {displayW} × {displayH}
              {isHug ? " · Hug" : ""}
            </span>
          )}
          {linkedTasks && linkedTasks.length > 0 && (
            <div
              className="artboard-linked-tasks"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                marginLeft: 4,
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
            >
              {linkedTasks.map((lt) => (
                <button
                  key={lt.id}
                  type="button"
                  onClick={() => onOpenLinkedTask?.(lt.id)}
                  title={t("sdlc.design.openTaskInBoardTitle", {
                    key: lt.key,
                    title: lt.title,
                    status: lt.status,
                  })}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 3,
                    padding: "1px 6px",
                    borderRadius: 4,
                    border: "1px solid rgba(91, 87, 209, 0.28)",
                    background: "rgba(91, 87, 209, 0.12)",
                    color: "var(--color-primary, #5b57d1)",
                    fontSize: 10.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    lineHeight: 1.3,
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      width: 11,
                      height: 11,
                    }}
                  >
                    {PinIcon}
                  </span>
                  <span>{lt.key}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Excalidraw UnlockPopup-compatible Dual-Mode Lock & Action Island */}
        <div
          className="artboard-unlock-popup"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left Button: Full Lock (LockedIconFilled) */}
          <button
            type="button"
            className={`artboard-popup-btn ${
              isFullLocked ? "artboard-popup-btn--active" : ""
            }`}
            title={t("sdlc.design.fullLockTitle")}
            onClick={() => onSetLockMode(artboard.id, "full-lock")}
          >
            {LockedIconFilled}
          </button>

          {/* Right Button: Moveable (MoveUnlockedIcon) */}
          <button
            type="button"
            className={`artboard-popup-btn ${
              !isFullLocked ? "artboard-popup-btn--active" : ""
            }`}
            title={t("sdlc.design.moveableLockTitle")}
            onClick={() => onSetLockMode(artboard.id, "moveable")}
          >
            {MoveUnlockedIcon}
          </button>

          <span className="artboard-popup-divider" />

          <button
            type="button"
            className="artboard-popup-btn"
            title={t("sdlc.design.duplicateTitle")}
            onClick={() => onDuplicate(artboard.id)}
          >
            {DuplicateIcon}
          </button>

          <button
            type="button"
            className="artboard-popup-btn"
            title={t("sdlc.design.exportCodeTitle")}
            onClick={() => onExportCode(artboard.id)}
          >
            {codeIcon}
          </button>

          <button
            type="button"
            className="artboard-popup-btn artboard-popup-btn--danger"
            title={t("sdlc.design.deleteDesignTitle")}
            onClick={() => onDelete(artboard.id)}
          >
            {TrashIcon}
          </button>
        </div>
      </div>

      {/* Rendered Shadow DOM Host */}
      <div
        className="artboard-body"
        onMouseMove={handleBodyMouseMove}
        onMouseLeave={() => setHoveredNodeBox(null)}
        style={{
          cursor:
            activeTool === "inspect"
              ? "crosshair"
              : activeTool === "hand"
              ? "grab"
              : isMovable
              ? "grab"
              : "default",
        }}
      >
        <div ref={shadowHostRef} className="artboard-shadow-host" />

        {/* Hover Overlay for Inner DOM Node Inspection */}
        {hoveredNodeBox &&
          hoveredNodeBox.nodeId !== selectedNodeBox?.nodeId && (
            <div
              className="artboard-node-overlay artboard-node-overlay--hover"
              style={{
                left: `${hoveredNodeBox.x}px`,
                top: `${hoveredNodeBox.y}px`,
                width: `${hoveredNodeBox.width}px`,
                height: `${hoveredNodeBox.height}px`,
              }}
            >
              <span className="artboard-node-overlay__tag">
                {hoveredNodeBox.label}
              </span>
            </div>
          )}

        {/* Selected Overlay for Inner DOM Node */}
        {selectedNodeBox && (
          <div
            className="artboard-node-overlay artboard-node-overlay--selected"
            style={{
              left: `${selectedNodeBox.x}px`,
              top: `${selectedNodeBox.y}px`,
              width: `${selectedNodeBox.width}px`,
              height: `${selectedNodeBox.height}px`,
            }}
          >
            <span className="artboard-node-overlay__tag">
              {selectedNodeBox.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
