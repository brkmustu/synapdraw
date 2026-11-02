import React, { useEffect, useState } from "react";
import { useI18n } from "@excalidraw/excalidraw/i18n";
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
  frameToolIcon,
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
  runLiveAgentPipeline,
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
  ArchitectureIcon,
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
  const { t } = useI18n();
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
      given: `"${activeDoc.name}"`,
      when: quickTestTitle,
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
      `${activeDoc.name} (${targetEls.length})`;

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
        : [sketchInfo.label];
    const created = createProjectTask({
      title: sketchInfo.label,
      description: `${activeDoc.name} (${sketchInfo.ids.length})`,
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
    setSketchFeedback(
      t("sdlc.contextDrawer.taskCreatedAndPinnedFeedback", {
        key: created.key,
      }),
    );
    setTimeout(() => setSketchFeedback(null), 3200);
  };

  return (
    <aside className="sdlc-context-drawer Island">
      <div className="context-drawer-header">
        <div className="context-title-block">
          <span className="context-eyebrow">
            {t("sdlc.contextDrawer.eyebrow")}
          </span>
          <h4>{activeDoc.name}</h4>
        </div>
        <button
          type="button"
          className="detail-icon-btn"
          onClick={onClose}
          title={t("sdlc.contextDrawer.closeTitle")}
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
              <span>{t("sdlc.contextDrawer.openTasksSideBySide")}</span>
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
              <span>{t("sdlc.contextDrawer.openTddSideBySide")}</span>
              {SplitViewIcon}
            </button>
          )}
        </div>

        {/* Excalidraw Sketch Selection -> Task Deep-Pinning */}
        {activeDoc.canvasType === "sketch" && (
          <div className="context-section">
            <div className="context-section-header">
              <span>{t("sdlc.contextDrawer.sketchPinningSection")}</span>
              <button
                type="button"
                className="context-link-btn"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
                onClick={() => setSelectionTick((t) => t + 1)}
                title={t("sdlc.contextDrawer.refreshSelectionTitle")}
              >
                <span
                  style={{ display: "inline-flex", width: 12, height: 12 }}
                >
                  {RetryIcon}
                </span>
                <span>{t("sdlc.contextDrawer.refreshSelectionBtn")}</span>
              </button>
            </div>
            {sketchInfo.ids.length === 0 ? (
              <div className="context-empty">
                {t("sdlc.contextDrawer.emptySketchCanvas")}
              </div>
            ) : (
              <div className="context-mini-card">
                <div style={{ fontSize: 11.5, fontWeight: 700 }}>
                  {sketchInfo.isExplicitSelection
                    ? t("sdlc.contextDrawer.selectedFlowLabel", {
                        label: sketchInfo.label,
                      })
                    : t("sdlc.contextDrawer.canvasFlowLabel", {
                        label: sketchInfo.label,
                      })}
                </div>
                <div style={{ fontSize: 11, opacity: 0.72 }}>
                  {t("sdlc.contextDrawer.sketchStats", {
                    elements: sketchInfo.ids.length,
                    texts: sketchInfo.texts.length,
                  })}
                </div>
                <button
                  type="button"
                  className="context-split-btn"
                  style={{ marginTop: 4 }}
                  onClick={handleCreateTaskFromSketch}
                >
                  {PlusIcon}
                  <span>{t("sdlc.contextDrawer.createTaskFromFlowBtn")}</span>
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
                      setSketchFeedback(
                        t("sdlc.contextDrawer.flowPinnedFeedback"),
                      );
                      setTimeout(() => setSketchFeedback(null), 2800);
                    }}
                  >
                    <option value="">
                      {t("sdlc.contextDrawer.pinFlowToTaskSelect")}
                    </option>
                    {tasks.map((taskItem) => (
                      <option key={taskItem.id} value={taskItem.id}>
                        {taskItem.key}: {taskItem.title}
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
            <span>
              {t("sdlc.contextDrawer.linkedTasksSection", {
                count: linkedTasks.length,
              })}
            </span>
            {taskBoardDoc && (
              <button
                type="button"
                className="context-link-btn"
                onClick={() => setActiveWorkspaceId(taskBoardDoc.id)}
              >
                {t("sdlc.contextDrawer.allBoardBtn")}
              </button>
            )}
          </div>

          {linkedTasks.length === 0 ? (
            <div className="context-empty">
              {t("sdlc.contextDrawer.noLinkedTasks")}
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
                      <option value="backlog">
                        {t("sdlc.tasks.colBacklog")}
                      </option>
                      <option value="design">
                        {t("sdlc.categories.ui_design")}
                      </option>
                      <option value="in_progress">
                        {t("sdlc.tasks.colInProgress")}
                      </option>
                      <option value="testing">
                        {t("sdlc.tasks.colReview")}
                      </option>
                      <option value="done">{t("sdlc.tasks.colDone")}</option>
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
                          title={sr.label}
                        >
                          <span className="chip-icon">{ArchitectureIcon}</span>
                          <span>{sr.label}</span>
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
                          title={la.label}
                        >
                          <span className="chip-icon">{frameToolIcon}</span>
                          <span>{la.label}</span>
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
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                      onClick={() => {
                        void runLiveAgentPipeline(task.id, "architecture");
                      }}
                      title={t("sdlc.contextDrawer.archBtnTitle")}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          width: 12,
                          height: 12,
                        }}
                      >
                        {ArchitectureIcon}
                      </span>
                      <span>{t("sdlc.contextDrawer.archBtn")}</span>
                    </button>
                    <span style={{ opacity: 0.35 }}>·</span>
                    <button
                      type="button"
                      className="context-link-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                      onClick={() => {
                        void runLiveAgentPipeline(task.id, "design");
                      }}
                      title={t("sdlc.contextDrawer.uiGenBtnTitle")}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          width: 12,
                          height: 12,
                        }}
                      >
                        {frameToolIcon}
                      </span>
                      <span>{t("sdlc.contextDrawer.uiGenBtn")}</span>
                    </button>
                    <span style={{ opacity: 0.35 }}>·</span>
                    <button
                      type="button"
                      className="context-link-btn"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                      onClick={() => {
                        void runLiveAgentPipeline(task.id, "tdd");
                      }}
                      title={t("sdlc.contextDrawer.tddGenBtnTitle")}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          width: 12,
                          height: 12,
                        }}
                      >
                        {TDDTestIcon}
                      </span>
                      <span>{t("sdlc.contextDrawer.tddGenBtn")}</span>
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
              <option value="">
                {t("sdlc.contextDrawer.attachExistingTaskSelect")}
              </option>
              {unlinkedTasks.map((taskItem) => (
                <option key={taskItem.id} value={taskItem.id}>
                  {taskItem.key}: {taskItem.title}
                </option>
              ))}
            </select>
          )}

          <form className="context-inline-form" onSubmit={handleQuickAddTask}>
            <input
              type="text"
              placeholder={t("sdlc.contextDrawer.addNewTaskPlaceholder")}
              value={quickTaskTitle}
              onChange={(e) => setQuickTaskTitle(e.target.value)}
            />
            <button type="submit">{PlusIcon}</button>
          </form>
        </div>

        {/* Linked TDD Scenarios Section */}
        <div className="context-section">
          <div className="context-section-header">
            <span>
              {t("sdlc.contextDrawer.relatedTddSection", {
                count: linkedScenarios.length,
              })}
            </span>
            {tddSuiteDoc && (
              <button
                type="button"
                className="context-link-btn"
                onClick={() => setActiveWorkspaceId(tddSuiteDoc.id)}
              >
                {t("sdlc.contextDrawer.tddStudioBtn")}
              </button>
            )}
          </div>

          {linkedScenarios.length === 0 ? (
            <div className="context-empty">
              {t("sdlc.contextDrawer.noLinkedTdd")}
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
                      <strong>{t("sdlc.tdd.givenLabel")}:</strong> {sc.given}
                    </div>
                    <div>
                      <strong>{t("sdlc.tdd.whenLabel")}:</strong> {sc.when}
                    </div>
                    <div>
                      <strong>{t("sdlc.tdd.thenLabel")}:</strong> {sc.then}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <form className="context-inline-form" onSubmit={handleQuickAddTDD}>
            <input
              type="text"
              placeholder={t("sdlc.contextDrawer.quickTddPlaceholder")}
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
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<"roster" | "transfer" | "gateways">(
    initialTab,
  );
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  const ROLE_OPTIONS: { role: ParticipantRole; label: string }[] = [
    { role: "developer", label: t("sdlc.teamModal.roleDeveloper") },
    { role: "po", label: t("sdlc.teamModal.rolePo") },
    { role: "pm", label: t("sdlc.teamModal.rolePm") },
    { role: "architect", label: t("sdlc.teamModal.roleArchitect") },
    { role: "designer", label: t("sdlc.teamModal.roleDesigner") },
    { role: "qa", label: t("sdlc.teamModal.roleQa") },
  ];

  const PROVIDER_LABELS: Record<AgentModelProvider, string> = {
    ollama: t("sdlc.teamModal.providerOllama"),
    openrouter: t("sdlc.teamModal.providerOpenrouter"),
    openai: t("sdlc.teamModal.providerOpenai"),
    custom: t("sdlc.teamModal.providerCustom"),
  };

  const TIER_LABELS: Record<AgentComplexityTier, string> = {
    high: t("sdlc.teamModal.tierHighLabel"),
    standard: t("sdlc.teamModal.tierStandardLabel"),
    fast: t("sdlc.teamModal.tierFastLabel"),
  };

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
            ? systemPrompt.trim() || roleMeta.label
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
            ? systemPrompt.trim() || roleMeta.label
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
        ? t("sdlc.teamModal.transferAllFeedback")
        : t("sdlc.teamModal.transferSelectedFeedback", {
            count: selectedSourceMemberIds.length,
          }),
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
          t("sdlc.teamModal.ollamaFoundFeedback", { count: models.length }),
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
          t("sdlc.teamModal.openrouterFoundFeedback", { count: models.length }),
        );
      }
    } catch (err: any) {
      setGatewayFeedback(
        t("sdlc.teamModal.connectionWarningFeedback", { msg: err.message }),
      );
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
            <h3>{t("sdlc.teamModal.title")}</h3>
            <span style={{ fontSize: "0.72rem", color: "var(--color-gray-60)" }}>
              {t("sdlc.teamModal.subtitle", {
                name: activeProject?.name || "",
              })}
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
              {t("sdlc.teamModal.tabRoster", { count: team.length })}
            </button>
            <button
              type="button"
              className={`seg-btn ${
                activeTab === "transfer" ? "seg-btn--active" : ""
              }`}
              onClick={() => setActiveTab("transfer")}
            >
              {t("sdlc.teamModal.tabTransfer")}
            </button>
            <button
              type="button"
              className={`seg-btn ${
                activeTab === "gateways" ? "seg-btn--active" : ""
              }`}
              onClick={() => setActiveTab("gateways")}
            >
              {t("sdlc.teamModal.tabGateways")}
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
                    <span>
                      {t("sdlc.teamModal.aiSquadHeader", {
                        count: agents.length,
                      })}
                    </span>
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
                        title={t("sdlc.teamModal.editAgentCardTitle")}
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
                                ? t("sdlc.teamModal.tierHighShort")
                                : m.complexityTier === "fast"
                                ? t("sdlc.teamModal.tierFastShort")
                                : t("sdlc.teamModal.tierStandardShort")}
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
                          title={t("sdlc.teamModal.removeAgentTitle")}
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
                    <span>
                      {t("sdlc.teamModal.humanMembersHeader", {
                        count: humans.length,
                      })}
                    </span>
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
                            title={t("sdlc.teamModal.removeMemberTitle")}
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
                      ? t("sdlc.teamModal.editFormHeader")
                      : t("sdlc.teamModal.addFormHeader")}
                  </strong>
                  <div className="sdlc-segmented">
                    <button
                      type="button"
                      className={`seg-btn ${
                        kind === "ai_agent" ? "seg-btn--active" : ""
                      }`}
                      onClick={() => setKind("ai_agent")}
                    >
                      {t("sdlc.teamModal.aiAgentToggle")}
                    </button>
                    <button
                      type="button"
                      className={`seg-btn ${
                        kind === "human" ? "seg-btn--active" : ""
                      }`}
                      onClick={() => setKind("human")}
                    >
                      {t("sdlc.teamModal.humanToggle")}
                    </button>
                  </div>
                </div>

                <div className="sdlc-modal-grid-2">
                  <div className="form-group">
                    <label>
                      {kind === "ai_agent"
                        ? t("sdlc.teamModal.agentNameLabel")
                        : t("sdlc.teamModal.memberNameLabel")}
                    </label>
                    <input
                      type="text"
                      placeholder={
                        kind === "ai_agent"
                          ? t("sdlc.teamModal.agentNamePlaceholder")
                          : t("sdlc.teamModal.memberNamePlaceholder")
                      }
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t("sdlc.teamModal.roleFieldLabel")}</label>
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
                        <label>
                          {t("sdlc.teamModal.complexityFieldLabel")}
                        </label>
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
                            {t("sdlc.teamModal.complexityOptHigh", {
                              label: TIER_LABELS.high,
                            })}
                          </option>
                          <option value="standard">
                            {t("sdlc.teamModal.complexityOptStandard", {
                              label: TIER_LABELS.standard,
                            })}
                          </option>
                          <option value="fast">
                            {t("sdlc.teamModal.complexityOptFast", {
                              label: TIER_LABELS.fast,
                            })}
                          </option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>{t("sdlc.teamModal.providerFieldLabel")}</label>
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
                            {t("sdlc.teamModal.providerOptOpenrouter")}
                          </option>
                          <option value="ollama">
                            {t("sdlc.teamModal.providerOptOllama")}
                          </option>
                          <option value="openai">
                            {t("sdlc.teamModal.providerOptOpenai")}
                          </option>
                          <option value="custom">
                            {t("sdlc.teamModal.providerOptCustom")}
                          </option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>{t("sdlc.teamModal.modelFieldLabel")}</label>
                        <input
                          type="text"
                          list="agent-model-suggestions"
                          placeholder={t("sdlc.teamModal.modelPlaceholder")}
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
                      <label>{t("sdlc.teamModal.systemPromptLabel")}</label>
                      <input
                        type="text"
                        placeholder={t("sdlc.teamModal.systemPromptPlaceholder")}
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
                      <span>{t("sdlc.teamModal.cancelEditBtn")}</span>
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
                      <span>{t("sdlc.teamModal.openAiStudioBtn")}</span>
                    </button>
                  )}
                  <button type="submit" className="btn-primary">
                    {editingMemberId ? checkIcon : PlusIcon}
                    <span>
                      {editingMemberId
                        ? t("sdlc.teamModal.saveChangesBtn")
                        : kind === "ai_agent"
                        ? t("sdlc.teamModal.addAgentSubmitBtn")
                        : t("sdlc.teamModal.addMemberSubmitBtn")}
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
                {t("sdlc.teamModal.transferIntro", {
                  name: activeProject?.name || "",
                })}
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
                  {t("sdlc.teamModal.noOtherProjects")}
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label>
                      {t("sdlc.teamModal.selectSourceProjectLabel")}
                    </label>
                    <select
                      className="sdlc-modal-select"
                      value={sourceProjectId}
                      onChange={(e) => setSourceProjectId(e.target.value)}
                    >
                      {otherProjects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} (
                          {t("sdlc.teamModal.membersCountSuffix", {
                            count: getProjectTeam(p.id).length,
                          })}
                          )
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
                      <span>{t("sdlc.teamModal.replaceAllSquadBtn")}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={selectedSourceMemberIds.length === 0}
                      onClick={() => handleTransferMembers(false)}
                    >
                      {PlusIcon}
                      <span>
                        {t("sdlc.teamModal.transferSelectedBtn", {
                          count: selectedSourceMemberIds.length,
                        })}
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
                {t("sdlc.teamModal.gatewaysIntro")}
              </p>

              <div className="sdlc-modal-grid-2">
                <div className="form-group">
                  <label>{t("sdlc.teamModal.ollamaUrlLabel")}</label>
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
                      {t("sdlc.teamModal.testFetchModelsBtn")}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>{t("sdlc.teamModal.openrouterUrlLabel")}</label>
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
                      {t("sdlc.teamModal.fetchCatalogBtn")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="sdlc-modal-grid-2">
                <div className="form-group">
                  <label>{t("sdlc.teamModal.openrouterKeyLabel")}</label>
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
                  <label>{t("sdlc.teamModal.openaiKeyLabel")}</label>
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
