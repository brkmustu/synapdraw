import clsx from "clsx";
import React, { useState, useEffect, useRef } from "react";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import { CheckboxItem } from "@excalidraw/excalidraw/components/CheckboxItem";
import {
  brainIcon,
  settingsIcon,
  CloseIcon,
  copyIcon,
  checkIcon,
  RetryIcon,
} from "@excalidraw/excalidraw/components/icons";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import "./AIIntegrationsModal.scss";

const StopSquareIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="3" />
  </svg>
);

const UpArrowIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const HistoryIcon = (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const TrashIcon = (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

interface AIIntegrationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  excalidrawAPI: ExcalidrawImperativeAPI | null;
}

interface AISettings {
  provider: "ollama" | "custom";
  ollamaUrl: string;
  ollamaModel: string;
  customUrl: string;
  customApiKey: string;
  customModel: string;
  autoScroll: boolean;
}

const DEFAULT_SETTINGS: AISettings = {
  provider: "ollama",
  ollamaUrl: "http://127.0.0.1:11434",
  ollamaModel: "gemma4:26b",
  customUrl: "https://api.openai.com/v1",
  customApiKey: "",
  customModel: "gpt-4o-mini",
  autoScroll: true,
};

const PRESET_TYPES = [
  { label: "Architecture", hint: "Sistem ve mikroservis mimarisi (graph TB)" },
  { label: "Flowchart", hint: "İşlem ve akış şeması (graph TD)" },
  { label: "UI Wireframe (HTML)", hint: "HTML/CSS ile modern arayüz ve bileşen tasarımı" },
  { label: "Sequence", hint: "Sıralı etkileşim diyagramı (sequenceDiagram)" },
  { label: "Class Diagram", hint: "Sınıf ve nesne ilişkileri (classDiagram)" },
  { label: "Mindmap", hint: "Zihin haritası (mindmap)" },
];

const PROMPT_SUGGESTIONS = [
  "Modern SaaS dashboard giriş ve kayıt kartı bileşeni",
  "Redis Cache, PostgreSQL ve Kafka içeren mikroservis sipariş mimarisi",
  "Fiyatlandırma planları (Free, Pro, Enterprise) karşılaştırma tablosu",
  "JWT Authentication ve OAuth2 oturum açma sıralı etkileşim diyagramı",
  "Kullanıcı kayıt, e-posta doğrulama ve yetkilendirme akış şeması",
];

const MCP_CONFIG_JSON = JSON.stringify(
  {
    mcpServers: {
      excalidraw: {
        command: "node",
        args: ["C:/Users/mburakmustu/.excalidraw/mcp/index.js", "--stdio"],
      },
    },
  },
  null,
  2,
);

/**
 * Sanitizes common LLM Mermaid syntax mistakes before parsing.
 */
function sanitizeMermaid(rawCode: string): string {
  let cleaned = rawCode
    .replace(/```(?:mermaid)?/gi, "")
    .replace(/```/g, "")
    .trim();

  // Extract from the first diagram keyword if there is preamble
  const diagramKeywords = [
    "graph",
    "flowchart",
    "sequenceDiagram",
    "classDiagram",
    "stateDiagram-v2",
    "stateDiagram",
    "erDiagram",
    "gantt",
    "pie",
    "mindmap",
  ];
  let firstKeywordIndex = -1;
  for (const kw of diagramKeywords) {
    const idx = cleaned.search(new RegExp(`\\b${kw}\\b`, "i"));
    if (idx !== -1 && (firstKeywordIndex === -1 || idx < firstKeywordIndex)) {
      firstKeywordIndex = idx;
    }
  }
  if (firstKeywordIndex > 0) {
    cleaned = cleaned.slice(firstKeywordIndex).trim();
  }

  const isClassDiagram = /^classDiagram\b/im.test(cleaned);

  // If NOT a class diagram, UML class diagram connectors are invalid in flowcharts/graphs
  if (!isClassDiagram) {
    cleaned = cleaned
      .replace(/<\|--/g, "-->")
      .replace(/--\|>/g, "-->")
      .replace(/<\|\.\./g, "-.->")
      .replace(/\.\.\|>/g, "-.->")
      .replace(/\*--/g, "-->")
      .replace(/--\*/g, "-->")
      .replace(/o--/g, "-->")
      .replace(/--o/g, "-->");
  }

  // Clean invalid token combinations across all diagram types
  // 1. Strip broken operators at the end of lines (e.g. &|, |&, or dangling & / |)
  cleaned = cleaned.replace(/(&\||\|\&|\&|\|)\s*$/gm, "");
  // 2. Broken operators between nodes (e.g. A &| B -> A & B)
  cleaned = cleaned.replace(/(&\||\|\&)/g, " & ");

  // 3. Fix broken arrow combinations like <--| or |--
  cleaned = cleaned.replace(/<--\|/g, "<--");
  cleaned = cleaned.replace(/\|-->/g, "-->");

  // Process line by line for any hanging syntax or malformed lines
  const lines = cleaned.split("\n");
  const filteredLines = lines
    .map((line) => {
      let l = line.trimEnd();
      // Remove trailing dangling operators at line end
      l = l.replace(/(&|\+|\|)\s*$/, "").trimEnd();
      return l;
    })
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      // Filter out markdown artifacts or commentary lines that don't belong in mermaid
      if (
        t.startsWith("Note:") ||
        t.startsWith("Explanation:") ||
        t.startsWith("Here is") ||
        t.startsWith("Here's")
      ) {
        return false;
      }
      return true;
    });

  return filteredLines.join("\n").trim();
}

interface AISavedSession {
  submittedPrompt: string | null;
  streamedContent: string;
  editableMermaidCode: string;
  generationStatus: "idle" | "connecting" | "generating" | "parsing" | "success" | "error";
  selectedPreset: string;
  renderMode: "replace" | "append";
}

const loadSavedSession = (): AISavedSession | null => {
  try {
    const raw = localStorage.getItem("excalidraw_ai_last_session");
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

interface AIChatHistoryItem {
  id: string;
  title: string;
  prompt: string;
  mermaidCode: string;
  preset: string;
  timestamp: number;
  model: string;
  status: "success" | "error";
}

const loadChatHistory = (): AIChatHistoryItem[] => {
  try {
    const raw = localStorage.getItem("excalidraw_ai_chat_history");
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
};

const formatHistoryTime = (timestamp: number): string => {
  const date = new Date(timestamp);
  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");

  if (isToday) {
    return `Bugün ${hours}:${minutes}`;
  }
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  return `${day}.${month} ${hours}:${minutes}`;
};

export const AIIntegrationsModal: React.FC<AIIntegrationsModalProps> = ({
  isOpen,
  onClose,
  excalidrawAPI,
}) => {
  const [activeSidebarTab, setActiveSidebarTab] = useState<"studio" | "history" | "settings">(
    "studio",
  );
  const [copiedTarget, setCopiedTarget] = useState<"user" | "ai" | null>(null);

  // Chat History
  const [chatHistory, setChatHistory] = useState<AIChatHistoryItem[]>(loadChatHistory);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  // Load last session from localStorage so closing and reopening preserves state
  const savedSession = useRef(loadSavedSession()).current;

  const [prompt, setPrompt] = useState("");
  const [submittedPrompt, setSubmittedPrompt] = useState<string | null>(
    () => savedSession?.submittedPrompt ?? null,
  );
  const [selectedPreset, setSelectedPreset] = useState<string>(
    () => savedSession?.selectedPreset ?? "Architecture",
  );
  const [renderMode, setRenderMode] = useState<"replace" | "append">(
    () => savedSession?.renderMode ?? "replace",
  );

  // Streaming & Generation State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState<
    "idle" | "connecting" | "generating" | "parsing" | "success" | "error"
  >(() => {
    if (savedSession?.streamedContent) {
      return savedSession.generationStatus === "generating"
        ? "success"
        : (savedSession.generationStatus ?? "success");
    }
    return "idle";
  });
  const [streamedContent, setStreamedContent] = useState<string>(
    () => savedSession?.streamedContent ?? "",
  );
  const [editableMermaidCode, setEditableMermaidCode] = useState<string>(
    () => savedSession?.editableMermaidCode ?? "",
  );
  const [isEditingCode, setIsEditingCode] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [parseErrorDetails, setParseErrorDetails] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const workspaceCanvasRef = useRef<HTMLDivElement | null>(null);
  const codePreRef = useRef<HTMLPreElement | null>(null);
  const modalContainerRef = useRef<HTMLDivElement | null>(null);

  // Canvas Context Awareness & Selection-based Revision
  const [includeCanvasContext, setIncludeCanvasContext] = useState<boolean>(true);
  const [reviseSelectionMode, setReviseSelectionMode] = useState<boolean>(false);
  const [canvasStats, setCanvasStats] = useState<{ total: number; selected: number } | null>(null);

  useEffect(() => {
    if (!isOpen || !excalidrawAPI) return;
    try {
      const elements = excalidrawAPI.getSceneElements().filter((el) => !el.isDeleted);
      const appState = excalidrawAPI.getAppState();
      const selectedCount = Object.keys(appState.selectedElementIds || {}).filter(
        (id) => (appState.selectedElementIds as any)[id],
      ).length;
      setCanvasStats({ total: elements.length, selected: selectedCount });
      if (selectedCount > 0) {
        setReviseSelectionMode(true);
      }
    } catch {}
  }, [isOpen, excalidrawAPI]);

  // Settings
  const [settings, setSettings] = useState<AISettings>(() => {
    try {
      const stored = localStorage.getItem("excalidraw_ai_settings");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.ollamaUrl === "http://localhost:11434") {
          parsed.ollamaUrl = "http://127.0.0.1:11434";
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  // Available models from Ollama
  const [availableModels, setAvailableModels] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem("excalidraw_ollama_models");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  // Live MCP status
  const [mcpStatus, setMcpStatus] = useState<"connected" | "offline">("offline");
  const [isConfigCopied, setIsConfigCopied] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("excalidraw_ai_settings", JSON.stringify(settings));
    } catch {}
  }, [settings]);

  // Save session state to localStorage so closing the modal doesn't lose anything
  useEffect(() => {
    try {
      if (submittedPrompt || streamedContent) {
        localStorage.setItem(
          "excalidraw_ai_last_session",
          JSON.stringify({
            submittedPrompt,
            streamedContent,
            editableMermaidCode,
            generationStatus: isGenerating ? "generating" : generationStatus,
            selectedPreset,
            renderMode,
          }),
        );
      }
    } catch {}
  }, [
    submittedPrompt,
    streamedContent,
    editableMermaidCode,
    generationStatus,
    isGenerating,
    selectedPreset,
    renderMode,
  ]);

  // Elapsed timer while generating
  useEffect(() => {
    let timer: any = null;
    if (isGenerating) {
      setElapsedTime(0);
      timer = setInterval(() => {
        setElapsedTime((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isGenerating]);

  // Auto-scroll both the inner code pre and outer workspace canvas down as new tokens stream
  useEffect(() => {
    if (codePreRef.current) {
      codePreRef.current.scrollTop = codePreRef.current.scrollHeight;
    }
    if (workspaceCanvasRef.current) {
      workspaceCanvasRef.current.scrollTop = workspaceCanvasRef.current.scrollHeight;
    }
  }, [streamedContent]);

  // Check MCP status
  useEffect(() => {
    if (!isOpen) return;
    const checkMcp = async () => {
      try {
        const res = await fetch("http://localhost:3001/api/status");
        if (res.ok) {
          setMcpStatus("connected");
        } else {
          setMcpStatus("offline");
        }
      } catch {
        setMcpStatus("offline");
      }
    };
    checkMcp();
  }, [isOpen]);

  // Fetch Ollama models with IPv4 fallback
  const fetchOllamaModels = async (explicitUrl?: string) => {
    setIsFetchingModels(true);
    setStatusMessage(null);

    const targetUrl = explicitUrl || settings.ollamaUrl || "http://127.0.0.1:11434";
    const candidates = [targetUrl];
    if (targetUrl.includes("localhost")) {
      candidates.push(targetUrl.replace("localhost", "127.0.0.1"));
    } else if (targetUrl.includes("127.0.0.1")) {
      candidates.push(targetUrl.replace("127.0.0.1", "localhost"));
    }

    let foundModels: string[] = [];
    let workingUrl = targetUrl;
    let lastError = "";

    for (const url of candidates) {
      try {
        const cleanUrl = url.replace(/\/+$/, "");
        const res = await fetch(`${cleanUrl}/api/tags`, {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        });
        if (res.ok) {
          const data = await res.json();
          foundModels = data.models?.map((m: any) => m.name) || [];
          workingUrl = cleanUrl;
          break;
        }
      } catch (err: any) {
        lastError = err.message;
      }
    }

    setIsFetchingModels(false);

    if (foundModels.length > 0) {
      setAvailableModels(foundModels);
      try {
        localStorage.setItem("excalidraw_ollama_models", JSON.stringify(foundModels));
      } catch {}

      setSettings((prev) => {
        const nextUrl = prev.ollamaUrl !== workingUrl ? workingUrl : prev.ollamaUrl;
        const nextModel = foundModels.includes(prev.ollamaModel)
          ? prev.ollamaModel
          : foundModels[0];
        return { ...prev, ollamaUrl: nextUrl, ollamaModel: nextModel };
      });
      return foundModels;
    } else {
      if (lastError) {
        setStatusMessage({
          type: "error",
          text: `Ollama bağlantı hatası (${targetUrl}): ${lastError}. Ollama açık mı?`,
        });
      }
      return [];
    }
  };

  // Auto-fetch Ollama models on modal open or when provider changes
  useEffect(() => {
    if (!isOpen) return;
    if (settings.provider === "ollama") {
      fetchOllamaModels();
    }
  }, [isOpen, settings.provider]);

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(MCP_CONFIG_JSON);
      setIsConfigCopied(true);
      setTimeout(() => setIsConfigCopied(false), 2000);
    } catch (err) {
      console.error("Kopyalama başarısız:", err);
    }
  };

  // Sync chat history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("excalidraw_ai_chat_history", JSON.stringify(chatHistory));
    } catch {}
  }, [chatHistory]);

  const handleStartNewChat = () => {
    setCurrentChatId(null);
    setSubmittedPrompt(null);
    setStreamedContent("");
    setEditableMermaidCode("");
    setIsEditingCode(false);
    setGenerationStatus("idle");
    setParseErrorDetails(null);
    setStatusMessage(null);
    setPrompt("");
    setActiveSidebarTab("studio");
    try {
      localStorage.removeItem("excalidraw_ai_last_session");
    } catch {}
  };

  const handleSelectHistoryItem = (item: AIChatHistoryItem) => {
    setCurrentChatId(item.id);
    setSubmittedPrompt(item.prompt);
    setStreamedContent(item.mermaidCode);
    setEditableMermaidCode(sanitizeMermaid(item.mermaidCode));
    setSelectedPreset(item.preset);
    setIsEditingCode(false);
    setGenerationStatus(item.status);
    setParseErrorDetails(null);
    setStatusMessage({
      type: "success",
      text: `"${item.title}" sohbeti yüklendi.`,
    });
    if (item.mermaidCode) {
      renderCodeToScene(item.mermaidCode).catch(() => {});
    }
  };

  const handleDeleteHistoryItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatHistory((prev) => prev.filter((item) => item.id !== id));
    if (currentChatId === id) {
      handleStartNewChat();
    }
  };

  const handleClearAllHistory = () => {
    if (window.confirm("Tüm sohbet geçmişini silmek istediğinize emin misiniz?")) {
      setChatHistory([]);
      try {
        localStorage.removeItem("excalidraw_ai_chat_history");
      } catch {}
      handleStartNewChat();
    }
  };

  const handleCopy = async (text: string, target: "user" | "ai") => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedTarget(target);
      setTimeout(() => setCopiedTarget(null), 2000);
    } catch (err) {
      console.error("Kopyalama başarısız:", err);
    }
  };

  const handleAbort = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
    setGenerationStatus("error");
    setStatusMessage({
      type: "error",
      text: "Çizim üretimi kullanıcı tarafından durduruldu.",
    });
  };

  // Renders the provided Mermaid code directly to Excalidraw canvas
  const renderMermaidToScene = async (rawCode: string) => {
    const cleanedCode = sanitizeMermaid(rawCode);
    setEditableMermaidCode(cleanedCode);

    setGenerationStatus("parsing");
    setParseErrorDetails(null);

    const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
    const { convertToExcalidrawElements, restoreElements } = await import("@excalidraw/excalidraw");
    const result = await parseMermaidToExcalidraw(cleanedCode);

    if (!result?.elements || result.elements.length === 0) {
      throw new Error("Mermaid diyagramı Excalidraw elemanlarına dönüştürülemedi.");
    }

    // Convert skeleton elements into fully qualified Excalidraw elements with bound centered text elements
    const converted = convertToExcalidrawElements(result.elements, {
      regenerateIds: true,
      renderEnvironment: (excalidrawAPI as any)?.renderEnvironment,
    });

    if (excalidrawAPI) {
      if (typeof (excalidrawAPI as any).addElementsFromPasteOrLibrary === "function") {
        if (renderMode !== "append") {
          excalidrawAPI.resetScene();
        }
        (excalidrawAPI as any).addElementsFromPasteOrLibrary({
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
        const currentElements = renderMode === "append" ? excalidrawAPI.getSceneElements() : [];
        excalidrawAPI.updateScene({
          elements: [...currentElements, ...restored],
        });
        if (settings.autoScroll) {
          excalidrawAPI.setViewport?.({
            target: restored,
            fit: "scale-down",
            animation: true,
          });
        }
      }
    }

    setGenerationStatus("success");
    setStatusMessage({
      type: "success",
      text: `Harika! ${converted.length} çizim elemanı (şekiller ve metinler) tuvale aktarıldı.`,
    });
  };

  // Renders either HTML Wireframe or Mermaid diagram into Excalidraw canvas
  const renderCodeToScene = async (rawCode: string) => {
    const isHtml =
      selectedPreset === "UI Wireframe (HTML)" ||
      /^\s*<(!DOCTYPE|html|div|section|form|header|main|table|button|card)/i.test(rawCode.trim());

    if (isHtml) {
      const { sanitizeHtml, parseHtmlToExcalidraw } = await import(
        "../utils/htmlToExcalidraw"
      );
      const { convertToExcalidrawElements, restoreElements } = await import(
        "@excalidraw/excalidraw"
      );
      const { getSmartPlacementCoords, extractCanvasSemanticContext } = await import(
        "../utils/canvasContext"
      );

      const cleanedCode = sanitizeHtml(rawCode);
      setEditableMermaidCode(cleanedCode);
      setGenerationStatus("parsing");
      setParseErrorDetails(null);

      const ownerDoc =
        modalContainerRef.current?.ownerDocument ||
        (excalidrawAPI as any)?.renderEnvironment?.document ||
        document;
      const ownerWin =
        ownerDoc?.defaultView ||
        (excalidrawAPI as any)?.renderEnvironment?.defaultView ||
        window;

      const currentElements =
        excalidrawAPI?.getSceneElements().filter((el) => !el.isDeleted) || [];
      const context = excalidrawAPI ? extractCanvasSemanticContext(excalidrawAPI) : null;

      const placement = getSmartPlacementCoords(
        currentElements,
        960,
        600,
        reviseSelectionMode && context?.hasSelection
          ? "replace"
          : renderMode === "append"
          ? "right"
          : "replace",
        context?.selectedBounds,
      );

      const result = parseHtmlToExcalidraw(cleanedCode, {
        ownerDocument: ownerDoc,
        ownerWindow: ownerWin,
        originX: placement.x,
        originY: placement.y,
        createFrame: true,
        createContainerCard: true,
        frameName: submittedPrompt ? submittedPrompt.slice(0, 30) : "UI Wireframe Container",
        locked: true,
      });

      if (!result?.elements || result.elements.length === 0) {
        throw new Error(
          "HTML Wireframe kodu Excalidraw elemanlarına dönüştürülemedi. Lütfen geçerli HTML etiketleri kullanın.",
        );
      }

      const converted = convertToExcalidrawElements(result.elements, {
        regenerateIds: false,
        renderEnvironment: (excalidrawAPI as any)?.renderEnvironment,
      });

      if (excalidrawAPI) {
        const restored = restoreElements(converted, null, {
          repairBindings: true,
          refreshDimensions: true,
        });
        const baseElements =
          renderMode === "append" || (reviseSelectionMode && context?.hasSelection)
            ? currentElements.filter(
                (el) =>
                  !context?.selectedBounds ||
                  !(excalidrawAPI.getAppState().selectedElementIds || {})[el.id],
              )
            : [];
        if (renderMode !== "append" && (!reviseSelectionMode || !context?.hasSelection)) {
          excalidrawAPI.resetScene();
        }
        excalidrawAPI.updateScene({
          elements: [...baseElements, ...restored],
        });
        if (settings.autoScroll) {
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
        }
      }

      setGenerationStatus("success");
      setStatusMessage({
        type: "success",
        text: `Harika! ${converted.length} UI wireframe elemanı tuvale başarıyla aktarıldı.`,
      });
      return;
    }

    // Default: Mermaid rendering
    await renderMermaidToScene(rawCode);
  };

  const handleGenerate = async (customPromptText?: string) => {
    const activePrompt = customPromptText || prompt;
    if (!activePrompt.trim()) {
      setStatusMessage({ type: "error", text: "Lütfen bir çizim açıklaması girin." });
      return;
    }

    const sessionChatId = currentChatId || Date.now().toString();
    setCurrentChatId(sessionChatId);

    setSubmittedPrompt(activePrompt.trim());
    setPrompt(""); // Clear input textbox immediately
    setIsGenerating(true);
    setGenerationStatus("connecting");
    setStreamedContent("");
    setEditableMermaidCode("");
    setIsEditingCode(false);
    setParseErrorDetails(null);
    setStatusMessage(null);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    let systemPrompt = "";
    let contextPromptSection = "";

    if (includeCanvasContext && excalidrawAPI) {
      try {
        const { extractCanvasSemanticContext, formatContextForPrompt } = await import(
          "../utils/canvasContext"
        );
        const ctx = extractCanvasSemanticContext(excalidrawAPI, reviseSelectionMode);
        contextPromptSection = `\n\nCANVAS CONTEXT / CURRENT BOARD STATE:\n${formatContextForPrompt(ctx)}`;
        if (reviseSelectionMode && ctx.hasSelection) {
          contextPromptSection += `\n\nIMPORTANT: The user specifically wants to REVISE the selected element(s). Generate an improved / updated design for the selected section that seamlessly fits with the rest of the board.`;
        }
      } catch (e) {
        console.warn("Failed to extract canvas context:", e);
      }
    }

    if (selectedPreset === "UI Wireframe (HTML)") {
      systemPrompt = `You are an expert UI/UX designer and design system architect.
Generate clean, modern, semantic HTML wireframe snippets based on the user's description.

CRITICAL HTML WIREFRAME RULES:
- Output ONLY pure, valid HTML code. Do NOT output markdown ticks (\`\`\`html), explanations, conversational notes or introductory text.
- Use semantic tags: <header>, <nav>, <main>, <section>, <article>, <form>, <button>, <input>, <table>, <ul>, <li>, <hr>.
- For cards and containers, use <div class="card" style="..."> with explicit width (e.g. 380px or 640px), padding, border (e.g. 1px solid #e2e8f0), border-radius (e.g. 8px or 12px), and background color.
- For buttons, use <button style="..."> with clear action labels, padding, background color (#3b82f6 or similar), text color (#ffffff), and border-radius (6px).
- For inputs, use <label> followed by <input type="..." placeholder="..." style="..." />.
- For badges and tags, use <span class="badge" style="...">.
- Use clean layout structures (flexbox: display: flex; flex-direction: column/row; gap: 12px;).
- Palette: Modern, clean aesthetics. #3b82f6 (primary), #ffffff (card/bg), #1e293b (text), #64748b (muted text), #e2e8f0 (border), #f8fafc (panel bg).${contextPromptSection}`;
    } else {
      systemPrompt = `You are an expert software architect and technical diagram creator.
Generate ONLY valid, syntactically correct Mermaid.js diagram code based on the user's description.

CRITICAL MERMAID SYNTAX RULES:
- Output ONLY pure Mermaid diagram code. Do NOT output markdown ticks, explanations, conversational text or notes.
- Line 1 MUST start with the diagram type:
  - If preset is Architecture or Flowchart: "graph TD"
  - If preset is Sequence: "sequenceDiagram"
  - If preset is Class Diagram: "classDiagram"
  - If preset is Mindmap: "mindmap"

MANDATORY NODE LABELS & DETAILED TEXTS:
- EVERY shape and component MUST have an explicit, informative descriptive label in brackets with quotes. Never leave bare node IDs!
- Always describe what each node is and its technology/role:
  - For services/components: NodeId["Service Name\\n(Technology / Role)"]
  - For relational databases: NodeId[("Database Name\\n(PostgreSQL / Relational DB)")]
  - For in-memory caches: NodeId[("Cache Name\\n(Redis / In-Memory Cache)")]
  - For message brokers/queues: NodeId[["Broker Name\\n(Apache Kafka / Pub-Sub)"]]
- Label connecting arrows with protocols, actions or event names:
  - -->|HTTPS / REST API|
  - -->|SQL Query / Read-Write|
  - -->|In-Memory Cache Get/Set|
  - -->|Publish: 'OrderCreated'|
  - -->|Subscribe / Consume|

FLOWCHART / ARCHITECTURE SYNTAX:
- Use ONLY valid flowchart arrows: -->, ---, -.->, ==> or labeled arrows like -->|text|
- NEVER use UML class diagram arrows like '<|--', '--|>', '*--', 'o--' inside graph or flowchart diagrams.
- NEVER output invalid character combinations like '&|', '|&', or trailing '&'.
- Keep node IDs simple alphanumeric with underscores (e.g. API_Gateway, Order_Service).
- Enclose any label containing spaces, special characters, newlines or Turkish letters in quotes: Node_A["Node Label (details)"]
- If using 'style' statements, ensure correct syntax: style NodeId fill:#f9f,stroke:#333,stroke-width:2px
- Preset type requested: ${selectedPreset}.${contextPromptSection}`;
    }

    try {
      let accumulatedCode = "";

      if (settings.provider === "ollama") {
        const activeModel = settings.ollamaModel || (availableModels[0] ?? "gemma4:26b");
        const res = await fetch(`${settings.ollamaUrl}/api/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: activeModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: activePrompt },
            ],
            stream: true,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error(`Ollama hatası (HTTP ${res.status}). Model "${activeModel}" mevcut mu?`);
        }

        setGenerationStatus("generating");
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Stream yanıtı okunamadı.");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const json = JSON.parse(trimmed);
              if (json.message?.content) {
                accumulatedCode += json.message.content;
                setStreamedContent(accumulatedCode);
              }
            } catch {}
          }
        }

        if (buffer.trim()) {
          try {
            const json = JSON.parse(buffer.trim());
            if (json.message?.content) {
              accumulatedCode += json.message.content;
              setStreamedContent(accumulatedCode);
            }
          } catch {}
        }
      } else {
        const res = await fetch(`${settings.customUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.customApiKey}`,
          },
          body: JSON.stringify({
            model: settings.customModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: activePrompt },
            ],
            temperature: 0.2,
            stream: true,
          }),
          signal: abortController.signal,
        });

        if (!res.ok) {
          throw new Error(`API hatası (HTTP ${res.status})`);
        }

        setGenerationStatus("generating");
        const reader = res.body?.getReader();
        if (!reader) throw new Error("Stream yanıtı okunamadı.");
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed === "data: [DONE]") continue;
            if (trimmed.startsWith("data: ")) {
              try {
                const json = JSON.parse(trimmed.slice(6));
                const delta = json.choices?.[0]?.delta?.content;
                if (delta) {
                  accumulatedCode += delta;
                  setStreamedContent(accumulatedCode);
                }
              } catch {}
            }
          }
        }
      }

      // Try rendering the accumulated diagram or HTML wireframe
      try {
        await renderCodeToScene(accumulatedCode);
        const historyItem: AIChatHistoryItem = {
          id: sessionChatId,
          title: activePrompt.slice(0, 42).trim() + (activePrompt.length > 42 ? "..." : ""),
          prompt: activePrompt,
          mermaidCode: accumulatedCode,
          preset: selectedPreset,
          timestamp: Date.now(),
          model: settings.provider === "ollama" ? settings.ollamaModel : settings.customModel,
          status: "success",
        };
        setChatHistory((prev) => [historyItem, ...prev.filter((i) => i.id !== sessionChatId)].slice(0, 50));
      } catch (err: any) {
        console.warn("[AIIntegrations] Parse error, opening code editor:", err);
        const isHtmlPreset = selectedPreset === "UI Wireframe (HTML)";
        setGenerationStatus("error");
        setParseErrorDetails(err.message);
        setEditableMermaidCode(isHtmlPreset ? accumulatedCode : sanitizeMermaid(accumulatedCode));
        setIsEditingCode(true);
        setStatusMessage({
          type: "error",
          text: `${isHtmlPreset ? "HTML Wireframe" : "Mermaid"} ayrıştırma hatası: ${err.message}. Koddaki hatayı düzelterek 'Tuvale Çiz' butonuna basabilirsiniz.`,
        });
        const historyItem: AIChatHistoryItem = {
          id: sessionChatId,
          title: activePrompt.slice(0, 42).trim() + (activePrompt.length > 42 ? "..." : ""),
          prompt: activePrompt,
          mermaidCode: accumulatedCode,
          preset: selectedPreset,
          timestamp: Date.now(),
          model: settings.provider === "ollama" ? settings.ollamaModel : settings.customModel,
          status: "error",
        };
        setChatHistory((prev) => [historyItem, ...prev.filter((i) => i.id !== sessionChatId)].slice(0, 50));
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        return;
      }
      console.error("[AIIntegrations] Generation error:", err);
      setGenerationStatus("error");
      setStatusMessage({ type: "error", text: `Üretim hatası: ${err.message}` });
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleManualRender = async () => {
    try {
      setStatusMessage(null);
      await renderCodeToScene(editableMermaidCode);
      if (currentChatId) {
        setChatHistory((prev) =>
          prev.map((item) =>
            item.id === currentChatId
              ? { ...item, mermaidCode: editableMermaidCode, status: "success" }
              : item,
          ),
        );
      }
    } catch (err: any) {
      setGenerationStatus("error");
      setParseErrorDetails(err.message);
      setStatusMessage({
        type: "error",
        text: `Hata devam ediyor: ${err.message}`,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <Dialog size={1060} onCloseRequest={onClose} title={false} className="gemini-studio-dialog">
      <div className="ai-gemini-container" ref={modalContainerRef}>
        {/* LEFT SIDEBAR (Controls & Settings) */}
        <aside className="ai-gemini-sidebar">
          {/* Logo / Header */}
          <div className="sidebar-brand">
            <span className="brand-icon">{brainIcon}</span>
            <div className="brand-text">
              <h3>AI Diagram Studio</h3>
              <span>Local LLM & MCP</span>
            </div>
          </div>

          {/* Sidebar Nav Tabs */}
          <div className="sidebar-tabs">
            <button
              type="button"
              className={clsx("sidebar-tab-btn", { active: activeSidebarTab === "studio" })}
              onClick={() => setActiveSidebarTab("studio")}
            >
              <span className="tab-icon">{brainIcon}</span>
              <span>Studio</span>
            </button>
            <button
              type="button"
              className={clsx("sidebar-tab-btn", { active: activeSidebarTab === "history" })}
              onClick={() => setActiveSidebarTab("history")}
            >
              <span className="tab-icon">{HistoryIcon}</span>
              <span>Geçmiş</span>
              {chatHistory.length > 0 && (
                <span className="tab-count-badge">{chatHistory.length}</span>
              )}
            </button>
            <button
              type="button"
              className={clsx("sidebar-tab-btn", { active: activeSidebarTab === "settings" })}
              onClick={() => setActiveSidebarTab("settings")}
            >
              <span className="tab-icon">{settingsIcon}</span>
              <span>Ayarlar</span>
            </button>
          </div>

          {activeSidebarTab === "studio" && (
            <div className="sidebar-content">
              {/* Provider Selection */}
              <div className="sidebar-section">
                <label className="section-label">Sağlayıcı</label>
                <select
                  className="sidebar-select"
                  value={settings.provider}
                  onChange={(e) =>
                    setSettings({ ...settings, provider: e.target.value as any })
                  }
                >
                  <option value="ollama">Ollama (Lokal LLM)</option>
                  <option value="custom">OpenAI / Özel API</option>
                </select>
              </div>

              {/* Model Selection */}
              {settings.provider === "ollama" ? (
                <div className="sidebar-section">
                  <div className="section-header-row">
                    <label className="section-label">Ollama Modeli</label>
                    <button
                      type="button"
                      className="refresh-link"
                      onClick={() => fetchOllamaModels()}
                      title="Modelleri Tara"
                      disabled={isFetchingModels}
                    >
                      <span className={clsx("spin-icon", { spinning: isFetchingModels })}>
                        {RetryIcon}
                      </span>
                      <span>{isFetchingModels ? "Taranıyor..." : "Yenile"}</span>
                    </button>
                  </div>
                  {availableModels.length > 0 ? (
                    <select
                      className="sidebar-select"
                      value={settings.ollamaModel}
                      onChange={(e) =>
                        setSettings({ ...settings, ollamaModel: e.target.value })
                      }
                    >
                      {availableModels.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type="text"
                      className="sidebar-input"
                      value={settings.ollamaModel}
                      placeholder="gemma4:26b"
                      onChange={(e) =>
                        setSettings({ ...settings, ollamaModel: e.target.value })
                      }
                    />
                  )}
                </div>
              ) : (
                <div className="sidebar-section">
                  <label className="section-label">Model Adı</label>
                  <input
                    type="text"
                    className="sidebar-input"
                    value={settings.customModel}
                    placeholder="gpt-4o-mini"
                    onChange={(e) =>
                      setSettings({ ...settings, customModel: e.target.value })
                    }
                  />
                </div>
              )}

              {/* Diagram Preset */}
              <div className="sidebar-section">
                <label className="section-label">Diyagram Türü</label>
                <div className="preset-pill-grid">
                  {PRESET_TYPES.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className={clsx("preset-pill-btn", {
                        selected: selectedPreset === p.label,
                      })}
                      onClick={() => setSelectedPreset(p.label)}
                      title={p.hint}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Canvas Mode */}
              <div className="sidebar-section">
                <label className="section-label">Tuval Çizim Modu</label>
                <select
                  className="sidebar-select"
                  value={renderMode}
                  onChange={(e) => setRenderMode(e.target.value as any)}
                >
                  <option value="replace">Tuvali Temizle ve Yeni Çiz</option>
                  <option value="append">Mevcut Çizimi Koru, Yanına Ekle</option>
                </select>
              </div>

              {/* Context Awareness & Revision */}
              <div className="sidebar-section">
                <label className="section-label">Tuval Bağlamı & Revizyon</label>
                <div className="checkbox-section">
                  <CheckboxItem
                    checked={includeCanvasContext}
                    onChange={(checked) => setIncludeCanvasContext(checked)}
                  >
                    Tuval Bağlamını İlet ({canvasStats?.total ?? 0} bileşen)
                  </CheckboxItem>
                  {canvasStats && canvasStats.selected > 0 && (
                    <CheckboxItem
                      checked={reviseSelectionMode}
                      onChange={(checked) => setReviseSelectionMode(checked)}
                    >
                      🎯 Seçili Elemanı Revize Et ({canvasStats.selected} seçili)
                    </CheckboxItem>
                  )}
                </div>
              </div>

              {/* Auto Scroll Checkbox */}
              <div className="sidebar-section checkbox-section">
                <CheckboxItem
                  checked={settings.autoScroll}
                  onChange={(checked) =>
                    setSettings({ ...settings, autoScroll: checked })
                  }
                >
                  Tamamlanınca tuvali odakla
                </CheckboxItem>
              </div>

              {/* Mini MCP Status Card in sidebar */}
              <div className="sidebar-mcp-badge">
                <span className={clsx("dot", { online: mcpStatus === "connected" })} />
                <span>Live MCP: {mcpStatus === "connected" ? "3001 Aktif" : "Çevrimdışı"}</span>
              </div>
            </div>
          )}

          {activeSidebarTab === "history" && (
            <div className="sidebar-content history-tab-content">
              {/* Start new chat button */}
              <button
                type="button"
                className="sidebar-new-chat-btn"
                onClick={handleStartNewChat}
              >
                <span className="btn-icon">＋</span>
                <span>Yeni Sohbet Başlat</span>
              </button>

              {chatHistory.length > 0 ? (
                <>
                  <div className="history-items-list">
                    {chatHistory.map((item) => (
                      <div
                        key={item.id}
                        className={clsx("history-item-card", {
                          active: currentChatId === item.id,
                        })}
                        onClick={() => handleSelectHistoryItem(item)}
                      >
                        <div className="history-item-main">
                          <span className="history-item-title">{item.title}</span>
                          <div className="history-item-meta">
                            <span className="history-badge">{item.preset}</span>
                            <span className="history-time">{formatHistoryTime(item.timestamp)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="delete-history-btn"
                          onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                          title="Sohbeti Sil"
                        >
                          {TrashIcon}
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="clear-all-history-btn"
                    onClick={handleClearAllHistory}
                  >
                    Tüm Geçmişi Temizle
                  </button>
                </>
              ) : (
                <div className="history-empty-state">
                  <span className="empty-icon">{HistoryIcon}</span>
                  <p>Henüz kayıtlı sohbet yok.</p>
                  <span className="empty-sub">
                    Ürettiğiniz çizimler ve istemler otomatik olarak burada listelenecektir.
                  </span>
                </div>
              )}
            </div>
          )}

          {activeSidebarTab === "settings" && (
            <div className="sidebar-content">
              {/* Ollama URL */}
              <div className="sidebar-section">
                <label className="section-label">Ollama API URL</label>
                <div className="input-with-button">
                  <input
                    type="text"
                    className="sidebar-input"
                    value={settings.ollamaUrl}
                    onChange={(e) =>
                      setSettings({ ...settings, ollamaUrl: e.target.value })
                    }
                    placeholder="http://127.0.0.1:11434"
                  />
                  <button
                    type="button"
                    className="side-action-btn"
                    onClick={() => fetchOllamaModels(settings.ollamaUrl)}
                    disabled={isFetchingModels}
                  >
                    Bağlan
                  </button>
                </div>
              </div>

              {/* Custom API credentials */}
              <div className="sidebar-section">
                <label className="section-label">OpenAI API Base URL</label>
                <input
                  type="text"
                  className="sidebar-input"
                  value={settings.customUrl}
                  onChange={(e) =>
                    setSettings({ ...settings, customUrl: e.target.value })
                  }
                />
              </div>

              <div className="sidebar-section">
                <label className="section-label">OpenAI API Key</label>
                <input
                  type="password"
                  className="sidebar-input"
                  value={settings.customApiKey}
                  placeholder="sk-..."
                  onChange={(e) =>
                    setSettings({ ...settings, customApiKey: e.target.value })
                  }
                />
              </div>

              {/* Claude Desktop Config Snippet */}
              <div className="sidebar-section">
                <div className="section-header-row">
                  <label className="section-label">Claude Desktop MCP</label>
                  <button
                    type="button"
                    className="refresh-link"
                    onClick={handleCopyConfig}
                  >
                    <span>{isConfigCopied ? "Kopyalandı" : "Kopyala"}</span>
                  </button>
                </div>
                <pre className="sidebar-code-snippet">
                  <code>{MCP_CONFIG_JSON}</code>
                </pre>
              </div>
            </div>
          )}
        </aside>

        {/* RIGHT MAIN WORKSPACE (Gemini UI Canvas) */}
        <main className="ai-gemini-workspace">
          {/* Top Bar with model chip, clear session and close button */}
          <header className="workspace-header">
            <div className="header-chips">
              <span className="model-chip">
                {settings.provider === "ollama" ? settings.ollamaModel : settings.customModel}
              </span>
              <span className="type-chip">{selectedPreset}</span>
              {isGenerating && (
                <span className="generating-chip">
                  <span className="pulse-dot" />
                  Üretiliyor ({elapsedTime}s)
                </span>
              )}
              {submittedPrompt && !isGenerating && (
                <button
                  type="button"
                  className="new-session-chip-btn"
                  onClick={handleStartNewChat}
                  title="Geçmişi temizle ve yeni bir çizim başlat"
                >
                  <span className="btn-icon">✨</span>
                  <span>Yeni Çizim</span>
                </button>
              )}
            </div>
            <button
              type="button"
              className="workspace-close-btn"
              onClick={onClose}
              title="Kapat"
              aria-label="Kapat"
            >
              {CloseIcon}
            </button>
          </header>

          {/* Chat / Canvas Area */}
          <div className="workspace-canvas" ref={workspaceCanvasRef}>
            {/* If no prompt submitted yet, show welcome empty state */}
            {!submittedPrompt && !isGenerating && !streamedContent && (
              <div className="gemini-empty-state">
                <div className="empty-sparkle-icon">{brainIcon}</div>
                <h2>Mimari veya Akış Şeması Çizin</h2>
                <p>
                  Yapay zekaya sistem bileşenlerinizi, veri tabanlarınızı ve mikroservislerinizi
                  anlatın; anında Excalidraw tuvalinize çizsin.
                </p>

                <div className="suggestion-cards">
                  {PROMPT_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      className="suggestion-card"
                      onClick={() => {
                        setPrompt("");
                        handleGenerate(sug);
                      }}
                    >
                      <span className="sug-arrow">➔</span>
                      <span>{sug}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* If prompt submitted, display user message bubble with copy button */}
            {submittedPrompt && (
              <div className="gemini-message user-message">
                <div className="message-avatar">👤</div>
                <div className="message-bubble">
                  <div className="user-message-header">
                    <span className="bubble-header">İstemi (Prompt)</span>
                    <button
                      type="button"
                      className="copy-bubble-btn"
                      onClick={() => handleCopy(submittedPrompt, "user")}
                      title="İstemi Kopyala"
                    >
                      <span className="btn-icon">
                        {copiedTarget === "user" ? checkIcon : copyIcon}
                      </span>
                      <span>{copiedTarget === "user" ? "Kopyalandı" : "Kopyala"}</span>
                    </button>
                  </div>
                  <div className="bubble-text">{submittedPrompt}</div>
                </div>
              </div>
            )}

            {/* AI Response Bubble */}
            {(isGenerating || streamedContent || parseErrorDetails) && (
              <div className="gemini-message ai-message">
                <div className="message-avatar ai-avatar">{brainIcon}</div>
                <div className="message-bubble">
                  <div className="ai-status-row">
                    <div className="status-indicator">
                      <span
                        className={clsx("status-bullet", {
                          active: isGenerating && generationStatus === "generating",
                          connecting: generationStatus === "connecting",
                          parsing: generationStatus === "parsing",
                          error: generationStatus === "error",
                          success: generationStatus === "success",
                        })}
                      />
                      <span className="status-label-text">
                        {generationStatus === "connecting" && "Ollama modeline bağlanılıyor..."}
                        {generationStatus === "generating" &&
                          `Canlı Kod Akışı (${settings.provider === "ollama" ? settings.ollamaModel : settings.customModel})`}
                        {generationStatus === "parsing" && "Mermaid kodu tuvale dönüştürülüyor..."}
                        {generationStatus === "success" && "✓ Çizim başarıyla tuvale aktarıldı"}
                        {generationStatus === "error" && "Üretimde sözdizimi hatası veya kesinti oluştu"}
                      </span>
                    </div>

                    <div className="status-stats-row">
                      <span className="stats-time">
                        {elapsedTime > 0 && `${elapsedTime}s`}
                        {streamedContent.length > 0 && ` • ${streamedContent.length} karakter`}
                      </span>
                      {isGenerating && (
                        <button
                          type="button"
                          className="stop-stream-btn"
                          onClick={handleAbort}
                          title="Üretimi Durdur"
                        >
                          <span className="stop-icon">{StopSquareIcon}</span>
                          <span>Durdur</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Code Editor or Read-only Display with code header & copy button */}
                  <div className="ai-code-viewer">
                    {isEditingCode ? (
                      <div className="code-editor-wrap">
                        <div className="editor-banner">
                          <span>🛠️ Üretilen {selectedPreset === "UI Wireframe (HTML)" ? "HTML Wireframe" : "Mermaid"} kodunu düzenleyip tuvale aktarabilirsiniz:</span>
                          <div className="editor-banner-actions">
                            <button
                              type="button"
                              className="copy-header-btn"
                              onClick={() => handleCopy(editableMermaidCode, "ai")}
                              title="Kodu Kopyala"
                            >
                              <span className="btn-icon">
                                {copiedTarget === "ai" ? checkIcon : copyIcon}
                              </span>
                              <span>{copiedTarget === "ai" ? "Kopyalandı" : "Kodu Kopyala"}</span>
                            </button>
                            <button
                              type="button"
                              className="render-now-btn"
                              onClick={handleManualRender}
                            >
                              🚀 Düzeltilmiş Kodu Tuvale Çiz
                            </button>
                          </div>
                        </div>
                        <textarea
                          className="mermaid-code-textarea"
                          value={editableMermaidCode}
                          onChange={(e) => setEditableMermaidCode(e.target.value)}
                          rows={12}
                          spellCheck={false}
                        />
                      </div>
                    ) : (
                      <div className="code-viewer-container">
                        <div className="code-viewer-header">
                          <span className="code-lang-label">
                            {selectedPreset === "UI Wireframe (HTML)" ? "html" : "mermaid"}
                          </span>
                          {streamedContent && (
                            <button
                              type="button"
                              className="copy-header-btn"
                              onClick={() => handleCopy(streamedContent, "ai")}
                              title="Kodu Kopyala"
                            >
                              <span className="btn-icon">
                                {copiedTarget === "ai" ? checkIcon : copyIcon}
                              </span>
                              <span>{copiedTarget === "ai" ? "Kopyalandı" : "Kodu Kopyala"}</span>
                            </button>
                          )}
                        </div>
                        <pre className="mermaid-pre" ref={codePreRef}>
                          <code>{streamedContent || "Modelden ilk token bekleniyor..."}</code>
                          {isGenerating && <span className="stream-cursor">▊</span>}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Actions when done or error */}
                  {!isGenerating && streamedContent && !isEditingCode && (
                    <div className="post-generation-actions">
                      <button
                        type="button"
                        className="copy-action-btn"
                        onClick={() => handleCopy(streamedContent, "ai")}
                      >
                        <span className="btn-icon">
                          {copiedTarget === "ai" ? checkIcon : copyIcon}
                        </span>
                        <span>{copiedTarget === "ai" ? "Kopyalandı" : "Kodu Kopyala"}</span>
                      </button>
                      <button
                        type="button"
                        className="secondary-action-btn"
                        onClick={() => {
                          const isHtml = selectedPreset === "UI Wireframe (HTML)";
                          setEditableMermaidCode(isHtml ? streamedContent : sanitizeMermaid(streamedContent));
                          setIsEditingCode(true);
                        }}
                      >
                        ✏️ Kodu Düzenle
                      </button>
                      <button
                        type="button"
                        className="primary-action-btn"
                        onClick={() => renderCodeToScene(streamedContent)}
                      >
                        🔄 Tuvalde Yeniden Çiz
                      </button>
                    </div>
                  )}

                  {/* Error banner with auto-fix trigger */}
                  {parseErrorDetails && (
                    <div className="parse-error-card">
                      <div className="error-title">
                        ⚠️ {selectedPreset === "UI Wireframe (HTML)" ? "HTML Wireframe Hatası" : "Mermaid Sözdizimi Hatası"}
                      </div>
                      <div className="error-text">{parseErrorDetails}</div>
                      <div className="error-tip">
                        {selectedPreset === "UI Wireframe (HTML)"
                          ? "Yapay zeka modeli geçersiz veya kapanmamış HTML etiketleri üretmiş olabilir. Yukarıdaki kod düzenleyicide kodu düzelterek tuvale aktarabilirsiniz."
                          : "Yapay zeka modeli geçersiz bir ok veya etiket sözdizimi üretmiş olabilir. Yukarıdaki kod düzenleyicide hatalı satırı düzelterek doğrudan tuvale aktarabilirsiniz."}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Status message */}
            {statusMessage && (
              <div className={clsx("floating-alert", statusMessage.type)}>
                <span className="alert-icon">
                  {statusMessage.type === "success" ? checkIcon : "⚠️"}
                </span>
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>

          {/* Bottom Gemini-style Input Bar */}
          <footer className="gemini-input-bar-wrap">
            {includeCanvasContext && canvasStats && canvasStats.total > 0 && (
              <div className="gemini-input-context-pill">
                <span className="pill-dot" />
                <span>Tuval Bağlamı: {canvasStats.total} eleman</span>
                {reviseSelectionMode && canvasStats.selected > 0 && (
                  <span className="pill-selected">🎯 {canvasStats.selected} seçili revize edilecek</span>
                )}
              </div>
            )}
            <div className="gemini-input-bar">
              <textarea
                className="gemini-textarea"
                placeholder={
                  selectedPreset === "UI Wireframe (HTML)"
                    ? "İstediğiniz web/mobil UI tasarımını açıklayın (örn: Modern giriş kartı, fiyatlandırma tablosu)..."
                    : "Bir mimari veya akış şeması açıklayın... (Enter: Gönder, Shift+Enter: Yeni satır)"
                }
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    const text = prompt.trim();
                    if (!isGenerating && text) {
                      setPrompt("");
                      handleGenerate(text);
                    }
                  }
                }}
                rows={1}
              />
              <div className="input-bar-actions">
                {isGenerating ? (
                  <button
                    type="button"
                    className="send-button stop"
                    onClick={handleAbort}
                    title="Üretimi Durdur"
                  >
                    {StopSquareIcon}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="send-button"
                    onClick={() => {
                      const text = prompt.trim();
                      if (!isGenerating && text) {
                        setPrompt("");
                        handleGenerate(text);
                      }
                    }}
                    disabled={!prompt.trim() || isGenerating}
                    title="Diyagramı Çiz"
                  >
                    {UpArrowIcon}
                  </button>
                )}
              </div>
            </div>
            <div className="input-hint">
              {settings.provider === "ollama" ? `Lokal: ${settings.ollamaModel}` : settings.customModel} •
              Model yanıtı anında yukarıdaki alana akacak ve tuvale çizilecektir.
            </div>
          </footer>
        </main>
      </div>
    </Dialog>
  );
};
