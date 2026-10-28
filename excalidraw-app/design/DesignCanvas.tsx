import React, { useEffect, useState, useRef, useCallback } from "react";
import { registerActiveEngine } from "../engine/engineRegistry";
import { LiveMcpBridge } from "../components/LiveMcpBridge";
import { ArtboardHost } from "./ArtboardHost";
import { DesignEngine } from "./DesignEngine";
import {
  type DesignDocument,
  type Artboard,
  loadDesignDocument,
  saveDesignDocument,
} from "./model";
import "./DesignCanvas.scss";

interface DesignCanvasProps {
  documentId: string;
  documentName: string;
}

export const DesignCanvas: React.FC<DesignCanvasProps> = ({
  documentId,
  documentName,
}) => {
  const [doc, setDoc] = useState<DesignDocument>(() =>
    loadDesignDocument(documentId, documentName),
  );
  const [, setEngineInstance] = useState<DesignEngine | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });
  const viewportRef = useRef<HTMLDivElement | null>(null);

  // Initialize Engine
  useEffect(() => {
    const engine = new DesignEngine(documentId, (updatedDoc) => {
      setDoc({ ...updatedDoc });
    });
    setEngineInstance(engine);
    registerActiveEngine(engine);

    return () => {
      registerActiveEngine(null);
    };
  }, [documentId]);

  // Handle Pan & Zoom (Figma / Excalidraw Style Infinite Canvas)
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      // Zoom into pointer
      const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
      setDoc((prev) => {
        const nextZoom = Math.min(Math.max(prev.zoom * zoomFactor, 0.05), 5);
        const updated = { ...prev, zoom: nextZoom };
        saveDesignDocument(updated);
        return updated;
      });
    } else {
      // Natural two-finger trackpad or wheel pan
      e.preventDefault();
      setDoc((prev) => {
        const updated = {
          ...prev,
          panX: prev.panX - e.deltaX,
          panY: prev.panY - e.deltaY,
        };
        saveDesignDocument(updated);
        return updated;
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Middle click, Space+click, or clicking on empty canvas surface starts pan
    const target = e.target as HTMLElement;
    const isDirectCanvas =
      target === viewportRef.current ||
      target.classList.contains("design-canvas-plane") ||
      target.classList.contains("design-canvas-empty-state");

    if (e.button === 1 || (e.button === 0 && (e.shiftKey || isDirectCanvas))) {
      e.preventDefault();
      setIsPanning(true);
      panStartRef.current = { x: e.clientX - doc.panX, y: e.clientY - doc.panY };
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setDoc((prev) => ({
      ...prev,
      panX: e.clientX - panStartRef.current.x,
      panY: e.clientY - panStartRef.current.y,
    }));
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      saveDesignDocument(doc);
    }
  };

  // Artboard Handlers
  const handleSelectArtboard = useCallback((artboardId: string) => {
    setDoc((prev) => {
      const updated = { ...prev, selectedArtboardId: artboardId };
      saveDesignDocument(updated);
      return updated;
    });
  }, []);

  const handleMoveArtboard = useCallback(
    (artboardId: string, dx: number, dy: number) => {
      setDoc((prev) => {
        const artboards = prev.artboards.map((a) => {
          if (a.id === artboardId) {
            return {
              ...a,
              x: Math.round(a.x + dx),
              y: Math.round(a.y + dy),
              updatedAt: Date.now(),
            };
          }
          return a;
        });
        const updated = { ...prev, artboards };
        saveDesignDocument(updated);
        return updated;
      });
    },
    [],
  );

  const handleToggleLock = useCallback((artboardId: string) => {
    setDoc((prev) => {
      const artboards = prev.artboards.map((a) =>
        a.id === artboardId ? { ...a, locked: !a.locked } : a,
      );
      const updated = { ...prev, artboards };
      saveDesignDocument(updated);
      return updated;
    });
  }, []);

  const handleToggleMove = useCallback((artboardId: string) => {
    setDoc((prev) => {
      const artboards = prev.artboards.map((a) =>
        a.id === artboardId ? { ...a, allowMove: !a.allowMove } : a,
      );
      const updated = { ...prev, artboards };
      saveDesignDocument(updated);
      return updated;
    });
  }, []);

  const handleDeleteArtboard = useCallback((artboardId: string) => {
    setDoc((prev) => {
      const artboards = prev.artboards.filter((a) => a.id !== artboardId);
      const updated = {
        ...prev,
        artboards,
        selectedArtboardId:
          prev.selectedArtboardId === artboardId ? null : prev.selectedArtboardId,
      };
      saveDesignDocument(updated);
      return updated;
    });
  }, []);

  // Zoom controls
  const handleZoomIn = () => {
    setDoc((prev) => {
      const nextZoom = Math.min(prev.zoom * 1.2, 5);
      const updated = { ...prev, zoom: nextZoom };
      saveDesignDocument(updated);
      return updated;
    });
  };

  const handleZoomOut = () => {
    setDoc((prev) => {
      const nextZoom = Math.max(prev.zoom / 1.2, 0.05);
      const updated = { ...prev, zoom: nextZoom };
      saveDesignDocument(updated);
      return updated;
    });
  };

  const handleResetZoom = () => {
    setDoc((prev) => {
      const updated = { ...prev, zoom: 1, panX: 0, panY: 0 };
      saveDesignDocument(updated);
      return updated;
    });
  };

  return (
    <div className="design-canvas-root">
      <div
        ref={viewportRef}
        className={`design-canvas-viewport ${isPanning ? "design-canvas-viewport--panning" : ""}`}
        style={{
          backgroundPosition: `${doc.panX}px ${doc.panY}px`,
          backgroundSize: `${28 * doc.zoom}px ${28 * doc.zoom}px`,
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        {/* Infinite Canvas 2D Plane */}
        <div
          className="design-canvas-plane"
          style={{
            transform: `translate(${doc.panX}px, ${doc.panY}px) scale(${doc.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {doc.artboards.map((artboard) => (
            <ArtboardHost
              key={artboard.id}
              artboard={artboard}
              isSelected={doc.selectedArtboardId === artboard.id}
              onSelect={handleSelectArtboard}
              onMove={handleMoveArtboard}
              onToggleLock={handleToggleLock}
              onToggleMove={handleToggleMove}
              onDelete={handleDeleteArtboard}
            />
          ))}
        </div>

        {/* Empty State when canvas has no items yet */}
        {doc.artboards.length === 0 && (
          <div className="design-canvas-empty-state">
            <div className="empty-icon">🎨</div>
            <h2>{documentName}</h2>
            <p>
              Sonsuz <strong>Tasarım Tuvali</strong>ne hoş geldiniz (Figma Modu).
              Burada tuval tamamen sınırsızdır. AI (MCP) üzerinden aktarılan tasarımlar ve bileşenler,
              doğal boyutlarında (Hug Contents) ve pixel-perfect olarak bu sonsuz düzlemde yer alır.
            </p>
            <div className="feature-tags">
              <span className="tag">♾️ Sonsuz 2D Tuval</span>
              <span className="tag">📐 Hug Contents (Doğal Boyut)</span>
              <span className="tag">✨ Pixel-Perfect DOM</span>
              <span className="tag">🛡️ Shadow DOM İzolasyonu</span>
              <span className="tag">🔒 Serbest / Kilitli Taşıma</span>
            </div>
          </div>
        )}
      </div>

      {/* Floating Canvas Controls (Figma Style) */}
      <div className="design-canvas-toolbar">
        <button
          type="button"
          className="tool-btn"
          onClick={handleZoomOut}
          title="Uzaklaş (-)"
        >
          <span>−</span>
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={handleResetZoom}
          title="Görünümü Sıfırla (%100)"
        >
          <span>🔍</span> {Math.round(doc.zoom * 100)}%
        </button>
        <button
          type="button"
          className="tool-btn"
          onClick={handleZoomIn}
          title="Yakınlaş (+)"
        >
          <span>+</span>
        </button>
        <div className="toolbar-divider" />
        <button
          type="button"
          className="tool-btn"
          onClick={handleResetZoom}
          title="Merkeze Odakla"
        >
          <span>⤢</span> Sıfırla
        </button>
      </div>

      {/* Floating MCP Status Badge */}
      <div className="design-canvas-status-bar">
        <LiveMcpBridge excalidrawAPI={null} forCanvasType="design" />
      </div>
    </div>
  );
};
