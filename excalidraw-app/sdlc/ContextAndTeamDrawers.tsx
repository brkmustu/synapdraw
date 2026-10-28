import React, { useEffect, useState } from "react";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import {
  CloseIcon,
  PlusIcon,
  TrashIcon,
  brainIcon,
  settingsIcon,
  usersIcon,
  checkIcon,
  RetryIcon,
} from "@excalidraw/excalidraw/components/icons";
import {
  getProjects,
  getActiveProject,
  getActiveWorkspace,
  getWorkspaces,
  getProjectTasks,
  updateProjectTask,
  createProjectTask,
  getProjectTDDScenarios,
  updateTDDScenario,
  createTDDScenario,
  getProjectTeam,
  addTeamMember,
  updateTeamMember,
  removeTeamMember,
  cloneTeamMembersToProject,
  getAIProviderGatewayConfig,
  saveAIProviderGatewayConfig,
  setActiveWorkspaceId,
  setSplitWorkspaceId,
  requestArtboardFocus,
  requestSketchFocus,
  toggleTaskSketchLink,
  executeAgentOnTask,
  subscribeWorkspaces,
  type WorkspaceDocument,
  type ProjectTask,
  type TDDScenario,
  type TDDStatus,
  type TeamMember,
  type ParticipantKind,
  type ParticipantRole,
  type AgentModelProvider,
  type AgentComplexityTier,
  type AIProviderGatewayConfig,
} from "../workspace/workspaceStore";
import {
  SplitViewIcon,
  TaskBoardIcon,
  TDDTestIcon,
} from "../workspace/WorkspaceTabs";
import "./sdlc.scss";

interface SDLCContextDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  excalidrawAPI?: ExcalidrawImperativeAPI | null;
}

export const SDLCContextDrawer: React.FC<SDLCContextDrawerProps> = ({
  isOpen,
  onClose,
  excalidrawAPI,
}) => {
  const [activeDoc, setActiveDoc] = useState<WorkspaceDocument | null>(null);
  const [allDocs, setAllDocs] = useState<WorkspaceDocument[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [scenarios, setScenarios] = useState<TDDScenario[]>([]);

  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTestTitle, setQuickTestTitle] = useState("");
  const [sketchFeedback, setSketchFeedback] = useState<string | null>(null);
  const [, setSelectionTick] = useState(0);

  useEffect(() => {
    const sync = () => {
      setActiveDoc(getActiveWorkspace());
      setAllDocs(getWorkspaces());
      setTasks(getProjectTasks());
      setScenarios(getProjectTDDScenarios());
    };
    sync();
    return subscribeWorkspaces(sync);
  }, []);

  if (!isOpen || !activeDoc) return null;

  const linkedTasks = tasks.filter((t) =>
    t.linkedDocIds.includes(activeDoc.id),
  );
  const unlinkedTasks = tasks.filter(
    (t) => !t.linkedDocIds.includes(activeDoc.id),
  );

  const linkedScenarios = scenarios.filter((s) =>
    s.linkedDocIds.includes(activeDoc.id),
  );

  const taskBoardDoc = allDocs.find((d) => d.canvasType === "tasks");
  const tddSuiteDoc = allDocs.find((d) => d.canvasType === "tdd");

  const handleQuickAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTaskTitle.trim()) return;
    createProjectTask({
      title: quickTaskTitle,
      status: activeDoc.canvasType === "design" ? "design" : "backlog",
      priority: "high",
      linkedDocIds: [activeDoc.id],
    });
    setQuickTaskTitle("");
  };

  const handleQuickAddTDD = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTestTitle.trim()) return;
    createTDDScenario({
      title: quickTestTitle,
      status: "red",
      given: `"${activeDoc.name}" yüzeyi aktif durumdadır`,
      when: "Kullanıcı ilgili senaryoyu tetikler",
      then: quickTestTitle,
      assertions: [quickTestTitle],
      linkedTaskId: linkedTasks[0]?.id || null,
      linkedDocIds: [activeDoc.id],
    });
    setQuickTestTitle("");
  };

  // Inspect selected or active Excalidraw sketch elements for deep-linking
  const getSketchSelectionInfo = () => {
    if (!excalidrawAPI || activeDoc.canvasType !== "sketch") {
      return { ids: [] as string[], label: "", texts: [] as string[] };
    }
    const allEls = excalidrawAPI
      .getSceneElements()
      .filter((el) => !el.isDeleted);
    const selectedMap = excalidrawAPI.getAppState().selectedElementIds || {};
    const selectedEls = allEls.filter((el) => Boolean(selectedMap[el.id]));
    const targetEls = selectedEls.length > 0 ? selectedEls : allEls;

    const texts = targetEls
      .filter((el: any) => el.type === "text" && typeof el.text === "string")
      .map((el: any) => el.text.trim())
      .filter(Boolean);
    const frameEl: any = targetEls.find(
      (el: any) => el.type === "frame" && el.name,
    );
    const label =
      frameEl?.name ||
      texts[0]?.slice(0, 42) ||
      `${activeDoc.name} (${targetEls.length} çizim öğesi)`;

    return {
      ids: targetEls.map((el) => el.id),
      label,
      texts,
      isExplicitSelection: selectedEls.length > 0,
    };
  };

  const sketchInfo = getSketchSelectionInfo();

  const handleCreateTaskFromSketch = () => {
    if (sketchInfo.ids.length === 0) return;
    const criteria =
      sketchInfo.texts.length > 1
        ? sketchInfo.texts.slice(1, 5)
        : [`"${sketchInfo.label}" diyagram akışı gerçeklenmeli`];
    const created = createProjectTask({
      title: sketchInfo.label,
      description: `"${activeDoc.name}" çizim tuvalindeki seçili diyagram akışından (${sketchInfo.ids.length} öğe) oluşturuldu.`,
      status: "design",
      priority: "high",
      acceptanceCriteria: criteria,
      linkedDocIds: [activeDoc.id],
    });
    toggleTaskSketchLink(created.id, {
      docId: activeDoc.id,
      elementIds: sketchInfo.ids,
      label: sketchInfo.label,
    });
    setSketchFeedback(`✓ "${created.key}" oluşturuldu ve çizime pinlendi`);
    setTimeout(() => setSketchFeedback(null), 3200);
  };

  return (
    <aside className="sdlc-context-drawer Island">
      <div className="context-drawer-header">
        <div className="context-title-block">
          <span className="context-eyebrow">PROJE BAĞLAMI & DOĞRULAMA</span>
          <h4>{activeDoc.name}</h4>
        </div>
        <button
          type="button"
          className="detail-icon-btn"
          onClick={onClose}
          title="Bağlam çekmecesini kapat"
        >
          {CloseIcon}
        </button>
      </div>

      <div className="context-drawer-body">
        {/* Quick Split-Peek Bar */}
        <div className="context-quick-splits">
          {taskBoardDoc && taskBoardDoc.id !== activeDoc.id && (
            <button
              type="button"
              className="context-split-btn"
              onClick={() => setSplitWorkspaceId(taskBoardDoc.id)}
            >
              {TaskBoardIcon}
              <span>Görevleri Yan Yana Aç</span>
              {SplitViewIcon}
            </button>
          )}
          {tddSuiteDoc && tddSuiteDoc.id !== activeDoc.id && (
            <button
              type="button"
              className="context-split-btn"
              onClick={() => setSplitWorkspaceId(tddSuiteDoc.id)}
            >
              {TDDTestIcon}
              <span>TDD Testlerini Yan Yana Aç</span>
              {SplitViewIcon}
            </button>
          )}
        </div>

        {/* Excalidraw Sketch Selection -> Task Deep-Pinning */}
        {activeDoc.canvasType === "sketch" && (
          <div className="context-section">
            <div className="context-section-header">
              <span>📐 ÇİZİMDEN GÖREVE DERİN PİNLEME</span>
              <button
                type="button"
                className="context-link-btn"
                onClick={() => setSelectionTick((t) => t + 1)}
                title="Tuvaldeki aktif seçimi yenile"
              >
                🔄 Seçimi Yenile
              </button>
            </div>
            {sketchInfo.ids.length === 0 ? (
              <div className="context-empty">
                Tuvalde henüz çizim öğesi yok. Bir akış çizip seçerek doğrudan
                göreve dönüştürebilirsiniz.
              </div>
            ) : (
              <div className="context-mini-card">
                <div style={{ fontSize: 11.5, fontWeight: 700 }}>
                  {sketchInfo.isExplicitSelection
                    ? `Seçili Akış: ${sketchInfo.label}`
                    : `Tuval Akışı: ${sketchInfo.label}`}
                </div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>
                  {sketchInfo.ids.length} çizim elemanı ·{" "}
                  {sketchInfo.texts.length} metin düğümü algılandı
                </div>
                <button
                  type="button"
                  className="context-split-btn"
                  style={{ marginTop: 4 }}
                  onClick={handleCreateTaskFromSketch}
                >
                  <span>➕ Bu Akıştan Görev (Task) Oluştur & Pinle</span>
                </button>
                {tasks.length > 0 && (
                  <select
                    className="context-attach-select"
                    value=""
                    onChange={(e) => {
                      const targetTaskId = e.target.value;
                      if (!targetTaskId) return;
                      toggleTaskSketchLink(targetTaskId, {
                        docId: activeDoc.id,
                        elementIds: sketchInfo.ids,
                        label: sketchInfo.label,
                      });
                      setSketchFeedback("✓ Çizim akışı göreve pinlendi");
                      setTimeout(() => setSketchFeedback(null), 2800);
                    }}
                  >
                    <option value="">
                      🔗 Bu Çizim Akışını Mevcut Göreve Pinle...
                    </option>
                    {tasks.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.key}: {t.title}
                      </option>
                    ))}
                  </select>
                )}
                {sketchFeedback && (
                  <div
                    style={{
                      fontSize: 11,
                      fontWeight: 700,
                      color: "var(--color-primary)",
                    }}
                  >
                    {sketchFeedback}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Linked Tasks Section */}
        <div className="context-section">
          <div className="context-section-header">
            <span>BU YÜZEYE BAĞLI GÖREVLER ({linkedTasks.length})</span>
            {taskBoardDoc && (
              <button
                type="button"
                className="context-link-btn"
                onClick={() => setActiveWorkspaceId(taskBoardDoc.id)}
              >
                Tüm Pano →
              </button>
            )}
          </div>

          {linkedTasks.length === 0 ? (
            <div className="context-empty">
              Bu dokümana henüz bağlı bir görev yok.
            </div>
          ) : (
            <div className="context-card-list">
              {linkedTasks.map((task) => (
                <div key={task.id} className="context-mini-card">
                  <div className="mini-card-top">
                    <span className="task-key">{task.key}</span>
                    <select
                      className="mini-status-select"
                      value={task.status}
                      onChange={(e) =>
                        updateProjectTask(task.id, {
                          status: e.target.value as any,
                        })
                      }
                    >
                      <option value="backlog">Backlog</option>
                      <option value="design">Tasarım</option>
                      <option value="in_progress">Geliştirmede</option>
                      <option value="testing">TDD / Test</option>
                      <option value="done">Tamamlandı</option>
                    </select>
                  </div>
                  <div className="mini-card-title">{task.title}</div>

                  {task.acceptanceCriteria.length > 0 && (
                    <div className="mini-criteria-list">
                      {task.acceptanceCriteria.map((c) => (
                        <label key={c.id} className="mini-criterion">
                          <input
                            type="checkbox"
                            checked={c.completed}
                            onChange={() => {
                              const updated = task.acceptanceCriteria.map(
                                (item) =>
                                  item.id === c.id
                                    ? { ...item, completed: !item.completed }
                                    : item,
                              );
                              updateProjectTask(task.id, {
                                acceptanceCriteria: updated,
                              });
                            }}
                          />
                          <span className={c.completed ? "done" : ""}>
                            {c.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {((task.linkedArtboards || []).length > 0 ||
                    (task.linkedSketchRefs || []).length > 0) && (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 4,
                        marginTop: 4,
                      }}
                    >
                      {(task.linkedSketchRefs || []).map((sr, idx) => (
                        <button
                          key={`${sr.docId}_${idx}`}
                          type="button"
                          className="artifact-chip"
                          onClick={() =>
                            requestSketchFocus(
                              sr.docId,
                              sr.elementIds,
                              false,
                            )
                          }
                          title={`"${sr.label}" çizim diyagramına zoom yap`}
                        >
                          <span>📐 {sr.label}</span>
                        </button>
                      ))}
                      {(task.linkedArtboards || []).map((la) => (
                        <button
                          key={`${la.docId}_${la.artboardId}`}
                          type="button"
                          className="artifact-chip"
                          onClick={() =>
                            requestArtboardFocus(
                              la.docId,
                              la.artboardId,
                              activeDoc.id !== la.docId,
                            )
                          }
                          title={`"${la.label}" Artboard'una odaklan`}
                        >
                          <span>🎨 {la.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginTop: 4,
                      paddingTop: 4,
                      borderTop: "1px dashed var(--default-border-color)",
                    }}
                  >
                    <button
                      type="button"
                      className="context-link-btn"
                      onClick={() =>
                        executeAgentOnTask(task.id, "architecture")
                      }
                      title="Sistem Mimarı Agent ile bu görev için mimari şema çiz"
                    >
                      🏗️ Mimari
                    </button>
                    <span style={{ opacity: 0.35 }}>·</span>
                    <button
                      type="button"
                      className="context-link-btn"
                      onClick={() => executeAgentOnTask(task.id, "design")}
                      title="UI/UX Tasarımcı Agent ile bu görev için bileşen tasarla"
                    >
                      🎨 UI Üret
                    </button>
                    <span style={{ opacity: 0.35 }}>·</span>
                    <button
                      type="button"
                      className="context-link-btn"
                      onClick={() => executeAgentOnTask(task.id, "tdd")}
                      title="TDD & QA Agent ile bu görev için BDD test senaryoları üret"
                    >
                      🧪 TDD Üret
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {unlinkedTasks.length > 0 && (
            <select
              className="context-attach-select"
              value=""
              onChange={(e) => {
                const target = tasks.find((t) => t.id === e.target.value);
                if (target) {
                  updateProjectTask(target.id, {
                    linkedDocIds: [...target.linkedDocIds, activeDoc.id],
                  });
                }
              }}
            >
              <option value="">+ Mevcut Bir Görevi Bu Yüzeye Bağla...</option>
              {unlinkedTasks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.key}: {t.title}
                </option>
              ))}
            </select>
          )}

          <form className="context-inline-form" onSubmit={handleQuickAddTask}>
            <input
              type="text"
              placeholder="Bu yüzey için yeni görev ekle..."
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
            />
            <button type="submit">{PlusIcon}</button>
          </form>
        </div>

        {/* Linked TDD Scenarios Section */}
        <div className="context-section">
          <div className="context-section-header">
            <span>TDD TEST SENARYOLARI ({linkedScenarios.length})</span>
            {tddSuiteDoc && (
              <button
                type="button"
                className="context-link-btn"
                onClick={() => setActiveWorkspaceId(tddSuiteDoc.id)}
              >
                TDD Stüdyosu →
              </button>
            )}
          </div>

          {linkedScenarios.length === 0 ? (
            <div className="context-empty">
              Bu dokümana bağlı TDD test senaryosu bulunmuyor.
            </div>
          ) : (
            <div className="context-card-list">
              {linkedScenarios.map((sc) => (
                <div key={sc.id} className="context-mini-card">
                  <div className="mini-card-top">
                    <span className="tdd-key">{sc.key}</span>
                    <div className="tdd-quick-status">
                      {(["red", "green", "refactor"] as TDDStatus[]).map(
                        (st) => (
                          <button
                            key={st}
                            type="button"
                            className={`status-pill status-pill--${st} ${
                              sc.status === st ? "status-pill--active" : ""
                            }`}
                            onClick={() =>
                              updateTDDScenario(sc.id, { status: st })
                            }
                          >
                            {st.toUpperCase()}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
                  <div className="mini-card-title">{sc.title}</div>
                  <div className="mini-bdd">
                    <div>
                      <strong>GIVEN:</strong> {sc.given}
                    </div>
                    <div>
                      <strong>WHEN:</strong> {sc.when}
                    </div>
                    <div>
                      <strong>THEN:</strong> {sc.then}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form className="context-inline-form" onSubmit={handleQuickAddTDD}>
            <input
              type="text"
              placeholder="Hızlı TDD beklentisi (Then) ekle..."
              value={quickTestTitle}
              onChange={(e) => setQuickTestTitle(e.target.value)}
            />
            <button type="submit">{PlusIcon}</button>
          </form>
        </div>
      </div>
    </aside>
  );
};

interface TeamRosterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAIStudio?: () => void;
  initialTab?: "roster" | "transfer" | "gateways";
}

const ROLE_OPTIONS: { role: ParticipantRole; label: string }[] = [
  { role: "developer", label: "Full-Stack Yazılımcı" },
  { role: "po", label: "Product Owner / İş Analisti" },
  { role: "pm", label: "Proje Yöneticisi (PM)" },
  { role: "architect", label: "Sistem Mimarı" },
  { role: "designer", label: "UI/UX Tasarımcı" },
  { role: "qa", label: "TDD / QA Test Mühendisi" },
];

const PROVIDER_LABELS: Record<AgentModelProvider, string> = {
  ollama: "Ollama (Lokal)",
  openrouter: "OpenRouter Gateway",
  openai: "OpenAI API",
  custom: "Özel API",
};

const TIER_LABELS: Record<AgentComplexityTier, string> = {
  high: "Karmaşık / Yüksek Model",
  standard: "Standart / Dengeli",
  fast: "Tekrarlayan / Hızlı Lokal",
};

const CURATED_MODELS_BY_PROVIDER: Record<AgentModelProvider, string[]> = {
  openrouter: [
    "anthropic/claude-3.7-sonnet",
    "google/gemini-2.5-pro",
    "openai/gpt-4.1",
    "deepseek/deepseek-r1",
    "qwen/qwen-2.5-coder-32b-instruct",
    "meta-llama/llama-3.3-70b-instruct",
    "google/gemini-2.5-flash",
  ],
  ollama: [
    "gemma4:26b",
    "qwen2.5-coder:7b",
    "qwen2.5-coder:14b",
    "deepseek-r1:14b",
    "mistral:latest",
    "llama3.2:latest",
  ],
  openai: ["gpt-4.1", "gpt-4o", "gpt-4o-mini", "o3-mini"],
  custom: ["custom-llm-v1"],
};

export const TeamRosterModal: React.FC<TeamRosterModalProps> = ({
  isOpen,
  onClose,
  onOpenAIStudio,
  initialTab = "roster",
}) => {
  const [activeTab, setActiveTab] = useState<"roster" | "transfer" | "gateways">(
    initialTab,
  );
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Add / Edit Form State
  const [kind, setKind] = useState<ParticipantKind>("ai_agent");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ParticipantRole>("architect");
  const [modelProvider, setModelProvider] =
    useState<AgentModelProvider>("openrouter");
  const [modelId, setModelId] = useState("anthropic/claude-3.7-sonnet");
  const [complexityTier, setComplexityTier] =
    useState<AgentComplexityTier>("high");
  const [systemPrompt, setSystemPrompt] = useState("");

  // Cross-Project Transfer State
  const projects = getProjects();
  const activeProject = getActiveProject();
  const otherProjects = projects.filter((p) => p.id !== activeProject?.id);
  const [sourceProjectId, setSourceProjectId] = useState<string>(
    () => otherProjects[0]?.id || "",
  );
  const [selectedSourceMemberIds, setSelectedSourceMemberIds] = useState<
    string[]
  >([]);
  const [transferFeedback, setTransferFeedback] = useState<string | null>(null);

  // Gateway Config State
  const [gatewayConfig, setGatewayConfig] = useState<AIProviderGatewayConfig>(
    () => getAIProviderGatewayConfig(),
  );
  const [fetchedOllamaModels, setFetchedOllamaModels] = useState<string[]>([]);
  const [fetchedOpenRouterModels, setFetchedOpenRouterModels] = useState<
    string[]
  >([]);
  const [isFetchingGateway, setIsFetchingGateway] = useState(false);
  const [gatewayFeedback, setGatewayFeedback] = useState<string | null>(null);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    const sync = () => {
      setTeam(getProjectTeam());
      setGatewayConfig(getAIProviderGatewayConfig());
    };
    sync();
    return subscribeWorkspaces(sync);
  }, [isOpen]);

  useEffect(() => {
    if (!sourceProjectId && otherProjects.length > 0) {
      setSourceProjectId(otherProjects[0].id);
    }
    if (sourceProjectId) {
      const srcMembers = getProjectTeam(sourceProjectId);
      setSelectedSourceMemberIds(srcMembers.map((m) => m.id));
    }
  }, [sourceProjectId, otherProjects.length]);

  if (!isOpen) return null;

  const humans = team.filter((m) => m.kind === "human");
  const agents = team.filter((m) => m.kind === "ai_agent");

  const handleComplexityChange = (nextTier: AgentComplexityTier) => {
    setComplexityTier(nextTier);
    if (nextTier === "high") {
      setModelProvider("openrouter");
      setModelId("anthropic/claude-3.7-sonnet");
    } else if (nextTier === "standard") {
      setModelProvider("ollama");
      setModelId("gemma4:26b");
    } else {
      setModelProvider("ollama");
      setModelId("qwen2.5-coder:7b");
    }
  };

  const handleProviderChange = (nextProvider: AgentModelProvider) => {
    setModelProvider(nextProvider);
    const defaultForProvider =
      CURATED_MODELS_BY_PROVIDER[nextProvider]?.[0] || "gemma4:26b";
    setModelId(defaultForProvider);
  };

  const handleStartEdit = (member: TeamMember) => {
    setEditingMemberId(member.id);
    setKind(member.kind);
    setName(member.name);
    setRole(member.role);
    setModelProvider(member.modelProvider || "ollama");
    setModelId(member.modelId || "gemma4:26b");
    setComplexityTier(member.complexityTier || "standard");
    setSystemPrompt(member.systemPrompt || "");
  };

  const handleCancelEdit = () => {
    setEditingMemberId(null);
    setName("");
    setSystemPrompt("");
  };

  const handleAddOrUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const roleMeta =
      ROLE_OPTIONS.find((r) => r.role === role) || ROLE_OPTIONS[0];
    const colors = ["#6965db", "#0ca678", "#1c7ed6", "#e64980", "#f59f00"];
    const avatarColor = colors[team.length % colors.length];

    if (editingMemberId) {
      updateTeamMember(editingMemberId, {
        name: name.trim(),
        kind,
        role,
        roleLabel:
          kind === "ai_agent" ? `AI ${roleMeta.label}` : roleMeta.label,
        modelProvider: kind === "ai_agent" ? modelProvider : undefined,
        modelId: kind === "ai_agent" ? modelId.trim() : undefined,
        complexityTier: kind === "ai_agent" ? complexityTier : undefined,
        systemPrompt:
          kind === "ai_agent"
            ? systemPrompt.trim() ||
              `${roleMeta.label} rolünde proje analiz, tasarım ve TDD süreçlerini yürütür.`
            : undefined,
      });
      setEditingMemberId(null);
    } else {
      addTeamMember({
        name: name.trim(),
        kind,
        role,
        roleLabel:
          kind === "ai_agent" ? `AI ${roleMeta.label}` : roleMeta.label,
        avatarColor,
        modelProvider: kind === "ai_agent" ? modelProvider : undefined,
        modelId: kind === "ai_agent" ? modelId.trim() : undefined,
        complexityTier: kind === "ai_agent" ? complexityTier : undefined,
        systemPrompt:
          kind === "ai_agent"
            ? systemPrompt.trim() ||
              `${roleMeta.label} rolünde proje analiz, tasarım ve TDD süreçlerini yürütür.`
            : undefined,
      });
    }
    setName("");
    setSystemPrompt("");
  };

  const handleTransferMembers = (replaceAll: boolean) => {
    if (!sourceProjectId) return;
    cloneTeamMembersToProject(
      sourceProjectId,
      activeProject.id,
      replaceAll ? undefined : selectedSourceMemberIds,
      replaceAll,
    );
    setTransferFeedback(
      replaceAll
        ? "Seçili projenin tüm ekibi bu projeye birebir aktarıldı."
        : `Seçili ${selectedSourceMemberIds.length} ekip üyesi / AI Agent bu projeye kopyalandı.`,
    );
    setTimeout(() => setTransferFeedback(null), 3500);
  };

  const handleFetchGatewayModels = async (target: "ollama" | "openrouter") => {
    setIsFetchingGateway(true);
    setGatewayFeedback(null);
    try {
      if (target === "ollama") {
        const cleanUrl = (
          gatewayConfig.ollamaUrl || "http://127.0.0.1:11434"
        ).replace(/\/$/, "");
        const res = await fetch(`${cleanUrl}/api/tags`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = (data.models || []).map((m: any) => m.name);
        setFetchedOllamaModels(models);
        setGatewayFeedback(
          `Ollama üzerinden ${models.length} lokal model bulundu.`,
        );
      } else {
        const cleanUrl = (
          gatewayConfig.openRouterBaseUrl || "https://openrouter.ai/api/v1"
        ).replace(/\/$/, "");
        const res = await fetch(`${cleanUrl}/models`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = (data.data || [])
          .slice(0, 40)
          .map((m: any) => m.id)
          .filter(Boolean);
        setFetchedOpenRouterModels(models);
        setGatewayFeedback(
          `OpenRouter kataloğundan ${models.length} model listelendi.`,
        );
      }
    } catch (err: any) {
      setGatewayFeedback(`Bağlantı uyarısı: ${err.message}`);
    } finally {
      setIsFetchingGateway(false);
    }
  };

  const availableSuggestions =
    modelProvider === "ollama" && fetchedOllamaModels.length > 0
      ? fetchedOllamaModels
      : modelProvider === "openrouter" && fetchedOpenRouterModels.length > 0
      ? fetchedOpenRouterModels
      : CURATED_MODELS_BY_PROVIDER[modelProvider] || [];

  const sourceTeamMembers = sourceProjectId
    ? getProjectTeam(sourceProjectId)
    : [];

  return (
    <div className="new-workspace-modal-overlay" onClick={onClose}>
      <div
        className="new-workspace-modal sdlc-team-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="new-workspace-modal__header">
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <h3>Proje Ekibi, AI Agent & Model Yönlendirme</h3>
            <span style={{ fontSize: "0.72rem", color: "var(--color-gray-60)" }}>
              Aktif Proje: <strong>{activeProject?.name}</strong> · Karmaşık işler
              için yüksek modelleri (OpenRouter/API), tekrarlayan işler için lokal
              modelleri (Ollama) atayın
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
          >
            {CloseIcon}
          </button>
        </div>

        {/* Modal Top Segmented Navigation */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0.5rem 1.25rem",
            borderBottom: "1px solid var(--default-border-color, #ebebeb)",
            backgroundColor: "var(--color-surface-mid, #f6f6f9)",
          }}
        >
          <div className="sdlc-segmented">
            <button
              type="button"
              className={`seg-btn ${
                activeTab === "roster" ? "seg-btn--active" : ""
              }`}
              onClick={() => setActiveTab("roster")}
            >
              Proje Kadrosu & Agent Tanımla ({team.length})
            </button>
            <button
              type="button"
              className={`seg-btn ${
                activeTab === "transfer" ? "seg-btn--active" : ""
              }`}
              onClick={() => setActiveTab("transfer")}
            >
              Projeler Arası Ekip Aktar
            </button>
            <button
              type="button"
              className={`seg-btn ${
                activeTab === "gateways" ? "seg-btn--active" : ""
              }`}
              onClick={() => setActiveTab("gateways")}
            >
              OpenRouter & Lokal Gateway Ayarları
            </button>
          </div>
        </div>

        <div className="new-workspace-modal__body">
          {activeTab === "roster" && (
            <>
              <div className="team-roster-columns">
                {/* AI Agent Squad */}
                <div className="roster-column">
                  <div className="roster-col-header">
                    <span>PROJE AI AGENT KADROSU ({agents.length})</span>
                  </div>
                  <div className="roster-list">
                    {agents.map((m) => (
                      <div
                        key={m.id}
                        className={`roster-member-card roster-member-card--agent ${
                          editingMemberId === m.id
                            ? "roster-member-card--editing"
                            : ""
                        }`}
                        onClick={() => handleStartEdit(m)}
                        title="Modelini, sağlayıcısını veya rolünü düzenlemek için tıklayın"
                        style={{ cursor: "pointer" }}
                      >
                        <span
                          className="member-avatar"
                          style={{ backgroundColor: m.avatarColor }}
                        >
                          AI
                        </span>
                        <div className="member-info">
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: 4,
                            }}
                          >
                            <strong>{m.name}</strong>
                            <span className="agent-tier-pill">
                              {m.complexityTier === "high"
                                ? "Karmaşık"
                                : m.complexityTier === "fast"
                                ? "Hızlı/Lokal"
                                : "Standart"}
                            </span>
                          </div>
                          <span>{m.roleLabel}</span>
                          <div className="agent-model-badges">
                            <span className="model-provider-tag">
                              {PROVIDER_LABELS[m.modelProvider || "ollama"]}
                            </span>
                            <code className="model-id-tag">
                              {m.modelId || "gemma4:26b"}
                            </code>
                          </div>
                          {m.systemPrompt && (
                            <p className="member-prompt">{m.systemPrompt}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          className="member-remove-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeTeamMember(m.id);
                          }}
                          title="Agent'ı projeden kaldır"
                        >
                          {TrashIcon}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Human Members */}
                <div className="roster-column">
                  <div className="roster-col-header">
                    <span>İNSAN EKİP ÜYELERİ ({humans.length})</span>
                  </div>
                  <div className="roster-list">
                    {humans.map((m) => (
                      <div
                        key={m.id}
                        className="roster-member-card"
                        onClick={() => handleStartEdit(m)}
                        style={{ cursor: "pointer" }}
                      >
                        <span
                          className="member-avatar"
                          style={{ backgroundColor: m.avatarColor }}
                        >
                          {m.name.slice(0, 2).toUpperCase()}
                        </span>
                        <div className="member-info">
                          <strong>{m.name}</strong>
                          <span>{m.roleLabel}</span>
                        </div>
                        {team.length > 1 && (
                          <button
                            type="button"
                            className="member-remove-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeTeamMember(m.id);
                            }}
                            title="Ekipten çıkar"
                          >
                            {TrashIcon}
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Add or Edit Agent / Member Form */}
              <form className="team-add-form" onSubmit={handleAddOrUpdate}>
                <div className="form-header-row">
                  <strong>
                    {editingMemberId
                      ? "Seçili Agent / Üye Yapılandırmasını Güncelle"
                      : "Bu Projeye Yeni Uzman AI Agent veya Ekip Arkadaşı Tanımla"}
                  </strong>
                  <div className="sdlc-segmented">
                    <button
                      type="button"
                      className={`seg-btn ${
                        kind === "ai_agent" ? "seg-btn--active" : ""
                      }`}
                      onClick={() => setKind("ai_agent")}
                    >
                      AI Agent
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${
                        kind === "human" ? "seg-btn--active" : ""
                      }`}
                      onClick={() => setKind("human")}
                    >
                      İnsan Üye
                    </button>
                  </div>
                </div>

                <div className="sdlc-modal-grid-2">
                  <div className="form-group">
                    <label>
                      {kind === "ai_agent" ? "Agent Adı" : "Ekip Üyesi Adı"}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        kind === "ai_agent"
                          ? "Örn: Kıdemli Güvenlik Mimarı Agent..."
                          : "Örn: Mert (Product Owner)..."
                      }
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Uzmanlık / SDLC Rolü</label>
                    <select
                      className="sdlc-modal-select"
                      value={role}
                      onChange={(e) => setRole(e.target.value as ParticipantRole)}
                    >
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r.role} value={r.role}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {kind === "ai_agent" && (
                  <>
                    <div className="sdlc-modal-grid-3">
                      <div className="form-group">
                        <label>Görev Karmaşıklık Seviyesi</label>
                        <select
                          className="sdlc-modal-select"
                          value={complexityTier}
                          onChange={(e) =>
                            handleComplexityChange(
                              e.target.value as AgentComplexityTier,
                            )
                          }
                        >
                          <option value="high">
                            {TIER_LABELS.high} (Mimari/Analiz)
                          </option>
                          <option value="standard">
                            {TIER_LABELS.standard} (Genel)
                          </option>
                          <option value="fast">
                            {TIER_LABELS.fast} (Tekrarlayan İşler)
                          </option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Model Sağlayıcı / Gateway</label>
                        <select
                          className="sdlc-modal-select"
                          value={modelProvider}
                          onChange={(e) =>
                            handleProviderChange(
                              e.target.value as AgentModelProvider,
                            )
                          }
                        >
                          <option value="openrouter">
                            OpenRouter (Çoklu Model Gateway)
                          </option>
                          <option value="ollama">
                            Ollama (Lokal & Ücretsiz LLM)
                          </option>
                          <option value="openai">OpenAI / Kurumsal API</option>
                          <option value="custom">Özel Endpoint</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Tercih Edilen Model (Seçin veya Yazın)</label>
                        <input
                          type="text"
                          list="agent-model-suggestions"
                          placeholder="Örn: anthropic/claude-3.7-sonnet veya gemma4:26b"
                          value={modelId}
                          onChange={(e) => setModelId(e.target.value)}
                        />
                        <datalist id="agent-model-suggestions">
                          {availableSuggestions.map((m) => (
                            <option key={m} value={m} />
                          ))}
                        </datalist>
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Agent Görev Yönergesi (System Prompt)</label>
                      <input
                        type="text"
                        placeholder="Örn: Karmaşık dağıtık sistem mimarilerini analiz eder, darboğazları ve kabul kriterlerini çıkarır..."
                        value={systemPrompt}
                        onChange={(e) => setSystemPrompt(e.target.value)}
                      />
                    </div>
                  </>
                )}

                <div className="team-add-actions">
                  {editingMemberId && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={handleCancelEdit}
                    >
                      <span>Düzenlemeyi İptal Et</span>
                    </button>
                  )}
                  {onOpenAIStudio && (
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        onClose();
                        onOpenAIStudio();
                      }}
                    >
                      {brainIcon}
                      <span>SDLC AI & MCP Stüdyosu</span>
                    </button>
                  )}
                  <button type="submit" className="btn-primary">
                    {editingMemberId ? checkIcon : PlusIcon}
                    <span>
                      {editingMemberId
                        ? "Değişiklikleri Kaydet"
                        : kind === "ai_agent"
                        ? "AI Agent'ı Projeye Ekle"
                        : "Üyeyi Projeye Ekle"}
                    </span>
                  </button>
                </div>
              </form>
            </>
          )}

          {activeTab === "transfer" && (
            <div className="team-transfer-section">
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "var(--color-gray-60)",
                  lineHeight: 1.45,
                }}
              >
                Başka bir projede memnun kaldığınız AI Agent yapılandırmalarını
                (model tercihleri, OpenRouter/Ollama ayarları ve sistem
                yönergeleriyle birlikte) veya insan ekip üyelerini tek tek seçerek
                ya da tüm kadro olarak <strong>{activeProject?.name}</strong>{" "}
                projesine aktarabilirsiniz.
              </p>

              {otherProjects.length === 0 ? (
                <div
                  style={{
                    padding: "1.25rem",
                    borderRadius: 8,
                    backgroundColor: "var(--color-surface-low)",
                    border: "1px solid var(--default-border-color)",
                    fontSize: "0.78rem",
                    textAlign: "center",
                    color: "var(--color-gray-60)",
                  }}
                >
                  Henüz ikinci bir projeniz bulunmuyor. Sol üstteki{" "}
                  <strong>Proje Gezgini → + Yeni Proje</strong> menüsünden yeni bir
                  proje oluştururken mevcut ekibinizi doğrudan aktarabilir veya
                  daha sonra buradan projeler arası kopyalama yapabilirsiniz.
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>Kaynak Proje Seçin</label>
                    <select
                      className="sdlc-modal-select"
                      value={sourceProjectId}
                      onChange={(e) => setSourceProjectId(e.target.value)}
                    >
                      {otherProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({getProjectTeam(p.id).length} üye/agent)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="transfer-member-list">
                    {sourceTeamMembers.map((m) => {
                      const checked = selectedSourceMemberIds.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          className={`transfer-member-row ${
                            checked ? "transfer-member-row--checked" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedSourceMemberIds((prev) => [
                                  ...prev,
                                  m.id,
                                ]);
                              } else {
                                setSelectedSourceMemberIds((prev) =>
                                  prev.filter((id) => id !== m.id),
                                );
                              }
                            }}
                          />
                          <span
                            className="member-avatar"
                            style={{
                              backgroundColor: m.avatarColor,
                              width: 24,
                              height: 24,
                              borderRadius: "50%",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            {m.kind === "ai_agent"
                              ? "AI"
                              : m.name.slice(0, 2).toUpperCase()}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 6,
                                fontSize: "0.75rem",
                                fontWeight: 700,
                              }}
                            >
                              <span>{m.name}</span>
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--color-primary)",
                                  fontWeight: 600,
                                }}
                              >
                                ({m.roleLabel})
                              </span>
                            </div>
                            {m.kind === "ai_agent" && (
                              <div
                                style={{
                                  fontSize: "0.65rem",
                                  color: "var(--color-gray-60)",
                                }}
                              >
                                {PROVIDER_LABELS[m.modelProvider || "ollama"]} ·{" "}
                                <code>{m.modelId || "gemma4:26b"}</code>
                              </div>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {transferFeedback && (
                    <div
                      style={{
                        padding: "0.5rem 0.75rem",
                        borderRadius: 6,
                        backgroundColor: "rgba(12, 166, 120, 0.12)",
                        color: "#099268",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                      }}
                    >
                      {transferFeedback}
                    </div>
                  )}

                  <div
                    className="team-add-actions"
                    style={{ justifyContent: "space-between" }}
                  >
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => handleTransferMembers(true)}
                    >
                      <span>Tüm Kadroyu Birebir Aktar (Üzerine Yaz)</span>
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={selectedSourceMemberIds.length === 0}
                      onClick={() => handleTransferMembers(false)}
                    >
                      {PlusIcon}
                      <span>
                        Seçili ({selectedSourceMemberIds.length}) Üye / Agent'ı Bu
                        Projeye Ekle
                      </span>
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === "gateways" && (
            <div className="team-transfer-section">
              <p
                style={{
                  margin: 0,
                  fontSize: "0.78rem",
                  color: "var(--color-gray-60)",
                  lineHeight: 1.45,
                }}
              >
                Tekrarlayan / hızlı görevler için <strong>Ollama (Lokal)</strong>{" "}
                sunucunuzu, karmaşık mimari ve tasarım görevleri için{" "}
                <strong>OpenRouter</strong> (Claude, Gemini, GPT, DeepSeek, Qwen
                geçidi) veya kurumsal <strong>OpenAI</strong> bağlantınızı
                buradan yapılandırabilirsiniz.
              </p>

              <div className="sdlc-modal-grid-2">
                <div className="form-group">
                  <label>Ollama (Lokal LLM) Sunucu Adresi</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      value={gatewayConfig.ollamaUrl}
                      onChange={(e) =>
                        setGatewayConfig(
                          saveAIProviderGatewayConfig({
                            ollamaUrl: e.target.value,
                          }),
                        )
                      }
                      placeholder="http://127.0.0.1:11434"
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        height: "2.25rem",
                        padding: "0 0.65rem",
                        borderRadius: 6,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      disabled={isFetchingGateway}
                      onClick={() => handleFetchGatewayModels("ollama")}
                    >
                      Test & Modelleri Çek
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>OpenRouter Gateway Base URL</label>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      type="text"
                      value={gatewayConfig.openRouterBaseUrl}
                      onChange={(e) =>
                        setGatewayConfig(
                          saveAIProviderGatewayConfig({
                            openRouterBaseUrl: e.target.value,
                          }),
                        )
                      }
                      placeholder="https://openrouter.ai/api/v1"
                    />
                    <button
                      type="button"
                      className="btn-secondary"
                      style={{
                        height: "2.25rem",
                        padding: "0 0.65rem",
                        borderRadius: 6,
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      disabled={isFetchingGateway}
                      onClick={() => handleFetchGatewayModels("openrouter")}
                    >
                      Kataloğu Çek
                    </button>
                  </div>
                </div>
              </div>

              <div className="sdlc-modal-grid-2">
                <div className="form-group">
                  <label>OpenRouter API Anahtarı (Key)</label>
                  <input
                    type="password"
                    value={gatewayConfig.openRouterApiKey}
                    onChange={(e) =>
                      setGatewayConfig(
                        saveAIProviderGatewayConfig({
                          openRouterApiKey: e.target.value,
                        }),
                      )
                    }
                    placeholder="sk-or-v1-..."
                  />
                </div>

                <div className="form-group">
                  <label>OpenAI / Özel API Anahtarı (Key)</label>
                  <input
                    type="password"
                    value={gatewayConfig.openAiApiKey}
                    onChange={(e) =>
                      setGatewayConfig(
                        saveAIProviderGatewayConfig({
                          openAiApiKey: e.target.value,
                        }),
                      )
                    }
                    placeholder="sk-..."
                  />
                </div>
              </div>

              {gatewayFeedback && (
                <div
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: 6,
                    backgroundColor: "var(--color-surface-primary-container)",
                    color: "var(--color-primary)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                  }}
                >
                  {gatewayFeedback}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
