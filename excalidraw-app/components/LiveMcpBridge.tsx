import React, { useEffect, useState, useRef } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "./LiveMcpBridge.scss";

interface LiveMcpBridgeProps {
  excalidrawAPI: ExcalidrawImperativeAPI | null;
  onOpenModal?: () => void;
  syncUrl?: string;
}

export const LiveMcpBridge: React.FC<LiveMcpBridgeProps> = ({
  excalidrawAPI,
  onOpenModal,
  syncUrl = "http://localhost:3001/api/live-events",
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const containerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
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
            if (!excalidrawAPI) return;

            if (data.type === "mermaid" && data.code) {
              setLastAction("Mermaid aktarılıyor...");
              const { parseMermaidToExcalidraw } = await import(
                "@excalidraw/mermaid-to-excalidraw"
              );
              const { convertToExcalidrawElements, restoreElements } = await import(
                "@excalidraw/excalidraw"
              );
              const result = await parseMermaidToExcalidraw(data.code);
              if (result?.elements && result.elements.length > 0) {
                const converted = convertToExcalidrawElements(
                  result.elements,
                  {
                    regenerateIds: true,
                    renderEnvironment: excalidrawAPI.renderEnvironment,
                  },
                );

                if (typeof excalidrawAPI.addElementsFromPasteOrLibrary === "function") {
                  if (data.mode !== "append") {
                    excalidrawAPI.resetScene();
                  }
                  excalidrawAPI.addElementsFromPasteOrLibrary({
                    elements: converted,
                    files: result.files || null,
                    position: "center",
                    fit: "scale-down",
                  });
                } else {
                  const restored = restoreElements(converted, null, {
                    repairBindings: true,
                    refreshDimensions: true,
                  });
                  const currentElements =
                    data.mode === "append"
                      ? excalidrawAPI.getSceneElements()
                      : [];
                  excalidrawAPI.updateScene({
                    elements: [...currentElements, ...restored],
                  });
                  excalidrawAPI.setViewport?.({
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
                locked: true,
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
  }, [excalidrawAPI, syncUrl]);

  // Periodically sync canvas semantic context to MCP server (port 3001)
  useEffect(() => {
    if (!excalidrawAPI || !isConnected) return;

    const pushContext = async () => {
      try {
        const { extractCanvasSemanticContext } = await import("../utils/canvasContext");
        const ctx = extractCanvasSemanticContext(excalidrawAPI);
        await fetch("http://localhost:3001/api/canvas-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ctx),
        });
      } catch {}
    };

    const interval = setInterval(pushContext, 4000);
    pushContext();

    return () => {
      clearInterval(interval);
    };
  }, [excalidrawAPI, isConnected]);

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
