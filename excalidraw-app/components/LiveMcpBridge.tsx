import React, { useEffect, useState, useRef } from "react";
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
  createProjectTask,
  updateProjectTask,
  createTDDScenario,
  updateTDDScenario,
  generateTDDFromTask,
  subscribeWorkspaces,
} from "../workspace/workspaceStore";
import "./LiveMcpBridge.scss";

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
      title="Canlı MCP Köprüsü ayarlarını açmak için tıklayın"
    >
      <span className={`status-dot ${isConnected ? "connected" : "disconnected"}`} />
      <span className="status-label">
        {isConnected ? "Live MCP: Aktif" : "Live MCP: Çevrimdışı"}
      </span>
      {lastAction && (
        <span className="action-pill">
          {lastAction}
        </span>
      )}
    </button>
  );
};
