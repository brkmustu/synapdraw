import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  SelectionIcon,
  handIcon,
  searchIcon,
  DeviceDesktopIcon,
  frameToolIcon,
  ZoomInIcon,
  ZoomOutIcon,
  UndoIcon,
  RedoIcon,
  fullscreenIcon,
  brainIcon,
  sidebarRightIcon,
  adjustmentsIcon,
  TrashIcon,
} from "@excalidraw/excalidraw/components/icons";
import { registerActiveEngine } from "../engine/engineRegistry";
import { LiveMcpBridge } from "../components/LiveMcpBridge";
import { ArtboardHost } from "./ArtboardHost";
import { DesignEngine } from "./DesignEngine";
import { DesignHistory } from "./history";
import {
  DesignLayersPanel,
  DesignInspectorPanel,
} from "./DesignInspector";
import {
  type DesignDocument,
  type Artboard,
  type DesignNodeSummary,
  loadDesignDocument,
  saveDesignDocument,
} from "./model";
import {
  extractShadowDomTree,
  sanitizeAndTagDesignHtml,
  updateNodeInHtml,
} from "./sanitize";
import "./DesignCanvas.scss";

interface DesignCanvasProps {
  documentId: string;
  documentName: string;
  onOpenAIIntegrations?: () => void;
}

export const DesignCanvas: React.FC<DesignCanvasProps> = ({
  documentId,
  documentName,
  onOpenAIIntegrations,
}) => {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const shadowRootsRef = useRef<Map<string, ShadowRoot>>(new Map());
  const historyRef = useRef<DesignHistory>(new DesignHistory());

  const [doc, setDoc] = useState<DesignDocument>(() =>
    loadDesignDocument(documentId, documentName),
  );
  const [activeTool, setActiveTool] = useState<"select" | "hand" | "inspect">(
    "select",
  );
  const [isPanning, setIsPanning] = useState(false);
  const [showLayers, setShowLayers] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [domTree, setDomTree] = useState<DesignNodeSummary[]>([]);
  const [, setHistoryTick] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const panStartRef = useRef({ x: 0, y: 0 });

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2600);
  }, []);

  const getOwnerDoc = useCallback((): Document => {
    return rootRef.current?.ownerDocument || document;
  }, []);

  const getOwnerWin = useCallback((): Window & typeof globalThis => {
    return (getOwnerDoc().defaultView || window) as Window & typeof globalThis;
  }, [getOwnerDoc]);

  const refreshSelectedDomTree = useCallback(
    (selectedAbId: string | null | undefined, currentZoom: number) => {
      if (!selectedAbId) {
        setDomTree([]);
        return;
      }
      const sr = shadowRootsRef.current.get(selectedAbId);
      if (!sr) {
        setDomTree([]);
        return;
      }
      setDomTree(extractShadowDomTree(sr, currentZoom));
    },
    [],
  );

  // Reload document when documentId changes
  useEffect(() => {
    const ownerWin = getOwnerWin();
    const loaded = loadDesignDocument(documentId, documentName, ownerWin);
    historyRef.current.clear();
    setDoc(loaded);
    setHistoryTick((t) => t + 1);
  }, [documentId, documentName, getOwnerWin]);

  // Register DesignEngine for Live MCP & AI Studio
  useEffect(() => {
    const engine = new DesignEngine(
      documentId,
      (updatedDoc) => {
        historyRef.current.push({
          artboards: doc.artboards,
          selectedArtboardId: doc.selectedArtboardId,
          selectedNodeId: doc.selectedNodeId,
        });
        setDoc({ ...updatedDoc });
        setHistoryTick((t) => t + 1);
        setTimeout(() => {
          refreshSelectedDomTree(
            updatedDoc.selectedArtboardId,
            updatedDoc.zoom,
          );
        }, 60);
      },
      (artboardId) => shadowRootsRef.current.get(artboardId) || null,
      getOwnerDoc,
    );
    registerActiveEngine(engine);

    return () => {
      registerActiveEngine(null);
    };
  }, [documentId, getOwnerDoc, refreshSelectedDomTree]);

  // Refresh DOM tree when selection or artboards change
  useEffect(() => {
    const timer = setTimeout(() => {
      refreshSelectedDomTree(doc.selectedArtboardId, doc.zoom);
    }, 40);
    return () => clearTimeout(timer);
  }, [doc.selectedArtboardId, doc.artboards, doc.zoom, refreshSelectedDomTree]);

  const pushHistoryBeforeMutation = useCallback((currentDoc: DesignDocument) => {
    historyRef.current.push({
      artboards: currentDoc.artboards,
      selectedArtboardId: currentDoc.selectedArtboardId,
      selectedNodeId: currentDoc.selectedNodeId,
    });
    setHistoryTick((t) => t + 1);
  }, []);

  const handleUndo = useCallback(() => {
    setDoc((prev) => {
      const restored = historyRef.current.undo({
        artboards: prev.artboards,
        selectedArtboardId: prev.selectedArtboardId,
        selectedNodeId: prev.selectedNodeId,
      });
      if (!restored) return prev;
      const updated: DesignDocument = {
        ...prev,
        artboards: restored.artboards,
        selectedArtboardId: restored.selectedArtboardId,
        selectedNodeId: restored.selectedNodeId,
      };
      saveDesignDocument(updated, getOwnerWin());
      setHistoryTick((t) => t + 1);
      return updated;
    });
  }, [getOwnerWin]);

  const handleRedo = useCallback(() => {
    setDoc((prev) => {
      const restored = historyRef.current.redo({
        artboards: prev.artboards,
        selectedArtboardId: prev.selectedArtboardId,
        selectedNodeId: prev.selectedNodeId,
      });
      if (!restored) return prev;
      const updated: DesignDocument = {
        ...prev,
        artboards: restored.artboards,
        selectedArtboardId: restored.selectedArtboardId,
        selectedNodeId: restored.selectedNodeId,
      };
      saveDesignDocument(updated, getOwnerWin());
      setHistoryTick((t) => t + 1);
      return updated;
    });
  }, [getOwnerWin]);

  // Keyboard shortcuts (Undo, Redo, Tool switching, Delete)
  useEffect(() => {
    const ownerDoc = getOwnerDoc();
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (!e.ctrlKey && !e.metaKey && !e.altKey) {
        if (e.key.toLowerCase() === "v" || e.key === "1") {
          setActiveTool("select");
        } else if (e.key.toLowerCase() === "h") {
          setActiveTool("hand");
        } else if (e.key.toLowerCase() === "i") {
          setActiveTool("inspect");
        }
      }
    };

    ownerDoc.addEventListener("keydown", onKeyDown);
    return () => ownerDoc.removeEventListener("keydown", onKeyDown);
  }, [getOwnerDoc, handleUndo, handleRedo]);

  // Pan & Zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const rect = viewportRef.current?.getBoundingClientRect();
      const pointerX = rect ? e.clientX - rect.left : e.clientX;
      const pointerY = rect ? e.clientY - rect.top : e.clientY;
      const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;

      setDoc((prev) => {
        const nextZoom = Math.min(Math.max(prev.zoom * zoomFactor, 0.1), 5);
        const scaleChange = nextZoom / prev.zoom;
        const nextPanX = pointerX - (pointerX - prev.panX) * scaleChange;
        const nextPanY = pointerY - (pointerY - prev.panY) * scaleChange;
        const updated = {
          ...prev,
          zoom: nextZoom,
          panX: Math.round(nextPanX),
          panY: Math.round(nextPanY),
        };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    } else {
      e.preventDefault();
      setDoc((prev) => {
        const updated = {
          ...prev,
          panX: prev.panX - e.deltaX,
          panY: prev.panY - e.deltaY,
        };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    const isDirectCanvas =
      target === viewportRef.current ||
      target.classList.contains("design-canvas-plane");

    if (
      e.button === 1 ||
      activeTool === "hand" ||
      (e.button === 0 && (e.shiftKey || isDirectCanvas))
    ) {
      e.preventDefault();
      if (isDirectCanvas && e.button === 0 && activeTool !== "hand") {
        setDoc((prev) => {
          if (!prev.selectedArtboardId && !prev.selectedNodeId) return prev;
          const updated = {
            ...prev,
            selectedArtboardId: null,
            selectedNodeId: null,
          };
          saveDesignDocument(updated, getOwnerWin());
          return updated;
        });
      }
      setIsPanning(true);
      panStartRef.current = {
        x: e.clientX - doc.panX,
        y: e.clientY - doc.panY,
      };
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
      saveDesignDocument(doc, getOwnerWin());
    }
  };

  // Artboard callbacks
  const handleRegisterShadowRoot = useCallback(
    (artboardId: string, sr: ShadowRoot | null) => {
      if (sr) {
        shadowRootsRef.current.set(artboardId, sr);
      } else {
        shadowRootsRef.current.delete(artboardId);
      }
    },
    [],
  );

  const handleMeasuredSize = useCallback(
    (artboardId: string, width: number, height: number) => {
      setDoc((prev) => {
        const target = prev.artboards.find((a) => a.id === artboardId);
        if (
          !target ||
          (target.measuredWidth === width && target.measuredHeight === height)
        ) {
          return prev;
        }
        const artboards = prev.artboards.map((a) =>
          a.id === artboardId
            ? { ...a, measuredWidth: width, measuredHeight: height }
            : a,
        );
        const updated = { ...prev, artboards };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [getOwnerWin],
  );

  const handleSelectArtboard = useCallback(
    (artboardId: string, nodeId: string | null = null) => {
      setDoc((prev) => {
        if (
          prev.selectedArtboardId === artboardId &&
          prev.selectedNodeId === nodeId
        ) {
          return prev;
        }
        const updated = {
          ...prev,
          selectedArtboardId: artboardId,
          selectedNodeId: nodeId,
        };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [getOwnerWin],
  );

  const handleMoveStart = useCallback(
    (_artboardId: string) => {
      pushHistoryBeforeMutation(doc);
    },
    [doc, pushHistoryBeforeMutation],
  );

  const handleMoveArtboard = useCallback(
    (artboardId: string, dx: number, dy: number) => {
      setDoc((prev) => {
        const artboards = prev.artboards.map((a) =>
          a.id === artboardId
            ? {
                ...a,
                x: a.x + dx,
                y: a.y + dy,
                updatedAt: Date.now(),
              }
            : a,
        );
        return { ...prev, artboards };
      });
    },
    [],
  );

  const handleMoveEnd = useCallback(
    (_artboardId: string) => {
      setDoc((prev) => {
        const artboards = prev.artboards.map((a) => ({
          ...a,
          x: Math.round(a.x),
          y: Math.round(a.y),
        }));
        const updated = { ...prev, artboards };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [getOwnerWin],
  );

  const handleSetLockMode = useCallback(
    (artboardId: string, mode: "full-lock" | "moveable") => {
      setDoc((prev) => {
        pushHistoryBeforeMutation(prev);
        const artboards = prev.artboards.map((a) => {
          if (a.id !== artboardId) return a;
          if (mode === "full-lock") {
            return { ...a, locked: true, allowMove: false };
          }
          return { ...a, locked: false, allowMove: true };
        });
        const updated = { ...prev, artboards };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [getOwnerWin, pushHistoryBeforeMutation],
  );

  const handleRenameArtboard = useCallback(
    (artboardId: string, newName: string) => {
      setDoc((prev) => {
        pushHistoryBeforeMutation(prev);
        const artboards = prev.artboards.map((a) =>
          a.id === artboardId
            ? { ...a, name: newName, updatedAt: Date.now() }
            : a,
        );
        const updated = { ...prev, artboards };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [getOwnerWin, pushHistoryBeforeMutation],
  );

  const handleUpdateArtboard = useCallback(
    (artboardId: string, patch: Partial<Artboard>) => {
      setDoc((prev) => {
        pushHistoryBeforeMutation(prev);
        const artboards = prev.artboards.map((a) =>
          a.id === artboardId
            ? { ...a, ...patch, updatedAt: Date.now() }
            : a,
        );
        const updated = { ...prev, artboards };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [getOwnerWin, pushHistoryBeforeMutation],
  );

  const handleUpdateNodeStyle = useCallback(
    (
      artboardId: string,
      nodeId: string,
      styles: Record<string, string>,
      textContent?: string,
    ) => {
      const ownerDoc = getOwnerDoc();
      setDoc((prev) => {
        const target = prev.artboards.find((a) => a.id === artboardId);
        if (!target) return prev;
        pushHistoryBeforeMutation(prev);
        const { html: nextHtml } = updateNodeInHtml(
          target.html,
          nodeId,
          styles,
          ownerDoc,
          textContent,
        );
        const artboards = prev.artboards.map((a) =>
          a.id === artboardId
            ? { ...a, html: nextHtml, updatedAt: Date.now() }
            : a,
        );
        const updated = { ...prev, artboards };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [getOwnerDoc, getOwnerWin, pushHistoryBeforeMutation],
  );

  const handleDuplicateArtboard = useCallback(
    (artboardId: string) => {
      setDoc((prev) => {
        const source = prev.artboards.find((a) => a.id === artboardId);
        if (!source) return prev;
        pushHistoryBeforeMutation(prev);
        const offsetW =
          typeof source.width === "number"
            ? source.width
            : source.measuredWidth || 420;
        const copy: Artboard = {
          ...source,
          id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          name: `${source.name} (Kopya)`,
          x: Math.round(source.x + offsetW + 48),
          y: Math.round(source.y),
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        const updated: DesignDocument = {
          ...prev,
          artboards: [...prev.artboards, copy],
          selectedArtboardId: copy.id,
          selectedNodeId: null,
        };
        saveDesignDocument(updated, getOwnerWin());
        showToast(`"${source.name}" çoğaltıldı`);
        return updated;
      });
    },
    [getOwnerWin, pushHistoryBeforeMutation, showToast],
  );

  const buildStandaloneHtml = useCallback((ab: Artboard): string => {
    return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${ab.name}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Assistant, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: ${ab.backgroundColor && ab.backgroundColor !== "transparent" ? ab.backgroundColor : "#f8fafc"};
    }
    ${ab.css || ""}
  </style>
</head>
<body>
${ab.html}
</body>
</html>`;
  }, []);

  const handleCopyArtboardCode = useCallback(
    async (artboardId: string) => {
      const ab = doc.artboards.find((a) => a.id === artboardId);
      if (!ab) return;
      const code = buildStandaloneHtml(ab);
      try {
        await getOwnerWin().navigator.clipboard.writeText(code);
        showToast(`"${ab.name}" HTML/CSS kodu panoya kopyalandı`);
      } catch {
        showToast("Pano erişimi başarısız oldu");
      }
    },
    [doc.artboards, buildStandaloneHtml, getOwnerWin, showToast],
  );

  const handleDownloadArtboardCode = useCallback(
    (artboardId: string) => {
      const ab = doc.artboards.find((a) => a.id === artboardId);
      if (!ab) return;
      const ownerDoc = getOwnerDoc();
      const ownerWin = getOwnerWin();
      const code = buildStandaloneHtml(ab);
      const blob = new Blob([code], { type: "text/html;charset=utf-8" });
      const url = ownerWin.URL.createObjectURL(blob);
      const a = ownerDoc.createElement("a");
      a.href = url;
      const safeName = ab.name
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/gi, "-")
        .replace(/^-|-$/g, "");
      a.download = `${safeName || "tasarim"}.html`;
      ownerDoc.body.appendChild(a);
      a.click();
      a.remove();
      ownerWin.URL.revokeObjectURL(url);
      showToast(`"${a.download}" indirildi`);
    },
    [doc.artboards, buildStandaloneHtml, getOwnerDoc, getOwnerWin, showToast],
  );

  const handleDeleteArtboard = useCallback(
    (artboardId: string) => {
      setDoc((prev) => {
        pushHistoryBeforeMutation(prev);
        const artboards = prev.artboards.filter((a) => a.id !== artboardId);
        const updated: DesignDocument = {
          ...prev,
          artboards,
          selectedArtboardId:
            prev.selectedArtboardId === artboardId
              ? artboards[artboards.length - 1]?.id || null
              : prev.selectedArtboardId,
          selectedNodeId:
            prev.selectedArtboardId === artboardId ? null : prev.selectedNodeId,
        };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [getOwnerWin, pushHistoryBeforeMutation],
  );

  const handleAddPresetArtboard = (mode: "desktop" | "mobile") => {
    const ownerDoc = getOwnerDoc();
    setDoc((prev) => {
      pushHistoryBeforeMutation(prev);
      const width = mode === "desktop" ? 1440 : 390;
      const height = mode === "desktop" ? 900 : 844;
      const spacing = 64;
      let nextX = 100;
      let nextY = 90;

      if (prev.artboards.length > 0) {
        const last = prev.artboards[prev.artboards.length - 1];
        const lastW =
          typeof last.width === "number"
            ? last.width
            : last.measuredWidth || 440;
        nextX = last.x + lastW + spacing;
        nextY = last.y;
      }

      const name =
        mode === "desktop"
          ? `Masaüstü ${prev.artboards.length + 1}`
          : `Mobil ${prev.artboards.length + 1}`;
      const rawHtml = `<div style="padding: 48px; color: #1b1b1f;">
  <span style="display:inline-block; padding: 4px 10px; border-radius: 6px; background: #e3e2fe; color: #5b57d1; font-size: 12px; font-weight: 600; margin-bottom: 12px;">${mode === "desktop" ? "1440 × 900" : "390 × 844"}</span>
  <h2 style="margin: 0 0 8px; font-size: 24px; font-weight: 700;">${name}</h2>
  <p style="margin: 0; color: #5c5c5c; font-size: 14px; line-height: 1.5;">MCP <code>render_design</code> aracı veya AI Studio ile bu çerçeveye pixel-perfect tasarım aktarabilirsiniz.</p>
</div>`;

      const newArtboard: Artboard = {
        id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name,
        x: nextX,
        y: nextY,
        width,
        height,
        html: sanitizeAndTagDesignHtml(rawHtml, ownerDoc),
        css: "",
        backgroundColor: "#ffffff",
        locked: false,
        allowMove: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const updated: DesignDocument = {
        ...prev,
        artboards: [...prev.artboards, newArtboard],
        selectedArtboardId: newArtboard.id,
        selectedNodeId: null,
      };
      saveDesignDocument(updated, getOwnerWin());
      return updated;
    });
  };

  const handleFocusArtboard = useCallback(
    (artboardId: string) => {
      const ab = doc.artboards.find((a) => a.id === artboardId);
      const vp = viewportRef.current;
      if (!ab || !vp) return;
      const vpW = vp.clientWidth || 1200;
      const vpH = vp.clientHeight || 800;
      const abW =
        typeof ab.width === "number" ? ab.width : ab.measuredWidth || 440;
      const abH =
        typeof ab.height === "number" ? ab.height : ab.measuredHeight || 400;

      const fitZoom = Math.min(
        1,
        Math.max(0.25, Math.min((vpW - 240) / abW, (vpH - 200) / abH)),
      );
      const nextPanX = Math.round((vpW - abW * fitZoom) / 2 - ab.x * fitZoom);
      const nextPanY = Math.round((vpH - abH * fitZoom) / 2 - ab.y * fitZoom);

      setDoc((prev) => {
        const updated = {
          ...prev,
          selectedArtboardId: artboardId,
          zoom: Number(fitZoom.toFixed(2)),
          panX: nextPanX,
          panY: nextPanY,
        };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [doc.artboards, getOwnerWin],
  );

  const handleFitAll = () => {
    if (doc.artboards.length === 0) {
      handleResetZoom();
      return;
    }
    const vp = viewportRef.current;
    const vpW = vp?.clientWidth || 1200;
    const vpH = vp?.clientHeight || 800;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const ab of doc.artboards) {
      const w =
        typeof ab.width === "number" ? ab.width : ab.measuredWidth || 440;
      const h =
        typeof ab.height === "number" ? ab.height : ab.measuredHeight || 400;
      minX = Math.min(minX, ab.x);
      minY = Math.min(minY, ab.y);
      maxX = Math.max(maxX, ab.x + w);
      maxY = Math.max(maxY, ab.y + h);
    }

    const totalW = Math.max(200, maxX - minX);
    const totalH = Math.max(200, maxY - minY);
    const fitZoom = Math.min(
      1,
      Math.max(0.2, Math.min((vpW - 240) / totalW, (vpH - 200) / totalH)),
    );
    const panX = Math.round((vpW - totalW * fitZoom) / 2 - minX * fitZoom);
    const panY = Math.round((vpH - totalH * fitZoom) / 2 - minY * fitZoom);

    setDoc((prev) => {
      const updated = {
        ...prev,
        zoom: Number(fitZoom.toFixed(2)),
        panX,
        panY,
      };
      saveDesignDocument(updated, getOwnerWin());
      return updated;
    });
  };

  // Zoom controls
  const handleZoomIn = () => {
    setDoc((prev) => {
      const nextZoom = Math.min(prev.zoom + 0.1, 5);
      const updated = { ...prev, zoom: Number(nextZoom.toFixed(2)) };
      saveDesignDocument(updated, getOwnerWin());
      return updated;
    });
  };

  const handleZoomOut = () => {
    setDoc((prev) => {
      const nextZoom = Math.max(prev.zoom - 0.1, 0.1);
      const updated = { ...prev, zoom: Number(nextZoom.toFixed(2)) };
      saveDesignDocument(updated, getOwnerWin());
      return updated;
    });
  };

  const handleResetZoom = () => {
    setDoc((prev) => {
      const updated = { ...prev, zoom: 1, panX: 0, panY: 0 };
      saveDesignDocument(updated, getOwnerWin());
      return updated;
    });
  };

  const selectedArtboard =
    doc.artboards.find((a) => a.id === doc.selectedArtboardId) || null;

  return (
    <div ref={rootRef} className="design-canvas-root">
      {/* Top-Center Excalidraw Island Toolbar */}
      <div className="design-top-island" role="toolbar" aria-label="Tasarım Araçları">
        <button
          type="button"
          className={`design-tool-btn ${
            activeTool === "hand" ? "design-tool-btn--active" : ""
          }`}
          onClick={() => setActiveTool("hand")}
          title="El Aracı — Tuvali Kaydır (H)"
        >
          {handIcon}
        </button>
        <button
          type="button"
          className={`design-tool-btn ${
            activeTool === "select" ? "design-tool-btn--active" : ""
          }`}
          onClick={() => setActiveTool("select")}
          title="Seçim ve Taşıma Aracı (V veya 1)"
        >
          {SelectionIcon}
        </button>
        <button
          type="button"
          className={`design-tool-btn ${
            activeTool === "inspect" ? "design-tool-btn--active" : ""
          }`}
          onClick={() => setActiveTool("inspect")}
          title="İç Düğüm İnceleme & CSS Düzenleme Aracı (I veya Alt+Tık)"
        >
          {searchIcon}
        </button>

        <div className="design-island-divider" />

        <button
          type="button"
          className="design-tool-btn design-tool-btn--with-label"
          onClick={() => handleAddPresetArtboard("desktop")}
          title="Masaüstü Çerçevesi Ekle (1440×900)"
        >
          {DeviceDesktopIcon}
          <span>Masaüstü</span>
        </button>
        <button
          type="button"
          className="design-tool-btn design-tool-btn--with-label"
          onClick={() => handleAddPresetArtboard("mobile")}
          title="Mobil Çerçeve Ekle (390×844)"
        >
          {frameToolIcon}
          <span>Mobil</span>
        </button>

        <div className="design-island-divider" />

        <button
          type="button"
          className={`design-tool-btn design-tool-btn--with-label ${
            showLayers ? "design-tool-btn--active" : ""
          }`}
          onClick={() => setShowLayers((prev) => !prev)}
          title="Katmanlar Panelini Aç/Kapat"
        >
          <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}>
            {sidebarRightIcon}
          </span>
          <span>Katmanlar</span>
        </button>

        <button
          type="button"
          className={`design-tool-btn design-tool-btn--with-label ${
            showInspector ? "design-tool-btn--active" : ""
          }`}
          onClick={() => setShowInspector((prev) => !prev)}
          title="CSS Denetçisini Aç/Kapat"
        >
          {adjustmentsIcon}
          <span>Denetçi</span>
        </button>

        {onOpenAIIntegrations && (
          <>
            <div className="design-island-divider" />
            <button
              type="button"
              className="design-tool-btn design-tool-btn--with-label design-tool-btn--brand"
              onClick={onOpenAIIntegrations}
              title="AI Studio ve MCP Ayarlarını Aç"
            >
              {brainIcon}
              <span>AI Studio</span>
            </button>
          </>
        )}
      </div>

      {/* Left Layers Island */}
      {showLayers && (
        <DesignLayersPanel
          artboards={doc.artboards}
          selectedArtboardId={doc.selectedArtboardId || null}
          selectedNodeId={doc.selectedNodeId || null}
          domTree={domTree}
          onSelectArtboard={handleSelectArtboard}
          onFocusArtboard={handleFocusArtboard}
          onClose={() => setShowLayers(false)}
        />
      )}

      {/* Right CSS Inspector Island */}
      {showInspector && selectedArtboard && (
        <DesignInspectorPanel
          artboard={selectedArtboard}
          selectedNodeId={doc.selectedNodeId || null}
          domTree={domTree}
          onClearNodeSelection={() =>
            handleSelectArtboard(selectedArtboard.id, null)
          }
          onUpdateArtboard={handleUpdateArtboard}
          onUpdateNodeStyle={handleUpdateNodeStyle}
          onCopyCode={handleCopyArtboardCode}
          onDownloadCode={handleDownloadArtboardCode}
          onClose={() => setShowInspector(false)}
        />
      )}

      {/* Infinite Canvas Viewport */}
      <div
        ref={viewportRef}
        className={[
          "design-canvas-viewport",
          isPanning || activeTool === "hand"
            ? "design-canvas-viewport--panning"
            : "",
          activeTool === "inspect" ? "design-canvas-viewport--inspect" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          backgroundPosition: `${doc.panX}px ${doc.panY}px`,
          backgroundSize: `${24 * doc.zoom}px ${24 * doc.zoom}px`,
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
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
              zoom={doc.zoom}
              activeTool={activeTool}
              isSelected={doc.selectedArtboardId === artboard.id}
              selectedNodeId={
                doc.selectedArtboardId === artboard.id
                  ? doc.selectedNodeId || null
                  : null
              }
              onSelect={handleSelectArtboard}
              onMoveStart={handleMoveStart}
              onMove={handleMoveArtboard}
              onMoveEnd={handleMoveEnd}
              onSetLockMode={handleSetLockMode}
              onRename={handleRenameArtboard}
              onDuplicate={handleDuplicateArtboard}
              onExportCode={handleCopyArtboardCode}
              onDelete={handleDeleteArtboard}
              onMeasuredSize={handleMeasuredSize}
              onRegisterShadowRoot={handleRegisterShadowRoot}
            />
          ))}
        </div>

        {/* Excalidraw-styled Welcome / Empty State */}
        {doc.artboards.length === 0 && (
          <div className="design-canvas-empty-state">
            <div className="empty-badge">{frameToolIcon}</div>
            <h2>{documentName}</h2>
            <p>
              Pixel-perfect, CSS odaklı <strong>Tasarım Tuvali</strong>. AI
              Studio veya MCP (<code>render_design</code>) üzerinden gönderilen
              bileşenler doğal boyutlarında (<em>Hug Contents</em>) ve tam
              Shadow DOM izolasyonuyla bu sonsuz düzleme yerleşir.
            </p>
            <div className="empty-actions">
              {onOpenAIIntegrations && (
                <button
                  type="button"
                  className="empty-btn empty-btn--primary"
                  onClick={onOpenAIIntegrations}
                >
                  {brainIcon}
                  <span>AI Studio ile Tasarla</span>
                </button>
              )}
              <button
                type="button"
                className="empty-btn"
                onClick={() => handleAddPresetArtboard("desktop")}
              >
                {DeviceDesktopIcon}
                <span>Masaüstü Çerçevesi (1440×900)</span>
              </button>
              <button
                type="button"
                className="empty-btn"
                onClick={() => handleAddPresetArtboard("mobile")}
              >
                {frameToolIcon}
                <span>Mobil Çerçeve (390×844)</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Bottom-Left Footer Island (Matching Excalidraw's AppFooter Zoom & Undo/Redo Bar) */}
      <div className="design-footer-left">
        <div className="design-zoom-island">
          <button
            type="button"
            className="design-footer-btn"
            onClick={handleZoomOut}
            title="Uzaklaş (Ctrl + Tekerlek)"
          >
            {ZoomOutIcon}
          </button>
          <button
            type="button"
            className="design-footer-btn design-footer-btn--zoom-value"
            onClick={handleResetZoom}
            title="Yakınlaştırmayı Sıfırla (%100)"
          >
            {Math.round(doc.zoom * 100)}%
          </button>
          <button
            type="button"
            className="design-footer-btn"
            onClick={handleZoomIn}
            title="Yakınlaş (Ctrl + Tekerlek)"
          >
            {ZoomInIcon}
          </button>
          <span className="design-footer-divider" />
          <button
            type="button"
            className="design-footer-btn"
            onClick={handleFitAll}
            title="Tüm Tasarımları Ekrana Sığdır"
          >
            {fullscreenIcon}
          </button>
        </div>

        <div className="design-history-island">
          <button
            type="button"
            className="design-footer-btn"
            onClick={handleUndo}
            disabled={!historyRef.current.canUndo()}
            title="Geri Al (Ctrl+Z)"
          >
            {UndoIcon}
          </button>
          <span className="design-footer-divider" />
          <button
            type="button"
            className="design-footer-btn"
            onClick={handleRedo}
            disabled={!historyRef.current.canRedo()}
            title="Yinele (Ctrl+Y)"
          >
            {RedoIcon}
          </button>
        </div>
      </div>

      {/* Toast Feedback */}
      {toastMessage && (
        <div className="design-canvas-toast" role="status">
          {toastMessage}
        </div>
      )}

      {/* Bottom-Right Live MCP Status Badge */}
      <div className="design-canvas-status-bar">
        <LiveMcpBridge
          excalidrawAPI={null}
          forCanvasType="design"
          onOpenModal={onOpenAIIntegrations}
        />
      </div>
    </div>
  );
};
