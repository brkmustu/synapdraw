import React, { useEffect, useState, useRef } from "react";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { getActiveEngine, subscribeActiveEngine } from "../engine/engineRegistry";
import {
  getActiveWorkspace,
  getActiveProject,
  getSplitWorkspaceId,
  getProjectWorkspaces,
  getProjectTasks,
  getProjectTDDScenarios,
  getProjectTeam,
  createWorkspace,
  setActiveWorkspaceId,
  createProjectTask,
  updateProjectTask,
  createTDDScenario,
  updateTDDScenario,
  generateTDDFromTask,
  subscribeWorkspaces,
} from "../workspace/workspaceStore";
import "./LiveMcpBridge.scss";

let sharedExcalidrawAPI: ExcalidrawImperativeAPI | null = null;

interface LiveMcpBridgeProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onOpenModal?: () => void;
  syncUrl?: string;
  forCanvasType?: "sketch" | "design";
}

export const LiveMcpBridge: React.FC<LiveMcpBridgeProps> = ({
  excalidrawAPI,
  onOpenModal,
  syncUrl = "http://localhost:3001/api/live-events",
  forCanvasType = excalidrawAPI ? "sketch" : "design",
}) => {
  const { t } = useI18n();
  const [activeWs, setActiveWs] = useState(getActiveWorkspace());
  const [isConnected, setIsConnected] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const containerRef = useRef<HTMLButtonElement | null>(null);

  const isCurrentActive =
    forCanvasType === "design"
      ? activeWs.canvasType === "design"
      : activeWs.canvasType !== "design";

  useEffect(() => {
    if (excalidrawAPI) {
      sharedExcalidrawAPI = excalidrawAPI;
    }
  }, [excalidrawAPI]);

  useEffect(() => {
    return subscribeWorkspaces(() => {
      setActiveWs(getActiveWorkspace());
    });
  }, []);

  useEffect(() => {
    if (!isCurrentActive) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      setIsConnected(false);
      return;
    }

    let reconnectTimer: any = null;

    const connect = () => {
      try {
        const es = new EventSource(syncUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          setIsConnected(true);
        };

        es.onmessage = async (e) => {
          try {
            const data = JSON.parse(e.data);

            if (data.type === "sdlc_upsert_task" && data.task) {
              const t = data.task;
              const tasks = getProjectTasks();
              const existing =
                t.id && tasks.find((item) => item.id === t.id || item.key === t.id);
              if (existing) {
                updateProjectTask(existing.id, t);
                setLastAction(`Görev güncellendi: ${t.title || existing.title}`);
              } else {
                createProjectTask(t);
                setLastAction(`Görev oluşturuldu: ${t.title || "Yeni Görev"}`);
              }
              setTimeout(() => setLastAction(null), 4000);
              return;
            }

            if (data.type === "sdlc_upsert_tdd" && data.scenario) {
              const sc = data.scenario;
              const scenarios = getProjectTDDScenarios();
              const existing =
                sc.id &&
                scenarios.find((item) => item.id === sc.id || item.key === sc.id);
              if (existing) {
                updateTDDScenario(existing.id, sc);
                setLastAction(`TDD güncellendi: ${sc.title || existing.title}`);
              } else {
                createTDDScenario(sc);
                setLastAction(`TDD senaryosu eklendi: ${sc.title || "Yeni Test"}`);
              }
              setTimeout(() => setLastAction(null), 4000);
              return;
            }

            if (data.type === "sdlc_generate_tdd" && data.taskId) {
              const created = generateTDDFromTask(data.taskId);
              if (created.length > 0) {
                setLastAction(`Görevden ${created.length} TDD üretildi`);
                setTimeout(() => setLastAction(null), 4000);
              }
              return;
            }

            const api = excalidrawAPI || sharedExcalidrawAPI;
            const rawTitle = typeof data.title === "string" ? data.title : "";
            const sketchDirectiveMatch = rawTitle.match(
              /^\[(?:Yeni Çizim|Çizim Tuvali|Sketch)(?::\s*([^\]]+))?\]\s*(.*)$/i,
            );
            const forceSketchCanvas =
              Boolean(sketchDirectiveMatch) ||
              data.targetCanvas === "sketch" ||
              data.type === "elements";

            if (forceSketchCanvas && api) {
              const requestedTabName = (
                sketchDirectiveMatch?.[1] ||
                data.sketchTabName ||
                sketchDirectiveMatch?.[2] ||
                rawTitle ||
                "Malzeme Sorgulama"
              ).trim();
              const cleanFrameTitle = (
                sketchDirectiveMatch?.[2] ||
                sketchDirectiveMatch?.[1] ||
                rawTitle ||
                "UI Wireframe Container"
              ).trim();

              // Clean up any accidental Malzeme Sorgulama artboards on design workspaces
              try {
                const ownerWin =
                  containerRef.current?.ownerDocument?.defaultView || window;
                const designWorkspaces = getProjectWorkspaces().filter(
                  (w) => w.canvasType === "design",
                );
                for (const dw of designWorkspaces) {
                  const key = `synapdraw_design_doc_${dw.id}`;
                  const rawDesign = ownerWin.localStorage.getItem(key);
                  if (rawDesign && rawDesign.includes("Malzeme Sorgulama")) {
                    const parsedDesign = JSON.parse(rawDesign);
                    if (Array.isArray(parsedDesign?.artboards)) {
                      const filteredArtboards = parsedDesign.artboards.filter(
                        (ab: any) =>
                          !String(ab?.name || "").includes("Malzeme Sorgulama"),
                      );
                      if (
                        filteredArtboards.length !==
                        parsedDesign.artboards.length
                      ) {
                        parsedDesign.artboards = filteredArtboards;
                        ownerWin.localStorage.setItem(
                          key,
                          JSON.stringify(parsedDesign),
                        );
                      }
                    }
                  }
                }
              } catch {}

              let targetSketchWs = getProjectWorkspaces().find(
                (w) =>
                  w.canvasType === "sketch" &&
                  w.name.toLowerCase() === requestedTabName.toLowerCase(),
              );

              if (data.type === "html" && data.html) {
                setLastAction(`Çizim Tuvaline aktarılıyor: ${requestedTabName}...`);
                const { parseHtmlToExcalidraw } = await import(
                  "../utils/htmlToExcalidraw"
                );
                const { convertToExcalidrawElements, restoreElements } =
                  await import("@excalidraw/excalidraw");
                const { getSmartPlacementCoords } = await import(
                  "../utils/canvasContext"
                );

                const ownerDoc =
                  containerRef.current?.ownerDocument ||
                  (api as any)?.renderEnvironment?.document ||
                  document;
                const ownerWin =
                  ownerDoc?.defaultView ||
                  (api as any)?.renderEnvironment?.defaultView ||
                  window;

                let existingElements: any[] = [];
                if (data.mode === "append" && targetSketchWs) {
                  if (getActiveWorkspace().id === targetSketchWs.id) {
                    existingElements = api
                      .getSceneElements()
                      .filter((el) => !el.isDeleted);
                  } else {
                    try {
                      const storedRaw = ownerWin.localStorage.getItem(
                        `synapdraw_ws_${targetSketchWs.id}_elements`,
                      );
                      if (storedRaw) {
                        existingElements = restoreElements(
                          JSON.parse(storedRaw),
                          null,
                          { repairBindings: true, refreshDimensions: true },
                        );
                      }
                    } catch {}
                  }
                }

                const placement = getSmartPlacementCoords(
                  existingElements,
                  1400,
                  800,
                  data.mode === "append" ? "right" : "replace",
                );

                const result = parseHtmlToExcalidraw(data.html, {
                  ownerDocument: ownerDoc,
                  ownerWindow: ownerWin,
                  originX: placement.x,
                  originY: placement.y,
                  canvasWidth: 1480,
                  frameName: cleanFrameTitle,
                  createFrame: true,
                  createContainerCard: true,
                  locked: data.locked === true,
                });

                if (result.elements && result.elements.length > 0) {
                  const converted = convertToExcalidrawElements(
                    result.elements,
                    {
                      regenerateIds: false,
                      renderEnvironment: (api as any)?.renderEnvironment,
                    },
                  );
                  const restored = restoreElements(converted, null, {
                    repairBindings: true,
                    refreshDimensions: true,
                  });
                  const finalElements = [...existingElements, ...restored];

                  if (!targetSketchWs) {
                    targetSketchWs = createWorkspace(
                      requestedTabName,
                      "sketch",
                      "analysis",
                    );
                  }

                  ownerWin.localStorage.setItem(
                    `synapdraw_ws_${targetSketchWs.id}_elements`,
                    JSON.stringify(finalElements),
                  );
                  setActiveWorkspaceId(targetSketchWs.id);

                  setTimeout(() => {
                    try {
                      ownerWin.localStorage.setItem(
                        `synapdraw_ws_${targetSketchWs!.id}_elements`,
                        JSON.stringify(finalElements),
                      );
                      api.updateScene({ elements: finalElements });
                      if (typeof (api as any).scrollToContent === "function") {
                        (api as any).scrollToContent(restored, {
                          fitToViewport: true,
                          animate: true,
                        });
                      } else if (typeof api.setViewport === "function") {
                        api.setViewport({
                          target: restored,
                          fit: "scale-down",
                          animation: true,
                        });
                      }
                    } catch {}
                  }, 140);

                  setLastAction(
                    `Çizim tuvaline aktarıldı: ${targetSketchWs.name} (${restored.length} öge)`,
                  );
                  setTimeout(() => setLastAction(null), 4000);
                }
                return;
              }
            }

            const engine = getActiveEngine(data.type);
            if (engine) {
              if (!engine.supports(data.type)) {
                setLastAction(`Bu tuvalde desteklenmiyor: ${data.type}`);
                setTimeout(() => setLastAction(null), 4000);
                return;
              }
              const res = await engine.applyEvent(data);
              if (res.message) {
                setLastAction(res.message);
                setTimeout(() => setLastAction(null), 4000);
              }
              return;
            }

            if (!excalidrawAPI) return;

            if (data.type === "mermaid" && data.code) {
              setLastAction("Mermaid aktarılıyor...");
              const { parseMermaidToExcalidraw } = await import(
                "@excalidraw/mermaid-to-excalidraw"
              );
              const { convertToExcalidrawElements, restoreElements } = await import(
                "@excalidraw/excalidraw"
              );
              const { wrapInContainerFrame } = await import(
                "../utils/containerHelper"
              );
              const { getSmartPlacementCoords } = await import(
                "../utils/canvasContext"
              );

              const result = await parseMermaidToExcalidraw(data.code);
              if (result?.elements && result.elements.length > 0) {
                const currentElements =
                  data.mode === "append"
                    ? excalidrawAPI.getSceneElements().filter((el) => !el.isDeleted)
                    : [];

                const placement = getSmartPlacementCoords(
                  currentElements,
                  800,
                  500,
                  data.mode === "append" ? "right" : "replace",
                );

                const container = wrapInContainerFrame(result.elements, {
                  title: data.title || "Mermaid Diagram",
                  originX: placement.x,
                  originY: placement.y,
                  locked: data.locked === true,
                  createFrame: true,
                  createCard: true,
                });

                const converted = convertToExcalidrawElements(
                  container.elements,
                  {
                    regenerateIds: true,
                    renderEnvironment: excalidrawAPI.renderEnvironment,
                  },
                );

                const restored = restoreElements(converted, null, {
                  repairBindings: true,
                  refreshDimensions: true,
                });

                if (data.mode !== "append") {
                  excalidrawAPI.resetScene();
                }
                const baseElements = data.mode === "append" ? currentElements : [];
                excalidrawAPI.updateScene({
                  elements: [...baseElements, ...restored],
                });

                if (typeof (excalidrawAPI as any).scrollToContent === "function") {
                  (excalidrawAPI as any).scrollToContent(restored, {
                    fitToViewport: true,
                    animate: true,
                  });
                } else if (typeof (excalidrawAPI as any).setViewport === "function") {
                  (excalidrawAPI as any).setViewport({
                    target: restored,
                    fit: "scale-down",
                    animation: true,
                  });
                }
                setLastAction(`Çizildi (${converted.length} öge)`);
                setTimeout(() => setLastAction(null), 4000);
              }
            } else if (data.type === "html" && data.html) {
              setLastAction("HTML Wireframe aktarılıyor...");
              const { parseHtmlToExcalidraw } = await import(
                "../utils/htmlToExcalidraw"
              );
              const { convertToExcalidrawElements, restoreElements } = await import(
                "@excalidraw/excalidraw"
              );
              const { getSmartPlacementCoords } = await import(
                "../utils/canvasContext"
              );

              const ownerDoc =
                containerRef.current?.ownerDocument ||
                (excalidrawAPI as any)?.renderEnvironment?.document ||
                document;
              const ownerWin =
                ownerDoc?.defaultView ||
                (excalidrawAPI as any)?.renderEnvironment?.defaultView ||
                window;

              const currentElements =
                data.mode === "append"
                  ? excalidrawAPI.getSceneElements().filter((el) => !el.isDeleted)
                  : [];
              const placement = getSmartPlacementCoords(
                currentElements,
                960,
                600,
                data.mode === "append" ? "right" : "replace",
              );

              const result = parseHtmlToExcalidraw(data.html, {
                ownerDocument: ownerDoc,
                ownerWindow: ownerWin,
                originX: placement.x,
                originY: placement.y,
                frameName: data.title || "UI Wireframe Container",
                createFrame: true,
                createContainerCard: true,
                locked: data.locked === true,
              });

              if (result.elements && result.elements.length > 0) {
                const converted = convertToExcalidrawElements(result.elements, {
                  regenerateIds: false,
                  renderEnvironment: (excalidrawAPI as any)?.renderEnvironment,
                });

                const restored = restoreElements(converted, null, {
                  repairBindings: true,
                  refreshDimensions: true,
                });

                if (data.mode !== "append") {
                  excalidrawAPI.resetScene();
                }
                const baseElements = data.mode === "append" ? currentElements : [];
                excalidrawAPI.updateScene({
                  elements: [...baseElements, ...restored],
                });

                if (typeof (excalidrawAPI as any).scrollToContent === "function") {
                  (excalidrawAPI as any).scrollToContent(restored, {
                    fitToViewport: true,
                    animate: true,
                  });
                } else if (typeof (excalidrawAPI as any).setViewport === "function") {
                  (excalidrawAPI as any).setViewport({
                    target: restored,
                    fit: "scale-down",
                    animation: true,
                  });
                }
                setLastAction(`Wireframe konteyner eklendi (${restored.length} öge, kilitli)`);
                setTimeout(() => setLastAction(null), 4000);
              }
            } else if (data.type === "elements" && Array.isArray(data.elements)) {
              setLastAction("Çizim güncelleniyor...");
              const { convertToExcalidrawElements, restoreElements } = await import(
                "@excalidraw/excalidraw"
              );
              const processedElements = convertToExcalidrawElements(
                data.elements,
                {
                  regenerateIds: false,
                  renderEnvironment: excalidrawAPI.renderEnvironment,
                },
              );
              const restored = restoreElements(processedElements, null, {
                repairBindings: true,
                refreshDimensions: true,
              });
              const currentElements =
                data.mode === "append" ? excalidrawAPI.getSceneElements() : [];
              excalidrawAPI.updateScene({
                elements: [...currentElements, ...restored],
              });
              excalidrawAPI.setViewport?.({
                target: restored,
                fit: "scale-down",
                animation: true,
              });
              setLastAction(`Güncellendi (${restored.length} öge)`);
              setTimeout(() => setLastAction(null), 4000);
            } else if (data.type === "clear") {
              excalidrawAPI.resetScene();
              setLastAction("Tuval temizlendi");
              setTimeout(() => setLastAction(null), 3000);
            }
          } catch (err) {
            console.error("[LiveMcpBridge] Error handling event:", err);
            setLastAction("Hata oluştu");
            setTimeout(() => setLastAction(null), 3000);
          }
        };

        es.onerror = () => {
          setIsConnected(false);
          es.close();
          eventSourceRef.current = null;
          reconnectTimer = setTimeout(connect, 3000);
        };
      } catch (err) {
        setIsConnected(false);
        reconnectTimer = setTimeout(connect, 3000);
      }
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [isCurrentActive, excalidrawAPI, syncUrl]);

  // Periodically sync canvas semantic context to MCP server (port 3001)
  useEffect(() => {
    if (!isConnected || !isCurrentActive) return;

    const pushContext = async () => {
      try {
        const engine = getActiveEngine();
        let ctx: any = null;
        if (engine) {
          ctx = await engine.getContext();
        } else if (excalidrawAPI) {
          const { extractCanvasSemanticContext } = await import("../utils/canvasContext");
          ctx = extractCanvasSemanticContext(excalidrawAPI);
        }

        const currentWs = getActiveWorkspace();
        const activeProj = getActiveProject();
        const payload = {
          ...(ctx || {}),
          canvasType: currentWs.canvasType,
          category: currentWs.category,
          workspaceId: currentWs.id,
          workspaceName: currentWs.name,
          sdlcOverview: {
            projectId: activeProj.id,
            projectName: activeProj.name,
            activeWorkspaceId: currentWs.id,
            splitWorkspaceId: getSplitWorkspaceId(),
            workspaces: getProjectWorkspaces(activeProj.id),
            tasks: getProjectTasks(activeProj.id),
            tddScenarios: getProjectTDDScenarios(activeProj.id),
            team: getProjectTeam(activeProj.id),
          },
        };

        await fetch("http://localhost:3001/api/canvas-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {}
    };

    const unsubEngine = subscribeActiveEngine(() => {
      pushContext();
    });

    const interval = setInterval(pushContext, 4000);
    pushContext();

    return () => {
      clearInterval(interval);
      unsubEngine();
    };
  }, [isCurrentActive, isConnected, excalidrawAPI]);

  if (!isCurrentActive) {
    return null;
  }

  return (
    <button
      ref={containerRef}
      type="button"
      className="live-mcp-badge"
      onClick={onOpenModal}
      title={t("sdlc.mcp.bridgeTooltip")}
    >
      <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
      <span className="status-label">
        {isConnected ? t("sdlc.mcp.activeBadge") : t("sdlc.mcp.offlineBadge")}
      </span>
      {lastAction && (
        <span className="action-pill">
          {lastAction}
        </span>
      )}
    </button>
  );
};
