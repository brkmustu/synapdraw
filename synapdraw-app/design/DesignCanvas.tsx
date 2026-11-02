import React, {
  useEffect,
  useLayoutEffect,
  useState,
  useRef,
  useCallback,
} from "react";
import { useI18n } from "@excalidraw/excalidraw/i18n";
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
  CloseIcon,
  ContextLinkIcon,
} from "@excalidraw/excalidraw/components/icons";
import {
  registerActiveEngine,
  unregisterEngine,
} from "../engine/engineRegistry";
import { LiveMcpBridge } from "../components/LiveMcpBridge";
import {
  subscribeWorkspaces,
  consumePendingArtboardFocus,
  getProjectTasks,
  getProjectWorkspaces,
  setActiveWorkspaceId,
  setSplitWorkspaceId,
  toggleTaskArtboardLink,
  cleanupDeletedArtboardLinks,
  type ProjectTask,
} from "../workspace/workspaceStore";
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
  const { t } = useI18n();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const shadowRootsRef = useRef<Map<string, ShadowRoot>>(new Map());
  const historyRef = useRef<DesignHistory>(new DesignHistory());

  const [doc, setDoc] = useState<DesignDocument>(() =>
    loadDesignDocument(documentId, documentName),
  );
  const docRef = useRef<DesignDocument>(doc);
  docRef.current = doc;
  const wheelSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "hand" | "inspect">(
    "select",
  );
  const [isPanning, setIsPanning] = useState(false);
  const [showLayers, setShowLayers] = useState(true);
  const [showInspector, setShowInspector] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [snapToObjects, setSnapToObjects] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [viewMode, setViewMode] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    top: number;
    left: number;
    type: "canvas" | "artboard";
    targetArtboardId: string | null;
    canvasX: number;
    canvasY: number;
  } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const copiedArtboardRef = useRef<Artboard | null>(null);
  const [domTree, setDomTree] = useState<DesignNodeSummary[]>([]);
  const [, setHistoryTick] = useState(0);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [projectTasks, setProjectTasks] = useState<ProjectTask[]>(() =>
    getProjectTasks(),
  );
  const [showTaskLinkMenu, setShowTaskLinkMenu] = useState(false);

  const panStartRef = useRef({ x: 0, y: 0 });
  const snapToObjectsRef = useRef(snapToObjects);
  snapToObjectsRef.current = snapToObjects;

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

  // Reload document when documentId changes or when SDLC store notifies
  useEffect(() => {
    const ownerWin = getOwnerWin();
    const syncFromStore = () => {
      const loaded = loadDesignDocument(documentId, documentName, ownerWin);
      setProjectTasks(getProjectTasks());
      const pendingFocusId = consumePendingArtboardFocus(documentId);

      setDoc((prev) => {
        const shouldReload =
          prev.id !== loaded.id ||
          loaded.artboards.length !== prev.artboards.length ||
          Boolean(pendingFocusId) ||
          loaded.artboards.some(
            (a, idx) =>
              a.id !== prev.artboards[idx]?.id ||
              a.updatedAt !== prev.artboards[idx]?.updatedAt,
          );
        if (!shouldReload) return prev;

        const targetFocusId = pendingFocusId || loaded.selectedArtboardId;
        if (targetFocusId) {
          const ab = loaded.artboards.find((a) => a.id === targetFocusId);
          const vp = viewportRef.current;
          if (ab && vp) {
            const vpW = vp.clientWidth || 1000;
            const vpH = vp.clientHeight || 720;
            const abW =
              typeof ab.width === "number" ? ab.width : ab.measuredWidth || 440;
            const abH =
              typeof ab.height === "number"
                ? ab.height
                : ab.measuredHeight || 400;
            const fitZoom = Math.min(
              1,
              Math.max(0.25, Math.min((vpW - 220) / abW, (vpH - 180) / abH)),
            );
            const nextPanX = Math.round(
              (vpW - abW * fitZoom) / 2 - ab.x * fitZoom,
            );
            const nextPanY = Math.round(
              (vpH - abH * fitZoom) / 2 - ab.y * fitZoom,
            );
            const focusedDoc: DesignDocument = {
              ...loaded,
              selectedArtboardId: targetFocusId,
              zoom: Number(fitZoom.toFixed(2)),
              panX: nextPanX,
              panY: nextPanY,
            };
            saveDesignDocument(focusedDoc, ownerWin);
            return focusedDoc;
          }
        }
        return loaded;
      });
      setHistoryTick((t) => t + 1);
    };

    historyRef.current.clear();
    syncFromStore();
    return subscribeWorkspaces(syncFromStore);
  }, [documentId, documentName, getOwnerWin]);

  // Register DesignEngine for Live MCP & AI Studio
  useEffect(() => {
    const engine = new DesignEngine(
      documentId,
      (updatedDoc) => {
        const currentDoc = docRef.current;
        historyRef.current.push({
          artboards: currentDoc.artboards,
          selectedArtboardId: currentDoc.selectedArtboardId,
          selectedNodeId: currentDoc.selectedNodeId,
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
    registerActiveEngine(engine, documentId);

    return () => {
      unregisterEngine(documentId);
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

  const scheduleWheelSave = useCallback(
    (updatedDoc: DesignDocument) => {
      if (wheelSaveTimerRef.current) {
        clearTimeout(wheelSaveTimerRef.current);
      }
      wheelSaveTimerRef.current = setTimeout(() => {
        saveDesignDocument(updatedDoc, getOwnerWin());
        wheelSaveTimerRef.current = null;
      }, 220);
    },
    [getOwnerWin],
  );

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
        scheduleWheelSave(updated);
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
        scheduleWheelSave(updated);
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
    (artboardId: string) => {
      setDoc((prev) => {
        const artboards = prev.artboards.map((a) => {
          if (a.id !== artboardId) {
            return {
              ...a,
              x: Math.round(a.x),
              y: Math.round(a.y),
            };
          }
          if (!snapToObjectsRef.current) {
            return {
              ...a,
              x: Math.round(a.x),
              y: Math.round(a.y),
            };
          }
          let snappedX = Math.round(a.x / 16) * 16;
          let snappedY = Math.round(a.y / 16) * 16;
          for (const other of prev.artboards) {
            if (other.id === a.id) continue;
            if (Math.abs(a.x - other.x) <= 10) {
              snappedX = Math.round(other.x);
            }
            if (Math.abs(a.y - other.y) <= 10) {
              snappedY = Math.round(other.y);
            }
          }
          return {
            ...a,
            x: snappedX,
            y: snappedY,
          };
        });
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
          name: `${source.name} (${t("sdlc.design.copySuffix")})`,
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
        showToast(t("sdlc.design.duplicatedToast", { name: source.name }));
        return updated;
      });
    },
    [getOwnerWin, pushHistoryBeforeMutation, showToast, t],
  );

  const buildStandaloneHtml = useCallback((ab: Artboard): string => {
    return `<!DOCTYPE html>
<html lang="en">
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
        showToast(t("sdlc.design.copiedCodeToast", { name: ab.name }));
      } catch {
        showToast(t("sdlc.design.clipboardErrorToast"));
      }
    },
    [doc.artboards, buildStandaloneHtml, getOwnerWin, showToast, t],
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
      a.download = `${safeName || "design"}.html`;
      ownerDoc.body.appendChild(a);
      a.click();
      a.remove();
      ownerWin.URL.revokeObjectURL(url);
      showToast(t("sdlc.design.downloadedToast", { name: a.download }));
    },
    [doc.artboards, buildStandaloneHtml, getOwnerDoc, getOwnerWin, showToast, t],
  );

  const handleDeleteArtboard = useCallback(
    (artboardId: string) => {
      cleanupDeletedArtboardLinks(documentId, artboardId);
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
    [documentId, getOwnerWin, pushHistoryBeforeMutation],
  );

  const handleCopyArtboard = useCallback(
    (artboardId: string) => {
      const ab = docRef.current.artboards.find((a) => a.id === artboardId);
      if (!ab) return;
      copiedArtboardRef.current = ab;
      try {
        getOwnerWin().localStorage.setItem(
          "synapdraw:design-clipboard-v1",
          JSON.stringify(ab),
        );
      } catch {
        // ignore storage errors
      }
      showToast(`${t("labels.copy")}: "${ab.name}"`);
    },
    [getOwnerWin, showToast, t],
  );

  const handleCutArtboard = useCallback(
    (artboardId: string) => {
      handleCopyArtboard(artboardId);
      handleDeleteArtboard(artboardId);
    },
    [handleCopyArtboard, handleDeleteArtboard],
  );

  const handlePasteArtboard = useCallback(
    async (targetCanvasX?: number, targetCanvasY?: number) => {
      const ownerDoc = getOwnerDoc();
      const ownerWin = getOwnerWin();
      let sourceAb = copiedArtboardRef.current;
      if (!sourceAb) {
        try {
          const raw = ownerWin.localStorage.getItem(
            "synapdraw:design-clipboard-v1",
          );
          if (raw) {
            sourceAb = JSON.parse(raw) as Artboard;
          }
        } catch {
          // ignore
        }
      }

      if (sourceAb) {
        setDoc((prev) => {
          pushHistoryBeforeMutation(prev);
          const nextX =
            typeof targetCanvasX === "number"
              ? Math.round(targetCanvasX)
              : Math.round(sourceAb!.x + 48);
          const nextY =
            typeof targetCanvasY === "number"
              ? Math.round(targetCanvasY)
              : Math.round(sourceAb!.y + 48);
          const pasted: Artboard = {
            ...sourceAb!,
            id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: `${sourceAb!.name} (${t("sdlc.design.copySuffix")})`,
            x: nextX,
            y: nextY,
            locked: false,
            allowMove: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          const updated: DesignDocument = {
            ...prev,
            artboards: [...prev.artboards, pasted],
            selectedArtboardId: pasted.id,
            selectedNodeId: null,
          };
          saveDesignDocument(updated, ownerWin);
          showToast(`${t("labels.paste")}: "${pasted.name}"`);
          return updated;
        });
        return;
      }

      // Fallback: if system clipboard has HTML/text, paste as a new Hug Contents artboard
      try {
        const clipText = await ownerWin.navigator.clipboard.readText();
        if (clipText && clipText.trim()) {
          setDoc((prev) => {
            pushHistoryBeforeMutation(prev);
            const isHtml = /<[a-z][\s\S]*>/i.test(clipText);
            const rawHtml = isHtml
              ? clipText
              : `<div style="padding: 24px; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; color: #1b1b1f; font-size: 14px;">${clipText}</div>`;
            const pasted: Artboard = {
              id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              name: `${t("labels.paste")} ${prev.artboards.length + 1}`,
              x: typeof targetCanvasX === "number" ? Math.round(targetCanvasX) : 140,
              y: typeof targetCanvasY === "number" ? Math.round(targetCanvasY) : 120,
              width: "auto",
              height: "auto",
              html: sanitizeAndTagDesignHtml(rawHtml, ownerDoc),
              css: "",
              backgroundColor: "transparent",
              locked: false,
              allowMove: true,
              createdAt: Date.now(),
              updatedAt: Date.now(),
            };
            const updated: DesignDocument = {
              ...prev,
              artboards: [...prev.artboards, pasted],
              selectedArtboardId: pasted.id,
              selectedNodeId: null,
            };
            saveDesignDocument(updated, ownerWin);
            return updated;
          });
        }
      } catch {
        // ignore clipboard permission errors
      }
    },
    [getOwnerDoc, getOwnerWin, pushHistoryBeforeMutation, showToast, t],
  );

  const handleReorderArtboard = useCallback(
    (
      artboardId: string,
      direction: "backward" | "forward" | "back" | "front",
    ) => {
      setDoc((prev) => {
        const idx = prev.artboards.findIndex((a) => a.id === artboardId);
        if (idx === -1) return prev;
        const list = [...prev.artboards];
        const [item] = list.splice(idx, 1);
        if (direction === "backward") {
          list.splice(Math.max(0, idx - 1), 0, item);
        } else if (direction === "forward") {
          list.splice(Math.min(list.length, idx + 1), 0, item);
        } else if (direction === "back") {
          list.unshift(item);
        } else if (direction === "front") {
          list.push(item);
        }
        pushHistoryBeforeMutation(prev);
        const updated: DesignDocument = {
          ...prev,
          artboards: list,
        };
        saveDesignDocument(updated, getOwnerWin());
        return updated;
      });
    },
    [getOwnerWin, pushHistoryBeforeMutation],
  );

  const handleUnlockAllArtboards = useCallback(() => {
    setDoc((prev) => {
      if (!prev.artboards.some((a) => a.locked && !a.allowMove)) {
        return prev;
      }
      pushHistoryBeforeMutation(prev);
      const updated: DesignDocument = {
        ...prev,
        artboards: prev.artboards.map((a) => ({
          ...a,
          locked: false,
          allowMove: true,
        })),
      };
      saveDesignDocument(updated, getOwnerWin());
      return updated;
    });
  }, [getOwnerWin, pushHistoryBeforeMutation]);

  const handleOpenContextMenu = useCallback(
    (
      event: React.MouseEvent,
      type: "canvas" | "artboard",
      targetArtboardId: string | null = null,
    ) => {
      event.preventDefault();
      event.stopPropagation();
      const rootEl = rootRef.current;
      const vpEl = viewportRef.current;
      const rootRect = rootEl?.getBoundingClientRect();
      const vpRect = vpEl?.getBoundingClientRect();
      const left = rootRect ? event.clientX - rootRect.left : event.clientX;
      const top = rootRect ? event.clientY - rootRect.top : event.clientY;
      const currentDoc = docRef.current;
      const safeZoom = currentDoc.zoom > 0 ? currentDoc.zoom : 1;
      const canvasX = vpRect
        ? (event.clientX - vpRect.left - currentDoc.panX) / safeZoom
        : 120;
      const canvasY = vpRect
        ? (event.clientY - vpRect.top - currentDoc.panY) / safeZoom
        : 120;

      setContextMenu({
        top,
        left,
        type,
        targetArtboardId,
        canvasX,
        canvasY,
      });
    },
    [],
  );

  // Clamp context menu within container viewport (identical to Excalidraw's Popover fitInViewport)
  useLayoutEffect(() => {
    if (!contextMenu || !contextMenuRef.current || !rootRef.current) {
      return;
    }
    const menuEl = contextMenuRef.current;
    const rootRect = rootRef.current.getBoundingClientRect();
    const menuRect = menuEl.getBoundingClientRect();
    const gap = 10;

    const maxLeft = Math.max(gap, rootRect.width - menuRect.width - gap);
    const maxTop = Math.max(gap, rootRect.height - menuRect.height - gap);
    const clampedLeft = Math.min(Math.max(contextMenu.left, gap), maxLeft);
    const clampedTop = Math.min(Math.max(contextMenu.top, gap), maxTop);

    menuEl.style.left = `${clampedLeft}px`;
    menuEl.style.top = `${clampedTop}px`;
  }, [contextMenu]);

  // Dismiss context menu on outside pointerdown or Escape
  useEffect(() => {
    if (!contextMenu) return;
    const ownerDoc = getOwnerDoc();
    const onPointerDown = (e: PointerEvent) => {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setContextMenu(null);
      }
    };
    ownerDoc.addEventListener("pointerdown", onPointerDown, false);
    ownerDoc.addEventListener("keydown", onKeyDown, false);
    return () => {
      ownerDoc.removeEventListener("pointerdown", onPointerDown, false);
      ownerDoc.removeEventListener("keydown", onKeyDown, false);
    };
  }, [contextMenu, getOwnerDoc]);

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
          ? `${t("sdlc.design.desktopBtn")} ${prev.artboards.length + 1}`
          : `${t("sdlc.design.mobileBtn")} ${prev.artboards.length + 1}`;
      const rawHtml = `<div style="padding: 48px; color: #1b1b1f;">
  <span style="display:inline-block; padding: 4px 10px; border-radius: 6px; background: #e3e2fe; color: #5b57d1; font-size: 12px; font-weight: 600; margin-bottom: 12px;">${mode === "desktop" ? "1440 × 900" : "390 × 844"}</span>
  <h2 style="margin: 0 0 8px; font-size: 24px; font-weight: 700;">${name}</h2>
  <p style="margin: 0; color: #5c5c5c; font-size: 14px; line-height: 1.5;">${t("sdlc.design.emptyDesc")}</p>
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

  // Keyboard shortcuts (Undo, Redo, Copy/Cut/Paste/Duplicate/Delete, Grid/Snap/Zen/View, Tool switching)
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

      const currentDoc = docRef.current;
      const selectedId = currentDoc.selectedArtboardId;

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

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        if (selectedId) {
          e.preventDefault();
          if (e.altKey) {
            void handleCopyArtboardCode(selectedId);
          } else {
            handleCopyArtboard(selectedId);
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "x") {
        if (selectedId) {
          e.preventDefault();
          handleCutArtboard(selectedId);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v") {
        e.preventDefault();
        void handlePasteArtboard();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
        if (selectedId) {
          e.preventDefault();
          handleDuplicateArtboard(selectedId);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (currentDoc.artboards.length > 0 && !currentDoc.selectedArtboardId) {
          handleSelectArtboard(currentDoc.artboards[0].id, null);
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "'") {
        e.preventDefault();
        setShowGrid((prev) => !prev);
        return;
      }

      if (
        (e.ctrlKey || e.metaKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === "l"
      ) {
        if (selectedId) {
          e.preventDefault();
          const ab = currentDoc.artboards.find((a) => a.id === selectedId);
          if (ab) {
            const isFullLocked = Boolean(ab.locked && !ab.allowMove);
            handleSetLockMode(
              selectedId,
              isFullLocked ? "moveable" : "full-lock",
            );
          }
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "[") {
        if (selectedId) {
          e.preventDefault();
          handleReorderArtboard(
            selectedId,
            e.shiftKey ? "back" : "backward",
          );
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === "]") {
        if (selectedId) {
          e.preventDefault();
          handleReorderArtboard(
            selectedId,
            e.shiftKey ? "front" : "forward",
          );
        }
        return;
      }

      if (
        e.shiftKey &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        (e.code === "Digit2" || e.key === "2")
      ) {
        if (selectedId) {
          e.preventDefault();
          handleFocusArtboard(selectedId);
        }
        return;
      }

      if (e.altKey && !e.ctrlKey && !e.metaKey) {
        const k = e.key.toLowerCase();
        if (k === "s") {
          e.preventDefault();
          setSnapToObjects((prev) => !prev);
          return;
        }
        if (k === "z") {
          e.preventDefault();
          setZenMode((prev) => !prev);
          return;
        }
        if (k === "r") {
          e.preventDefault();
          setViewMode((prev) => !prev);
          return;
        }
        if (e.key === "/") {
          e.preventDefault();
          const nextOpen = !(showLayers && showInspector);
          setShowLayers(nextOpen);
          setShowInspector(nextOpen);
          return;
        }
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId && !viewMode) {
          const ab = currentDoc.artboards.find((a) => a.id === selectedId);
          if (ab && !(ab.locked && !ab.allowMove)) {
            e.preventDefault();
            handleDeleteArtboard(selectedId);
          }
        }
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
  }, [
    getOwnerDoc,
    handleUndo,
    handleRedo,
    handleCopyArtboard,
    handleCopyArtboardCode,
    handleCutArtboard,
    handlePasteArtboard,
    handleDuplicateArtboard,
    handleSelectArtboard,
    handleSetLockMode,
    handleReorderArtboard,
    handleFocusArtboard,
    handleDeleteArtboard,
    showLayers,
    showInspector,
    viewMode,
  ]);

  const selectedArtboard =
    doc.artboards.find((a) => a.id === doc.selectedArtboardId) || null;

  const hasLockedArtboards = doc.artboards.some(
    (a) => Boolean(a.locked && !a.allowMove),
  );
  const contextTargetArtboard = contextMenu?.targetArtboardId
    ? doc.artboards.find((a) => a.id === contextMenu.targetArtboardId) || null
    : selectedArtboard;
  const isTargetArtboardLocked = Boolean(
    contextTargetArtboard &&
      contextTargetArtboard.locked &&
      !contextTargetArtboard.allowMove,
  );
  const isTargetHugContents = Boolean(
    !contextTargetArtboard ||
      contextTargetArtboard.width === "auto" ||
      contextTargetArtboard.width === undefined,
  );

  return (
    <div
      ref={rootRef}
      className="design-canvas-root"
      onContextMenu={(e) => handleOpenContextMenu(e, "canvas", null)}
    >
      {/* Top-Center Excalidraw Island Toolbar */}
      {!zenMode && (
        <div
          className="design-top-island"
          role="toolbar"
          aria-label={t("sdlc.design.toolbarAria")}
        >
          <button
            type="button"
            className={`design-tool-btn ${
              activeTool === "hand" ? "design-tool-btn--active" : ""
            }`}
            onClick={() => setActiveTool("hand")}
            title={t("sdlc.design.handToolTitle")}
          >
            {handIcon}
          </button>
          <button
            type="button"
            className={`design-tool-btn ${
              activeTool === "select" ? "design-tool-btn--active" : ""
            }`}
            onClick={() => setActiveTool("select")}
            title={t("sdlc.design.selectToolTitle")}
          >
            {SelectionIcon}
          </button>
          <button
            type="button"
            className={`design-tool-btn ${
              activeTool === "inspect" ? "design-tool-btn--active" : ""
            }`}
            onClick={() => setActiveTool("inspect")}
            title={t("sdlc.design.inspectToolTitle")}
          >
            {searchIcon}
          </button>

          {!viewMode && (
            <>
              <div className="design-island-divider" />

              <button
                type="button"
                className="design-tool-btn design-tool-btn--with-label"
                onClick={() => handleAddPresetArtboard("desktop")}
                title={t("sdlc.design.addDesktopTitle")}
              >
                {DeviceDesktopIcon}
                <span>{t("sdlc.design.desktopBtn")}</span>
              </button>
              <button
                type="button"
                className="design-tool-btn design-tool-btn--with-label"
                onClick={() => handleAddPresetArtboard("mobile")}
                title={t("sdlc.design.addMobileTitle")}
              >
                {frameToolIcon}
                <span>{t("sdlc.design.mobileBtn")}</span>
              </button>
            </>
          )}

          <div className="design-island-divider" />

          <button
            type="button"
            className={`design-tool-btn design-tool-btn--with-label ${
              showLayers ? "design-tool-btn--active" : ""
            }`}
            onClick={() => setShowLayers((prev) => !prev)}
            title={t("sdlc.design.toggleLayersTitle")}
          >
            <span style={{ display: "inline-flex", transform: "scaleX(-1)" }}>
              {sidebarRightIcon}
            </span>
            <span>{t("sdlc.design.layersBtn")}</span>
          </button>

          <button
            type="button"
            className={`design-tool-btn design-tool-btn--with-label ${
              showInspector ? "design-tool-btn--active" : ""
            }`}
            onClick={() => setShowInspector((prev) => !prev)}
            title={t("sdlc.design.toggleInspectorTitle")}
          >
            {adjustmentsIcon}
            <span>{t("sdlc.design.inspectorBtn")}</span>
          </button>

          {selectedArtboard && !viewMode && (
            <div style={{ position: "relative", display: "inline-flex" }}>
              <div className="design-island-divider" />
              <button
                type="button"
                className={`design-tool-btn design-tool-btn--with-label ${
                  showTaskLinkMenu ? "design-tool-btn--active" : ""
                }`}
                onClick={() => setShowTaskLinkMenu((prev) => !prev)}
                title={t("sdlc.design.linkTaskBtnTitle")}
              >
                {ContextLinkIcon}
                <span>
                  {t("sdlc.design.taskLinkBtn", {
                    count: projectTasks.filter((taskItem) =>
                      (taskItem.linkedArtboards || []).some(
                        (la) =>
                          la.docId === documentId &&
                          la.artboardId === selectedArtboard.id,
                      ),
                    ).length,
                  })}
                </span>
              </button>

              {showTaskLinkMenu && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    right: 0,
                    width: 310,
                    background: "var(--island-bg-color, #ffffff)",
                    border: "1px solid var(--default-border-color, #e5e5e5)",
                    borderRadius: "var(--border-radius-lg, 8px)",
                    boxShadow: "var(--shadow-island)",
                    padding: 10,
                    zIndex: 120,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--text-primary-color)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingBottom: 4,
                      borderBottom: "1px solid var(--default-border-color)",
                    }}
                  >
                    <span>{t("sdlc.design.artboardTaskLinkHeader")}</span>
                    <button
                      type="button"
                      style={{
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        width: 14,
                        height: 14,
                        padding: 0,
                        color: "var(--icon-fill-color)",
                      }}
                      onClick={() => setShowTaskLinkMenu(false)}
                    >
                      {CloseIcon}
                    </button>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      opacity: 0.72,
                      color: "var(--text-primary-color)",
                    }}
                  >
                    {t("sdlc.design.selectedLabel")}{" "}
                    <strong>{selectedArtboard.name}</strong>
                  </div>
                  <div
                    style={{
                      maxHeight: 200,
                      overflowY: "auto",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    {projectTasks.map((taskItem) => {
                      const isLinked = (taskItem.linkedArtboards || []).some(
                        (la) =>
                          la.docId === documentId &&
                          la.artboardId === selectedArtboard.id,
                      );
                      return (
                        <div
                          key={taskItem.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 6,
                            padding: "6px 8px",
                            borderRadius: 6,
                            background: isLinked
                              ? "var(--color-surface-primary-container)"
                              : "var(--color-surface-low)",
                            color: isLinked
                              ? "var(--color-on-primary-container)"
                              : "var(--text-primary-color)",
                            fontSize: 11.5,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              toggleTaskArtboardLink(taskItem.id, {
                                docId: documentId,
                                artboardId: selectedArtboard.id,
                                label: selectedArtboard.name,
                              });
                              showToast(
                                isLinked
                                  ? t("sdlc.design.unlinkedToast", {
                                      key: taskItem.key,
                                    })
                                  : t("sdlc.design.linkedToast", {
                                      name: selectedArtboard.name,
                                      key: taskItem.key,
                                    }),
                              );
                            }}
                            style={{
                              flex: 1,
                              textAlign: "left",
                              border: "none",
                              background: "transparent",
                              color: "inherit",
                              cursor: "pointer",
                              fontFamily: "var(--ui-font)",
                              fontSize: 11.5,
                              fontWeight: isLinked ? 700 : 500,
                              padding: 0,
                            }}
                          >
                            {isLinked ? "✓ " : "+ "}
                            <strong>{taskItem.key}:</strong> {taskItem.title}
                          </button>
                          <button
                            type="button"
                            title={t("sdlc.design.goToBoardTitle")}
                            onClick={() => {
                              const taskDoc = getProjectWorkspaces().find(
                                (w) => w.canvasType === "tasks",
                              );
                              if (taskDoc) {
                                setActiveWorkspaceId(taskDoc.id);
                              }
                              setShowTaskLinkMenu(false);
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              color: "var(--color-primary)",
                              fontSize: 10.5,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            {t("sdlc.design.goToBoardBtn")}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {onOpenAIIntegrations && !viewMode && (
            <>
              <div className="design-island-divider" />
              <button
                type="button"
                className="design-tool-btn design-tool-btn--with-label design-tool-btn--brand"
                onClick={onOpenAIIntegrations}
                title={t("sdlc.design.openAiStudioTitle")}
              >
                {brainIcon}
                <span>{t("sdlc.common.aiStudio")}</span>
              </button>
            </>
          )}
        </div>
      )}

      {/* Left Layers Island */}
      {!zenMode && showLayers && (
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
      {!zenMode && showInspector && selectedArtboard && (
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
          backgroundImage: showGrid ? undefined : "none",
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onContextMenu={(e) => handleOpenContextMenu(e, "canvas", null)}
      >
        <div
          className="design-canvas-plane"
          style={{
            transform: `translate(${doc.panX}px, ${doc.panY}px) scale(${doc.zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {doc.artboards.map((artboard) => {
            const artboardLinkedTasks = projectTasks
              .filter((taskItem) =>
                (taskItem.linkedArtboards || []).some(
                  (la) =>
                    la.docId === documentId && la.artboardId === artboard.id,
                ),
              )
              .map((taskItem) => ({
                id: taskItem.id,
                key: taskItem.key,
                title: taskItem.title,
                status: taskItem.status,
              }));

            return (
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
                onContextMenu={(artboardId, e) =>
                  handleOpenContextMenu(e, "artboard", artboardId)
                }
                linkedTasks={artboardLinkedTasks}
                onOpenLinkedTask={() => {
                  const taskDoc = getProjectWorkspaces().find(
                    (w) => w.canvasType === "tasks",
                  );
                  if (taskDoc) {
                    setSplitWorkspaceId(taskDoc.id);
                  }
                }}
              />
            );
          })}
        </div>

        {/* Welcome / Empty State */}
        {doc.artboards.length === 0 && (
          <div className="design-canvas-empty-state">
            <div className="empty-badge">{frameToolIcon}</div>
            <h2>{documentName}</h2>
            <p>
              <strong>{t("sdlc.design.emptyTitle")}</strong>.{" "}
              {t("sdlc.design.emptyDesc")}
            </p>
            <div className="empty-actions">
              {onOpenAIIntegrations && (
                <button
                  type="button"
                  className="empty-btn empty-btn--primary"
                  onClick={onOpenAIIntegrations}
                >
                  {brainIcon}
                  <span>{t("sdlc.design.designWithAiBtn")}</span>
                </button>
              )}
              <button
                type="button"
                className="empty-btn"
                onClick={() => handleAddPresetArtboard("desktop")}
              >
                {DeviceDesktopIcon}
                <span>{t("sdlc.design.desktopFrameBtn")}</span>
              </button>
              <button
                type="button"
                className="empty-btn"
                onClick={() => handleAddPresetArtboard("mobile")}
              >
                {frameToolIcon}
                <span>{t("sdlc.design.mobileFrameBtn")}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Excalidraw-identical Right-Click Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="popover context-menu-popover"
          style={{ left: contextMenu.left, top: contextMenu.top }}
        >
          <ul
            className="context-menu"
            onContextMenu={(e) => e.preventDefault()}
          >
            {contextMenu.type === "canvas" ? (
              <>
                <li>
                  <button
                    type="button"
                    className="context-menu-item"
                    onClick={() => {
                      const cx = contextMenu.canvasX;
                      const cy = contextMenu.canvasY;
                      setContextMenu(null);
                      handlePasteArtboard(cx, cy);
                    }}
                  >
                    <div className="context-menu-item__label">
                      {t("labels.paste")}
                    </div>
                    <kbd className="context-menu-item__shortcut">Ctrl+V</kbd>
                  </button>
                </li>
                <hr className="context-menu-item-separator" />
                <li>
                  <button
                    type="button"
                    className="context-menu-item"
                    onClick={() => {
                      setContextMenu(null);
                      if (doc.artboards.length > 0) {
                        const target =
                          doc.selectedArtboardId || doc.artboards[0].id;
                        handleSelectArtboard(target, null);
                      }
                    }}
                  >
                    <div className="context-menu-item__label">
                      {t("labels.selectAll")}
                    </div>
                    <kbd className="context-menu-item__shortcut">Ctrl+A</kbd>
                  </button>
                </li>
                {hasLockedArtboards && (
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        setContextMenu(null);
                        handleUnlockAllArtboards();
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.elementLock.unlockAll")}
                      </div>
                      <kbd className="context-menu-item__shortcut" />
                    </button>
                  </li>
                )}
                <hr className="context-menu-item-separator" />
                <li>
                  <button
                    type="button"
                    className={`context-menu-item ${
                      showGrid ? "checkmark" : ""
                    }`}
                    onClick={() => {
                      setContextMenu(null);
                      setShowGrid((prev) => !prev);
                    }}
                  >
                    <div className="context-menu-item__label">
                      {t("labels.toggleGrid")}
                    </div>
                    <kbd className="context-menu-item__shortcut">Ctrl+&apos;</kbd>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`context-menu-item ${
                      snapToObjects ? "checkmark" : ""
                    }`}
                    onClick={() => {
                      setContextMenu(null);
                      setSnapToObjects((prev) => !prev);
                    }}
                  >
                    <div className="context-menu-item__label">
                      {t("buttons.objectsSnapMode")}
                    </div>
                    <kbd className="context-menu-item__shortcut">Alt+S</kbd>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`context-menu-item ${
                      isTargetHugContents ? "checkmark" : ""
                    }`}
                    onClick={() => {
                      setContextMenu(null);
                      if (selectedArtboard) {
                        if (isTargetHugContents) {
                          handleUpdateArtboard(selectedArtboard.id, {
                            width: selectedArtboard.measuredWidth || 1280,
                            height: selectedArtboard.measuredHeight || 800,
                          });
                        } else {
                          handleUpdateArtboard(selectedArtboard.id, {
                            width: "auto",
                            height: "auto",
                          });
                        }
                      }
                    }}
                  >
                    <div className="context-menu-item__label">
                      {t("sdlc.design.hugContentsBtn")}
                    </div>
                    <kbd className="context-menu-item__shortcut" />
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`context-menu-item ${
                      zenMode ? "checkmark" : ""
                    }`}
                    onClick={() => {
                      setContextMenu(null);
                      setZenMode((prev) => !prev);
                    }}
                  >
                    <div className="context-menu-item__label">
                      {t("buttons.zenMode")}
                    </div>
                    <kbd className="context-menu-item__shortcut">Alt+Z</kbd>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`context-menu-item ${
                      viewMode ? "checkmark" : ""
                    }`}
                    onClick={() => {
                      setContextMenu(null);
                      setViewMode((prev) => !prev);
                    }}
                  >
                    <div className="context-menu-item__label">
                      {t("labels.viewMode")}
                    </div>
                    <kbd className="context-menu-item__shortcut">Alt+R</kbd>
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    className={`context-menu-item ${
                      showLayers && showInspector ? "checkmark" : ""
                    }`}
                    onClick={() => {
                      setContextMenu(null);
                      const next = !(showLayers && showInspector);
                      setShowLayers(next);
                      setShowInspector(next);
                    }}
                  >
                    <div className="context-menu-item__label">
                      {t("stats.fullTitle")}
                    </div>
                    <kbd className="context-menu-item__shortcut">Alt+/</kbd>
                  </button>
                </li>
              </>
            ) : (
              contextTargetArtboard && (
                <>
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleCutArtboard(targetId);
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.cut")}
                      </div>
                      <kbd className="context-menu-item__shortcut">Ctrl+X</kbd>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleCopyArtboard(targetId);
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.copy")}
                      </div>
                      <kbd className="context-menu-item__shortcut">Ctrl+C</kbd>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const cx = contextMenu.canvasX;
                        const cy = contextMenu.canvasY;
                        setContextMenu(null);
                        handlePasteArtboard(cx, cy);
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.paste")}
                      </div>
                      <kbd className="context-menu-item__shortcut">Ctrl+V</kbd>
                    </button>
                  </li>
                  <hr className="context-menu-item-separator" />
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleCopyArtboardCode(targetId);
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("sdlc.design.copyHtmlCssBtn")}
                      </div>
                      <kbd className="context-menu-item__shortcut">
                        Ctrl+Alt+C
                      </kbd>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleDownloadArtboardCode(targetId);
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("sdlc.design.downloadHtmlBtn")}
                      </div>
                      <kbd className="context-menu-item__shortcut" />
                    </button>
                  </li>
                  <hr className="context-menu-item-separator" />
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleReorderArtboard(targetId, "backward");
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.sendBackward")}
                      </div>
                      <kbd className="context-menu-item__shortcut">Ctrl+[</kbd>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleReorderArtboard(targetId, "forward");
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.bringForward")}
                      </div>
                      <kbd className="context-menu-item__shortcut">Ctrl+]</kbd>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleReorderArtboard(targetId, "back");
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.sendToBack")}
                      </div>
                      <kbd className="context-menu-item__shortcut">
                        Ctrl+Shift+[
                      </kbd>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleReorderArtboard(targetId, "front");
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.bringToFront")}
                      </div>
                      <kbd className="context-menu-item__shortcut">
                        Ctrl+Shift+]
                      </kbd>
                    </button>
                  </li>
                  <hr className="context-menu-item-separator" />
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleFocusArtboard(targetId);
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.zoomToFitSelection")}
                      </div>
                      <kbd className="context-menu-item__shortcut">Shift+2</kbd>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        handleSelectArtboard(targetId, null);
                        setContextMenu(null);
                        setShowTaskLinkMenu(true);
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("sdlc.design.artboardTaskLinkHeader")}
                      </div>
                      <kbd className="context-menu-item__shortcut" />
                    </button>
                  </li>
                  <hr className="context-menu-item-separator" />
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleDuplicateArtboard(targetId);
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.duplicateSelection")}
                      </div>
                      <kbd className="context-menu-item__shortcut">Ctrl+D</kbd>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="context-menu-item"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleSetLockMode(
                          targetId,
                          isTargetArtboardLocked ? "moveable" : "full-lock",
                        );
                      }}
                    >
                      <div className="context-menu-item__label">
                        {isTargetArtboardLocked
                          ? t("labels.elementLock.unlock")
                          : t("labels.elementLock.lock")}
                      </div>
                      <kbd className="context-menu-item__shortcut">
                        Ctrl+Shift+L
                      </kbd>
                    </button>
                  </li>
                  <hr className="context-menu-item-separator" />
                  <li>
                    <button
                      type="button"
                      className="context-menu-item dangerous"
                      onClick={() => {
                        const targetId = contextTargetArtboard.id;
                        setContextMenu(null);
                        handleDeleteArtboard(targetId);
                      }}
                    >
                      <div className="context-menu-item__label">
                        {t("labels.delete")}
                      </div>
                      <kbd className="context-menu-item__shortcut">Delete</kbd>
                    </button>
                  </li>
                </>
              )
            )}
          </ul>
        </div>
      )}

      {/* Bottom-Left Footer Island */}
      <div className="design-footer-left">
        <div className="design-zoom-island">
          <button
            type="button"
            className="design-footer-btn"
            onClick={handleZoomOut}
            title={t("sdlc.design.zoomOutTitle")}
          >
            {ZoomOutIcon}
          </button>
          <button
            type="button"
            className="design-footer-btn design-footer-btn--zoom-value"
            onClick={handleResetZoom}
            title={t("sdlc.design.resetZoomTitle")}
          >
            {Math.round(doc.zoom * 100)}%
          </button>
          <button
            type="button"
            className="design-footer-btn"
            onClick={handleZoomIn}
            title={t("sdlc.design.zoomInTitle")}
          >
            {ZoomInIcon}
          </button>
          <span className="design-footer-divider" />
          <button
            type="button"
            className="design-footer-btn"
            onClick={handleFitAll}
            title={t("sdlc.design.fitAllTitle")}
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
            title={t("sdlc.design.undoTitle")}
          >
            {UndoIcon}
          </button>
          <span className="design-footer-divider" />
          <button
            type="button"
            className="design-footer-btn"
            onClick={handleRedo}
            disabled={!historyRef.current.canRedo()}
            title={t("sdlc.design.redoTitle")}
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
