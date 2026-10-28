import clsx from "clsx";
import React, { useState, useEffect, useRef } from "react";
import { Dialog } from "@excalidraw/excalidraw/components/Dialog";
import {
  brainIcon,
  settingsIcon,
  CloseIcon,
  copyIcon,
  checkIcon,
  RetryIcon,
  FreedrawIcon,
  frameToolIcon,
  PlusIcon,
} from "@excalidraw/excalidraw/components/icons";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  getActiveProject,
  getWorkspaces,
  getProjectTasks,
  getProjectTDDScenarios,
  getProjectTeam,
  createProjectTask,
  createTDDScenario,
  executeAgentOnTask,
  runLiveAgentPipeline,
  setActiveWorkspaceId,
  subscribeWorkspaces,
} from "../workspace/workspaceStore";
import {
  ArchitectureIcon,
  TaskBoardIcon,
  TDDTestIcon,
} from "../workspace/WorkspaceTabs";

import "./AIIntegrationsModal.scss";

const StopSquareIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="3" />
  </svg>
);

const UpArrowIcon = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
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

const McpPlugIcon = (
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
    <path d="M12 22v-5" />
    <path d="M9 8V2" />
    <path d="M15 8V2" />
    <path d="M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z" />
  </svg>
);

const UserIcon = (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const CodeEditIcon = (
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
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
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
  {
    id: "Architecture",
    label: "Mimari Şema",
    targetBadge: "Çizim Tuvali",
    hint: "Sistem ve mikroservis mimarisi (Mermaid graph TB)",
  },
  {
    id: "Flowchart",
    label: "Analiz & Akış",
    targetBadge: "Çizim Tuvali",
    hint: "İş akışı ve süreç analizi diyagramı (Mermaid graph TD)",
  },
  {
    id: "UI Wireframe (HTML)",
    label: "UI Tasarım (HTML/CSS)",
    targetBadge: "Tasarım Tuvali",
    hint: "HTML/CSS ile Tasarım Tuvaline (Artboard) veya Çizim Tuvaline bileşen üretimi",
  },
  {
    id: "SDLC Tasks",
    label: "Görev & Kriter Üret",
    targetBadge: "Görev Panosu",
    hint: "Proje Görev Panosuna kabul kriterleriyle birlikte yeni görevler üretir",
  },
  {
    id: "TDD Suite",
    label: "TDD Test Üret",
    targetBadge: "TDD Stüdyosu",
    hint: "TDD Stüdyosuna Given/When/Then BDD senaryoları ve assertion listesi üretir",
  },
  {
    id: "Sequence",
    label: "Sequence Diyagramı",
    targetBadge: "Çizim Tuvali",
    hint: "Servisler arası sıralı etkileşim diyagramı (sequenceDiagram)",
  },
];

const PROMPT_SUGGESTIONS = [
  {
    preset: "Architecture",
    badge: "Mimari",
    text: "Redis Cache, PostgreSQL ve Kafka içeren mikroservis sipariş mimarisi",
  },
  {
    preset: "UI Wireframe (HTML)",
    badge: "UI Tasarım",
    text: "Modern SaaS sipariş özeti, kupon girişi ve fiyatlandırma kartı bileşeni",
  },
  {
    preset: "SDLC Tasks",
    badge: "Görev Panosu",
    text: "Sipariş iptali, stok iadesi ve ödeme geri bildirimi için SDLC görevleri oluştur",
  },
  {
    preset: "TDD Suite",
    badge: "TDD Test",
    text: "İndirim kuponu doğrulama ve sepet KDV hesaplama servisi için BDD test senaryoları üret",
  },
];

const MCP_CONFIG_CLAUDE = JSON.stringify(
  {
    mcpServers: {
      "synapdraw-sdlc": {
        command: "node",
        args: ["C:/Users/mburakmustu/source/repos/synapdraw-mcp/dist/index.js", "--stdio"],
      },
    },
  },
  null,
  2,
);

const MCP_TOOLS_CATALOG = [
  {
    group: "Proje & Görev Orkestrasyonu",
    tools: [
      {
        name: "get_project_sdlc_overview",
        desc: "Aktif projenin tüm tuvallerini, görevlerini, TDD testlerini ve izlenebilirlik nabzını okur.",
      },
      {
        name: "upsert_project_task",
        desc: "Görev panosunda yeni görev oluşturur, durumunu veya kabul kriterlerini günceller.",
      },
      {
        name: "run_sdlc_agent_pipeline",
        desc: "Projedeki tüm AI Agent'ları (Mimari + UI + TDD) sırayla çalıştırır.",
      },
    ],
  },
  {
    group: "TDD & Kalite Doğrulama",
    tools: [
      {
        name: "upsert_tdd_scenario",
        desc: "Given/When/Then BDD test senaryosu oluşturur veya Red-Green-Refactor durumunu günceller.",
      },
    ],
  },
  {
    group: "Analiz, Mimari & UI Tasarım Tuvalleri",
    tools: [
      {
        name: "render_mermaid",
        desc: "Analiz veya Mimari çizim tuvaline Mermaid diyagramı çizer.",
      },
      {
        name: "render_design",
        desc: "Tasarım tuvaline (Shadow DOM Artboard) pixel-perfect HTML/CSS bileşeni yerleştirir.",
      },
      {
        name: "get_canvas_state / update_node_styles",
        desc: "Tuvaldeki mevcut bileşenleri okur ve seçili düğümleri revize eder.",
      },
    ],
  },
];

/**
 * Sanitizes common LLM Mermaid syntax mistakes before parsing.
 */
function sanitizeMermaid(rawCode: string): string {
  let cleaned = rawCode
    .replace(/```(?:mermaid)?/gi, "")
    .replace(/```/g, "")
    .trim();

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

  cleaned = cleaned.replace(/(&\||\|\&|\&|\|)\s*$/gm, "");
  cleaned = cleaned.replace(/(&\||\|\&)/g, " & ");
  cleaned = cleaned.replace(/<--\|/g, "<--");
  cleaned = cleaned.replace(/\|-->/g, "-->");

  const lines = cleaned.split("\n");
  const filteredLines = lines
    .map((line) => {
      let l = line.trimEnd();
      l = l.replace(/(&|\+|\|)\s*$/, "").trimEnd();
      return l;
    })
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
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
  const [activeSidebarTab, setActiveSidebarTab] = useState<
    "studio" | "mcp" | "history" | "settings"
  >("studio");
  const [copiedTarget, setCopiedTarget] = useState<"user" | "ai" | null>(null);

  // SDLC Project Live State
  const [, setSdlcTick] = useState(0);
  useEffect(() => {
    if (!isOpen) return;
    return subscribeWorkspaces(() => setSdlcTick((t) => t + 1));
  }, [isOpen]);

  const activeProject = getActiveProject();
  const projectDocs = getWorkspaces();
  const projectTasks = getProjectTasks();
  const projectScenarios = getProjectTDDScenarios();
  const projectTeam = getProjectTeam();

  // Chat History
  const [chatHistory, setChatHistory] = useState<AIChatHistoryItem[]>(loadChatHistory);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

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

  // Full SDLC Context & Canvas Context Awareness
  const [includeSdlcContext, setIncludeSdlcContext] = useState<boolean>(true);
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
          text: `Ollama bağlantı hatası (${targetUrl}): ${lastError}.`,
        });
      }
      return [];
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (settings.provider === "ollama") {
      fetchOllamaModels();
    }
  }, [isOpen, settings.provider]);

  const handleCopyConfig = async () => {
    try {
      const ownerWin = modalContainerRef.current?.ownerDocument?.defaultView || window;
      await ownerWin.navigator.clipboard.writeText(MCP_CONFIG_CLAUDE);
      setIsConfigCopied(true);
      setTimeout(() => setIsConfigCopied(false), 2000);
    } catch (err) {
      console.error("Kopyalama başarısız:", err);
    }
  };

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
    setEditableMermaidCode(
      item.preset === "UI Wireframe (HTML)" ||
        item.preset === "SDLC Tasks" ||
        item.preset === "TDD Suite"
        ? item.mermaidCode
        : sanitizeMermaid(item.mermaidCode),
    );
    setSelectedPreset(item.preset);
    setIsEditingCode(false);
    setGenerationStatus(item.status);
    setParseErrorDetails(null);
    setStatusMessage({
      type: "success",
      text: `"${item.title}" oturumu yüklendi.`,
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
    const ownerWin = modalContainerRef.current?.ownerDocument?.defaultView || window;
    if (ownerWin.confirm("Tüm sohbet geçmişini silmek istediğinize emin misiniz?")) {
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
      const ownerWin = modalContainerRef.current?.ownerDocument?.defaultView || window;
      await ownerWin.navigator.clipboard.writeText(text);
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
      text: "Üretim kullanıcı tarafından durduruldu.",
    });
  };

  const buildSdlcProjectContextPrompt = (): string => {
    if (!includeSdlcContext) return "";
    const docsSummary = projectDocs
      .map((d) => `- [${d.category}] "${d.name}" (tip: ${d.canvasType})`)
      .join("\n");
    const tasksSummary = projectTasks
      .slice(0, 12)
      .map(
        (t) =>
          `- ${t.key} [${t.status}/${t.priority}]: "${t.title}" (${t.acceptanceCriteria.filter((c) => c.completed).length}/${t.acceptanceCriteria.length} kriter tamamlandı)`,
      )
      .join("\n");
    const tddSummary = projectScenarios
      .slice(0, 10)
      .map((s) => `- ${s.key} [${s.status.toUpperCase()}]: "${s.title}"`)
      .join("\n");

    return `\n\nSDLC PROJECT CONTEXT (${activeProject?.name || "Aktif Proje"}):
Belgeler & Tuvaller:
${docsSummary || "- Yok"}
Mevcut Görevler (${projectTasks.length}):
${tasksSummary || "- Yok"}
TDD Test Senaryoları (${projectScenarios.length}):
${tddSummary || "- Yok"}`;
  };

  // Renders the provided Mermaid code directly to Excalidraw canvas
  const renderMermaidToScene = async (rawCode: string) => {
    const cleanedCode = sanitizeMermaid(rawCode);
    setEditableMermaidCode(cleanedCode);

    setGenerationStatus("parsing");
    setParseErrorDetails(null);

    const { parseMermaidToExcalidraw } = await import("@excalidraw/mermaid-to-excalidraw");
    const { convertToExcalidrawElements, restoreElements } = await import("@excalidraw/excalidraw");
    const { wrapInContainerFrame } = await import("../utils/containerHelper");
    const { getSmartPlacementCoords } = await import("../utils/canvasContext");
    const result = await parseMermaidToExcalidraw(cleanedCode);

    if (!result?.elements || result.elements.length === 0) {
      throw new Error("Mermaid diyagramı Excalidraw elemanlarına dönüştürülemedi.");
    }

    const currentElements =
      renderMode === "append"
        ? excalidrawAPI?.getSceneElements().filter((el: any) => !el.isDeleted) || []
        : [];

    const placement = getSmartPlacementCoords(
      currentElements,
      800,
      500,
      renderMode === "append" ? "right" : "replace",
    );

    const container = wrapInContainerFrame(result.elements, {
      title: submittedPrompt ? submittedPrompt.slice(0, 30) : "Mermaid Diagram",
      originX: placement.x,
      originY: placement.y,
      locked: false,
      createFrame: true,
      createCard: true,
    });

    const converted = convertToExcalidrawElements(container.elements, {
      regenerateIds: true,
      renderEnvironment: (excalidrawAPI as any)?.renderEnvironment,
    });

    if (excalidrawAPI) {
      const restored = restoreElements(converted, null, {
        repairBindings: true,
        refreshDimensions: true,
      });
      const baseElements = renderMode === "append" ? currentElements : [];
      excalidrawAPI.updateScene({
        elements: [...baseElements, ...restored],
      });
      if (settings.autoScroll) {
        if (typeof (excalidrawAPI as any).scrollToContent === "function") {
          (excalidrawAPI as any).scrollToContent(restored, {
            fitToViewport: true,
            animate: true,
          });
        } else {
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
      text: `${converted.length} çizim elemanı Analiz/Mimari tuvaline aktarıldı.`,
    });
  };

  // Applies generated JSON Tasks or TDD Scenarios to the SDLC Project Store
  const applySdlcResourceOutput = async (rawOutput: string, mode: "SDLC Tasks" | "TDD Suite") => {
    const cleaned = rawOutput
      .replace(/```(?:json)?/gi, "")
      .replace(/```/g, "")
      .trim();
    setEditableMermaidCode(cleaned);
    setGenerationStatus("parsing");
    setParseErrorDetails(null);

    const firstBracket = cleaned.search(/[\[\{]/);
    const jsonSlice = firstBracket >= 0 ? cleaned.slice(firstBracket) : cleaned;
    const parsed = JSON.parse(jsonSlice);
    const items = Array.isArray(parsed)
      ? parsed
      : parsed.tasks || parsed.scenarios || [parsed];

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("Geçerli bir JSON görev veya test listesi bulunamadı.");
    }

    if (mode === "SDLC Tasks") {
      const linkedDocIds = projectDocs
        .filter((d) => d.canvasType === "sketch" || d.canvasType === "design")
        .slice(0, 2)
        .map((d) => d.id);
      let createdCount = 0;
      for (const item of items) {
        if (!item?.title) continue;
        createProjectTask({
          title: String(item.title),
          description: String(item.description || ""),
          status: (item.status as any) || "backlog",
          priority: (item.priority as any) || "high",
          assigneeId: projectTeam[0]?.id || null,
          linkedDocIds,
          acceptanceCriteria: Array.isArray(item.acceptanceCriteria)
            ? item.acceptanceCriteria.map((c: any, idx: number) => ({
                id: `ac_${Date.now()}_${idx}`,
                text: typeof c === "string" ? c : String(c.text || ""),
                completed: false,
              }))
            : [],
        });
        createdCount++;
      }
      const taskDoc = projectDocs.find((d) => d.canvasType === "tasks");
      if (taskDoc && settings.autoScroll) {
        setActiveWorkspaceId(taskDoc.id);
      }
      setGenerationStatus("success");
      setStatusMessage({
        type: "success",
        text: `${createdCount} yeni görev ve kabul kriterleri Proje Görev Panosuna eklendi.`,
      });
      return;
    }

    if (mode === "TDD Suite") {
      let createdCount = 0;
      const defaultTask = projectTasks[0];
      for (const item of items) {
        if (!item?.title) continue;
        createTDDScenario({
          title: String(item.title),
          category: (item.category as any) || "integration",
          status: "red",
          given: String(item.given || "Sistem başlangıç durumunda olduğunda"),
          when: String(item.when || "İlgili aksiyon tetiklendiğinde"),
          then: String(item.then || "Beklenen doğrulama kriterleri sağlanmalı"),
          linkedTaskId: defaultTask?.id || null,
          linkedDocIds: defaultTask?.linkedDocIds || [],
          assertions: Array.isArray(item.assertions)
            ? item.assertions.map((a: any, idx: number) => ({
                id: `as_${Date.now()}_${idx}`,
                description: typeof a === "string" ? a : String(a.description || ""),
                passed: false,
              }))
            : [],
        });
        createdCount++;
      }
      const tddDoc = projectDocs.find((d) => d.canvasType === "tdd");
      if (tddDoc && settings.autoScroll) {
        setActiveWorkspaceId(tddDoc.id);
      }
      setGenerationStatus("success");
      setStatusMessage({
        type: "success",
        text: `${createdCount} yeni BDD/TDD test senaryosu TDD Stüdyosuna eklendi.`,
      });
    }
  };

  // Renders HTML Wireframe, Mermaid diagram, or SDLC Tasks/TDD into the project
  const renderCodeToScene = async (rawCode: string) => {
    if (selectedPreset === "SDLC Tasks" || selectedPreset === "TDD Suite") {
      await applySdlcResourceOutput(rawCode, selectedPreset);
      return;
    }

    const isHtml =
      selectedPreset === "UI Wireframe (HTML)" ||
      /^\s*<(!DOCTYPE|html|div|section|form|header|main|table|button|card)/i.test(rawCode.trim());

    if (isHtml) {
      const { getActiveEngine } = await import("../engine/engineRegistry");
      const activeEngine = getActiveEngine();

      if (activeEngine && activeEngine.canvasType === "design") {
        setEditableMermaidCode(rawCode.trim());
        setGenerationStatus("parsing");
        setParseErrorDetails(null);

        const res = await activeEngine.applyEvent({
          type: "design",
          html: rawCode.trim(),
          title: submittedPrompt ? submittedPrompt.slice(0, 36) : "AI Tasarım",
          mode: renderMode,
        });

        if (!res.success) {
          throw new Error(res.message || "Tasarım tuvaline aktarım başarısız oldu.");
        }

        setGenerationStatus("success");
        setStatusMessage({
          type: "success",
          text: res.message || "Tasarım başarıyla Tasarım Tuvaline aktarıldı.",
        });
        return;
      }

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
        locked: false,
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
        text: `${converted.length} UI wireframe elemanı tuvale başarıyla aktarıldı.`,
      });
      return;
    }

    await renderMermaidToScene(rawCode);
  };

  const handleGenerate = async (customPromptText?: string, overridePreset?: string) => {
    const activePrompt = customPromptText || prompt;
    const activePreset = overridePreset || selectedPreset;
    if (overridePreset) {
      setSelectedPreset(overridePreset);
    }

    if (!activePrompt.trim()) {
      setStatusMessage({ type: "error", text: "Lütfen bir istem (prompt) girin." });
      return;
    }

    const sessionChatId = currentChatId || Date.now().toString();
    setCurrentChatId(sessionChatId);

    setSubmittedPrompt(activePrompt.trim());
    setPrompt("");
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
    let contextPromptSection = buildSdlcProjectContextPrompt();

    if (includeCanvasContext && excalidrawAPI) {
      try {
        const { extractCanvasSemanticContext, formatContextForPrompt } = await import(
          "../utils/canvasContext"
        );
        const ctx = extractCanvasSemanticContext(excalidrawAPI, reviseSelectionMode);
        contextPromptSection += `\n\nCANVAS CONTEXT / CURRENT BOARD STATE:\n${formatContextForPrompt(ctx)}`;
        if (reviseSelectionMode && ctx.hasSelection) {
          contextPromptSection += `\n\nIMPORTANT: The user specifically wants to REVISE the selected element(s).`;
        }
      } catch (e) {
        console.warn("Failed to extract canvas context:", e);
      }
    }

    if (activePreset === "SDLC Tasks") {
      systemPrompt = `You are a Principal Product Manager and Software Architect inside SynapDraw SDLC Super-App.
Generate a JSON array of software development tasks based on the user's request and the project context.
Output ONLY a valid JSON array (no markdown fences, no commentary):
[
  {
    "title": "Task Title in Turkish",
    "description": "Clear technical description in Turkish",
    "status": "backlog",
    "priority": "high",
    "acceptanceCriteria": [
      "Kabul kriteri 1",
      "Kabul kriteri 2",
      "Kabul kriteri 3"
    ]
  }
]${contextPromptSection}`;
    } else if (activePreset === "TDD Suite") {
      systemPrompt = `You are a Principal QA & TDD Engineer inside SynapDraw SDLC Super-App.
Generate a JSON array of BDD/TDD test scenarios based on the user's request and the project context.
Output ONLY a valid JSON array (no markdown fences, no commentary):
[
  {
    "title": "Test Scenario Title in Turkish",
    "category": "integration",
    "given": "Başlangıç koşulu (Given)",
    "when": "Tetiklenen eylem (When)",
    "then": "Beklenen sonuç (Then)",
    "assertions": [
      "HTTP 200 veya beklenen yanıt dönmeli",
      "Veri bütünlüğü doğrulanmalı"
    ]
  }
]${contextPromptSection}`;
    } else if (activePreset === "UI Wireframe (HTML)") {
      systemPrompt = `You are an expert UI/UX designer and design system architect.
Generate clean, modern, semantic HTML wireframe snippets based on the user's description.
CRITICAL RULES:
- Output ONLY pure, valid HTML code. Do NOT output markdown ticks (\`\`\`html) or explanations.
- Use <div class="card" style="..."> with explicit width, padding, border, border-radius, and clean flexbox layout.${contextPromptSection}`;
    } else {
      systemPrompt = `You are an expert software architect and technical diagram creator.
Generate ONLY valid, syntactically correct Mermaid.js diagram code based on the user's description.
CRITICAL MERMAID SYNTAX RULES:
- Output ONLY pure Mermaid diagram code. Do NOT output markdown ticks or explanations.
- Line 1 MUST start with the diagram type ("graph TD" for Architecture/Flowchart, "sequenceDiagram" for Sequence).
- Every node MUST have descriptive labels in quotes: NodeId["Service Name\\n(Technology / Role)"].
- Preset type requested: ${activePreset}.${contextPromptSection}`;
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

      try {
        await renderCodeToScene(accumulatedCode);
        const historyItem: AIChatHistoryItem = {
          id: sessionChatId,
          title: activePrompt.slice(0, 42).trim() + (activePrompt.length > 42 ? "..." : ""),
          prompt: activePrompt,
          mermaidCode: accumulatedCode,
          preset: activePreset,
          timestamp: Date.now(),
          model: settings.provider === "ollama" ? settings.ollamaModel : settings.customModel,
          status: "success",
        };
        setChatHistory((prev) =>
          [historyItem, ...prev.filter((i) => i.id !== sessionChatId)].slice(0, 50),
        );
      } catch (err: any) {
        console.warn("[AIIntegrations] Parse error, opening code editor:", err);
        const isRawPreset =
          activePreset === "UI Wireframe (HTML)" ||
          activePreset === "SDLC Tasks" ||
          activePreset === "TDD Suite";
        setGenerationStatus("error");
        setParseErrorDetails(err.message);
        setEditableMermaidCode(
          isRawPreset ? accumulatedCode : sanitizeMermaid(accumulatedCode),
        );
        setIsEditingCode(true);
        setStatusMessage({
          type: "error",
          text: `Ayrıştırma hatası: ${err.message}. Çıktıyı düzenleyerek tekrar uygulayabilirsiniz.`,
        });
        const historyItem: AIChatHistoryItem = {
          id: sessionChatId,
          title: activePrompt.slice(0, 42).trim() + (activePrompt.length > 42 ? "..." : ""),
          prompt: activePrompt,
          mermaidCode: accumulatedCode,
          preset: activePreset,
          timestamp: Date.now(),
          model: settings.provider === "ollama" ? settings.ollamaModel : settings.customModel,
          status: "error",
        };
        setChatHistory((prev) =>
          [historyItem, ...prev.filter((i) => i.id !== sessionChatId)].slice(0, 50),
        );
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

  const handleRunFullPipeline = async () => {
    const targetTasks = projectTasks.filter((t) => t.status !== "done").slice(0, 3);
    if (targetTasks.length === 0) {
      setStatusMessage({
        type: "success",
        text: "Projedeki tüm görevler tamamlanmış durumda.",
      });
      return;
    }
    const summaries: string[] = [];
    for (const t of targetTasks) {
      try {
        const res = await runLiveAgentPipeline(t.id, "auto");
        summaries.push(res.summary);
      } catch {
        const fallback = executeAgentOnTask(t.id, "auto");
        summaries.push(fallback.summary);
      }
    }
    setStatusMessage({
      type: "success",
      text: `${targetTasks.length} görev üzerinde AI Agent Pipeline çalıştırıldı: ${summaries.join(" • ")}`,
    });
  };

  if (!isOpen) return null;

  const activePresetMeta =
    PRESET_TYPES.find((p) => p.id === selectedPreset) || PRESET_TYPES[0];

  return (
    <Dialog size={1080} onCloseRequest={onClose} title={false} className="gemini-studio-dialog">
      <div className="ai-gemini-container" ref={modalContainerRef}>
        {/* LEFT SIDEBAR */}
        <aside className="ai-gemini-sidebar">
          {/* Brand Header */}
          <div className="sidebar-brand">
            <span className="brand-icon">{brainIcon}</span>
            <div className="brand-text">
              <h3>SDLC AI & MCP Stüdyosu</h3>
              <span>Proje Orkestrasyonu & Harici IDE</span>
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
              <span>Stüdyo</span>
            </button>
            <button
              type="button"
              className={clsx("sidebar-tab-btn", { active: activeSidebarTab === "mcp" })}
              onClick={() => setActiveSidebarTab("mcp")}
            >
              <span className="tab-icon">{McpPlugIcon}</span>
              <span>MCP</span>
              <span
                className={clsx("tab-status-dot", {
                  online: mcpStatus === "connected",
                })}
              />
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
              {/* Orchestration Target / Preset */}
              <div className="sidebar-section">
                <label className="section-label">Orkestrasyon Hedefi</label>
                <div className="preset-pill-grid">
                  {PRESET_TYPES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={clsx("preset-pill-btn", {
                        selected: selectedPreset === p.id,
                      })}
                      onClick={() => setSelectedPreset(p.id)}
                      title={p.hint}
                    >
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Provider & Model Selection */}
              <div className="sidebar-section">
                <label className="section-label">Model Sağlayıcı</label>
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

              {/* Canvas Mode */}
              <div className="sidebar-section">
                <label className="section-label">Tuval Aktarım Modu</label>
                <select
                  className="sidebar-select"
                  value={renderMode}
                  onChange={(e) => setRenderMode(e.target.value as any)}
                >
                  <option value="replace">Tuvali Temizle ve Yeni Oluştur</option>
                  <option value="append">Mevcut İçeriği Koru, Yanına Ekle</option>
                </select>
              </div>

              {/* Clean Excalidraw-native Context Switches */}
              <div className="sidebar-section">
                <label className="section-label">Proje & Tuval Bağlamı</label>
                <div className="studio-toggle-list">
                  <label className="studio-toggle-row">
                    <input
                      type="checkbox"
                      checked={includeSdlcContext}
                      onChange={(e) => setIncludeSdlcContext(e.target.checked)}
                    />
                    <span>
                      Tüm SDLC Proje Kaynaklarını İlet ({projectDocs.length} belge,{" "}
                      {projectTasks.length} görev)
                    </span>
                  </label>
                  <label className="studio-toggle-row">
                    <input
                      type="checkbox"
                      checked={includeCanvasContext}
                      onChange={(e) => setIncludeCanvasContext(e.target.checked)}
                    />
                    <span>
                      Aktif Çizim Tuvali Bağlamı ({canvasStats?.total ?? 0} eleman)
                    </span>
                  </label>
                  {canvasStats && canvasStats.selected > 0 && (
                    <label className="studio-toggle-row">
                      <input
                        type="checkbox"
                        checked={reviseSelectionMode}
                        onChange={(e) => setReviseSelectionMode(e.target.checked)}
                      />
                      <span>
                        Seçili Elemanları Revize Et ({canvasStats.selected} seçili)
                      </span>
                    </label>
                  )}
                  <label className="studio-toggle-row">
                    <input
                      type="checkbox"
                      checked={settings.autoScroll}
                      onChange={(e) =>
                        setSettings({ ...settings, autoScroll: e.target.checked })
                      }
                    />
                    <span>Tamamlanınca hedef yüzeye odaklan</span>
                  </label>
                </div>
              </div>

              {/* Live MCP Quick Status Bar */}
              <button
                type="button"
                className="sidebar-mcp-badge"
                onClick={() => setActiveSidebarTab("mcp")}
                title="Claude Desktop & Gemini Antigravity MCP Orkestrasyon Ayarlarını Aç"
              >
                <span className={clsx("dot", { online: mcpStatus === "connected" })} />
                <span>
                  Live MCP:{" "}
                  {mcpStatus === "connected"
                    ? "Port 3001 Aktif (Claude / Antigravity)"
                    : "Çevrimdışı (Kurulum için tıklayın)"}
                </span>
              </button>
            </div>
          )}

          {activeSidebarTab === "mcp" && (
            <div className="sidebar-content mcp-tab-content">
              <div className="mcp-status-card">
                <div className="mcp-status-header">
                  <span className={clsx("dot", { online: mcpStatus === "connected" })} />
                  <strong>
                    {mcpStatus === "connected"
                      ? "Live MCP Köprüsü Aktif (3001)"
                      : "Live MCP Köprüsü Bekleniyor"}
                  </strong>
                </div>
                <p>
                  Claude Desktop veya Gemini Antigravity IDE üzerinden projenizin tüm
                  kaynaklarını (Analiz, Mimari, UI Tasarım, Görev Panosu ve TDD Testleri)
                  doğrudan orkestre edebilirsiniz.
                </p>
              </div>

              <div className="sidebar-section">
                <div className="section-header-row">
                  <label className="section-label">
                    Claude Desktop / Antigravity Config
                  </label>
                  <button
                    type="button"
                    className="refresh-link"
                    onClick={handleCopyConfig}
                  >
                    <span>{isConfigCopied ? "Kopyalandı ✓" : "JSON Kopyala"}</span>
                  </button>
                </div>
                <pre className="sidebar-code-snippet">
                  <code>{MCP_CONFIG_CLAUDE}</code>
                </pre>
              </div>

              <div className="sidebar-section">
                <label className="section-label">Aktif SDLC MCP Araçları (11 Tool)</label>
                <div className="mcp-tools-list">
                  {MCP_TOOLS_CATALOG.map((grp) => (
                    <div key={grp.group} className="mcp-tool-group">
                      <div className="group-title">{grp.group}</div>
                      {grp.tools.map((tool) => (
                        <div key={tool.name} className="mcp-tool-item">
                          <code>{tool.name}</code>
                          <span>{tool.desc}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSidebarTab === "history" && (
            <div className="sidebar-content history-tab-content">
              <button
                type="button"
                className="sidebar-new-chat-btn"
                onClick={handleStartNewChat}
              >
                <span className="btn-icon">{PlusIcon}</span>
                <span>Yeni Oturum Başlat</span>
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
                            <span className="history-time">
                              {formatHistoryTime(item.timestamp)}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="delete-history-btn"
                          onClick={(e) => handleDeleteHistoryItem(item.id, e)}
                          title="Oturumu Sil"
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
                  <p>Henüz kayıtlı oturum yok.</p>
                  <span className="empty-sub">
                    Ürettiğiniz mimari şemalar, UI tasarımlar, görevler ve TDD testleri
                    burada listelenir.
                  </span>
                </div>
              )}
            </div>
          )}

          {activeSidebarTab === "settings" && (
            <div className="sidebar-content">
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

              <div className="sidebar-section">
                <label className="section-label">OpenAI / Özel API Base URL</label>
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
                <label className="section-label">API Anahtarı (Key)</label>
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
            </div>
          )}
        </aside>

        {/* RIGHT MAIN WORKSPACE */}
        <main className="ai-gemini-workspace">
          {/* Top Bar */}
          <header className="workspace-header">
            <div className="header-chips">
              <span className="model-chip">
                {settings.provider === "ollama" ? settings.ollamaModel : settings.customModel}
              </span>
              <span className="type-chip">
                {activePresetMeta.label} → {activePresetMeta.targetBadge}
              </span>
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
                  title="Yeni bir oturum başlat"
                >
                  <span className="btn-icon">{PlusIcon}</span>
                  <span>Yeni İstem</span>
                </button>
              )}
            </div>

            <div className="header-right-actions">
              <button
                type="button"
                className="pipeline-quick-btn"
                onClick={handleRunFullPipeline}
                title="Projedeki atanmış AI Agent görevlerini sırayla çalıştır"
              >
                <span className="btn-icon">{brainIcon}</span>
                <span>SDLC Pipeline Çalıştır</span>
              </button>
              <button
                type="button"
                className="workspace-close-btn"
                onClick={onClose}
                title="Kapat"
                aria-label="Kapat"
              >
                {CloseIcon}
              </button>
            </div>
          </header>

          {/* SDLC Project Resource Strip */}
          <div className="sdlc-resource-strip">
            <span className="strip-label">Aktif Proje Kaynakları:</span>
            <span className="resource-pill">
              <span className="res-icon">{FreedrawIcon}</span>
              <span>
                {projectDocs.filter((d) => d.canvasType === "sketch").length} Çizim/Mimari
              </span>
            </span>
            <span className="resource-pill">
              <span className="res-icon">{frameToolIcon}</span>
              <span>
                {projectDocs.filter((d) => d.canvasType === "design").length} UI Tasarım
              </span>
            </span>
            <span className="resource-pill">
              <span className="res-icon">{TaskBoardIcon}</span>
              <span>{projectTasks.length} Görev</span>
            </span>
            <span className="resource-pill">
              <span className="res-icon">{TDDTestIcon}</span>
              <span>{projectScenarios.length} TDD Senaryosu</span>
            </span>
            <button
              type="button"
              className={clsx("resource-mcp-pill", {
                online: mcpStatus === "connected",
              })}
              onClick={() => setActiveSidebarTab("mcp")}
            >
              <span className="res-icon">{McpPlugIcon}</span>
              <span>
                {mcpStatus === "connected"
                  ? "Claude / Antigravity MCP Hazır"
                  : "MCP Kurulumu"}
              </span>
            </button>
          </div>

          {/* Chat / Canvas Area */}
          <div className="workspace-canvas" ref={workspaceCanvasRef}>
            {!submittedPrompt && !isGenerating && !streamedContent && (
              <div className="gemini-empty-state">
                <div className="empty-sparkle-icon">{brainIcon}</div>
                <h2>Projenizi AI veya MCP ile Orkestre Edin</h2>
                <p>
                  Yerleşik asistan tüm proje kaynaklarınıza (Analiz, Mimari, UI Tasarım,
                  Görev Panosu ve TDD Testleri) erişebilir; dilerseniz{" "}
                  <strong>Claude Desktop</strong> veya{" "}
                  <strong>Gemini Antigravity</strong> üzerinden Live MCP araçlarıyla da
                  yönetebilirsiniz.
                </p>

                <div className="suggestion-cards">
                  {PROMPT_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      className="suggestion-card"
                      onClick={() => {
                        setPrompt("");
                        handleGenerate(sug.text, sug.preset);
                      }}
                    >
                      <span className="sug-badge">{sug.badge}</span>
                      <span className="sug-text">{sug.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {submittedPrompt && (
              <div className="gemini-message user-message">
                <div className="message-avatar">{UserIcon}</div>
                <div className="message-bubble">
                  <div className="user-message-header">
                    <span className="bubble-header">İstem (Prompt)</span>
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
                        {generationStatus === "connecting" && "Modele bağlanılıyor..."}
                        {generationStatus === "generating" &&
                          `Canlı Yanıt Akışı (${settings.provider === "ollama" ? settings.ollamaModel : settings.customModel})`}
                        {generationStatus === "parsing" &&
                          "Çıktı hedef SDLC yüzeyine aktarılıyor..."}
                        {generationStatus === "success" &&
                          `Çıktı başarıyla ${activePresetMeta.targetBadge} yüzeyine uygulandı`}
                        {generationStatus === "error" &&
                          "Ayrıştırma veya bağlantı sırasında hata oluştu"}
                      </span>
                    </div>

                    <div className="status-stats-row">
                      <span className="stats-time">
                        {elapsedTime > 0 && `${elapsedTime}s`}
                        {streamedContent.length > 0 && ` • ${streamedContent.length} krktr`}
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

                  <div className="ai-code-viewer">
                    {isEditingCode ? (
                      <div className="code-editor-wrap">
                        <div className="editor-banner">
                          <span>
                            Üretilen çıktıyı düzenleyip doğrudan hedef yüzeye
                            uygulayabilirsiniz:
                          </span>
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
                              <span>
                                {copiedTarget === "ai" ? "Kopyalandı" : "Kopyala"}
                              </span>
                            </button>
                            <button
                              type="button"
                              className="render-now-btn"
                              onClick={handleManualRender}
                            >
                              Hedef Yüzeye Uygula
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
                            {selectedPreset === "UI Wireframe (HTML)"
                              ? "html"
                              : selectedPreset === "SDLC Tasks" ||
                                selectedPreset === "TDD Suite"
                              ? "json"
                              : "mermaid"}
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
                              <span>
                                {copiedTarget === "ai" ? "Kopyalandı" : "Kodu Kopyala"}
                              </span>
                            </button>
                          )}
                        </div>
                        <pre className="mermaid-pre" ref={codePreRef}>
                          <code>{streamedContent || "Modelden ilk yanıt bekleniyor..."}</code>
                          {isGenerating && <span className="stream-cursor">▊</span>}
                        </pre>
                      </div>
                    )}
                  </div>

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
                          const isRaw =
                            selectedPreset === "UI Wireframe (HTML)" ||
                            selectedPreset === "SDLC Tasks" ||
                            selectedPreset === "TDD Suite";
                          setEditableMermaidCode(
                            isRaw ? streamedContent : sanitizeMermaid(streamedContent),
                          );
                          setIsEditingCode(true);
                        }}
                      >
                        <span className="btn-icon">{CodeEditIcon}</span>
                        <span>Çıktıyı Düzenle</span>
                      </button>
                      <button
                        type="button"
                        className="primary-action-btn"
                        onClick={() => renderCodeToScene(streamedContent)}
                      >
                        <span className="btn-icon">{RetryIcon}</span>
                        <span>Hedef Yüzeye Yeniden Uygula</span>
                      </button>
                    </div>
                  )}

                  {parseErrorDetails && (
                    <div className="parse-error-card">
                      <div className="error-title">Ayrıştırma Hatası</div>
                      <div className="error-text">{parseErrorDetails}</div>
                      <div className="error-tip">
                        Yukarıdaki düzenleyicide çıktıyı düzelterek doğrudan hedef yüzeye
                        aktarabilirsiniz.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {statusMessage && (
              <div className={clsx("floating-alert", statusMessage.type)}>
                <span className="alert-icon">
                  {statusMessage.type === "success" ? checkIcon : "!"}
                </span>
                <span>{statusMessage.text}</span>
              </div>
            )}
          </div>

          {/* Bottom Input Bar */}
          <footer className="gemini-input-bar-wrap">
            <div className="gemini-input-bar">
              <textarea
                className="gemini-textarea"
                placeholder={
                  selectedPreset === "SDLC Tasks"
                    ? "Hangi özellik veya modül için görevler ve kabul kriterleri üretilsin? (Enter: Gönder)"
                    : selectedPreset === "TDD Suite"
                    ? "Hangi servis veya akış için Given/When/Then TDD test senaryoları üretilsin?"
                    : selectedPreset === "UI Wireframe (HTML)"
                    ? "Tasarım Tuvali için istediğiniz web/mobil ekran veya bileşeni açıklayın..."
                    : "Analiz veya mimari şemasını açıklayın... (Enter: Gönder, Shift+Enter: Yeni satır)"
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
                    title="Üret ve Hedef Yüzeye Uygula"
                  >
                    {UpArrowIcon}
                  </button>
                )}
              </div>
            </div>
            <div className="input-hint">
              Hedef: <strong>{activePresetMeta.targetBadge}</strong> • Model:{" "}
              {settings.provider === "ollama" ? settings.ollamaModel : settings.customModel}{" "}
              • SDLC Proje Bağlamı: {includeSdlcContext ? "Aktif" : "Kapalı"}
            </div>
          </footer>
        </main>
      </div>
    </Dialog>
  );
};
