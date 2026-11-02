import React, { useEffect, useState } from "react";
import {
  PlusIcon,
  CloseIcon,
  TrashIcon,
  brainIcon,
  searchIcon,
  checkIcon,
  frameToolIcon,
  FreedrawIcon,
  PinIcon,
  settingsIcon,
  usersIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import {
  getProjectTasks,
  createProjectTask,
  updateProjectTask,
  deleteProjectTask,
  addTaskComment,
  getProjectTDDScenarios,
  generateTDDFromTask,
  getProjectTeam,
  getWorkspaces,
  setActiveWorkspaceId,
  setSplitWorkspaceId,
  requestArtboardFocus,
  requestSketchFocus,
  toggleTaskArtboardLink,
  executeAgentOnTask,
  runLiveAgentPipeline,
  getCategoryLabel,
  subscribeWorkspaces,
  type ProjectTask,
  type TaskStatus,
  type TaskPriority,
  type TDDScenario,
  type TeamMember,
  type WorkspaceDocument,
  type LinkedArtboardRef,
} from "../workspace/workspaceStore";
import {
  loadDesignDocument,
  createArtboardInDesignDoc,
  type Artboard,
} from "../design/model";
import {
  getDocumentIcon,
  SplitViewIcon,
  TDDTestIcon,
  ArchitectureIcon,
} from "../workspace/WorkspaceTabs";
import "./sdlc.scss";

interface TaskBoardSurfaceProps {
  documentId: string;
  documentName: string;
  onOpenAIIntegrations?: () => void;
  compact?: boolean;
}

export const TaskBoardSurface: React.FC<TaskBoardSurfaceProps> = ({
  onOpenAIIntegrations,
  compact = false,
}) => {
  const { t } = useI18n();
  const COLUMNS: { status: TaskStatus; label: string }[] = [
    { status: "backlog", label: t("sdlc.tasks.colBacklog") },
    { status: "design", label: t("sdlc.tasks.colTodo") },
    { status: "in_progress", label: t("sdlc.tasks.colInProgress") },
    { status: "testing", label: t("sdlc.tasks.colReview") },
    { status: "done", label: t("sdlc.tasks.colDone") },
  ];
  const PRIORITY_LABELS: Record<TaskPriority, string> = {
    low: t("sdlc.tasks.priorityLow"),
    medium: t("sdlc.tasks.priorityMedium"),
    high: t("sdlc.tasks.priorityHigh"),
    critical: t("sdlc.tasks.priorityCritical"),
  };
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [scenarios, setScenarios] = useState<TDDScenario[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);

  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStatus, setNewStatus] = useState<TaskStatus>("backlog");
  const [newPriority, setNewPriority] = useState<TaskPriority>("high");
  const [newAssigneeId, setNewAssigneeId] = useState<string>("");
  const [newCriteriaText, setNewCriteriaText] = useState("");
  const [newLinkedDocs, setNewLinkedDocs] = useState<string[]>([]);
  const [newLinkedArtboards, setNewLinkedArtboards] = useState<
    LinkedArtboardRef[]
  >([]);

  // Detail panel state
  const [inspectorTab, setInspectorTab] = useState<
    "overview" | "traceability" | "agent" | "activity"
  >("overview");
  const [designArtboardsByDoc, setDesignArtboardsByDoc] = useState<
    Record<string, Artboard[]>
  >({});
  const [newCriterionInput, setNewCriterionInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [commentAuthorId, setCommentAuthorId] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<TaskStatus | null>(null);
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const ownerWin = rootRef.current?.ownerDocument?.defaultView || undefined;
    const sync = () => {
      const tList = getProjectTasks();
      const sList = getProjectTDDScenarios();
      const mList = getProjectTeam();
      const dList = getWorkspaces();
      setTasks(tList);
      setScenarios(sList);
      setTeam(mList);
      setDocs(dList);

      const abMap: Record<string, Artboard[]> = {};
      for (const docItem of dList) {
        if (docItem.canvasType === "design") {
          const loaded = loadDesignDocument(
            docItem.id,
            docItem.name,
            ownerWin,
          );
          abMap[docItem.id] = loaded.artboards;
        }
      }
      setDesignArtboardsByDoc(abMap);

      if (!commentAuthorId && mList.length > 0) {
        setCommentAuthorId(mList[0].id);
      }
    };
    sync();
    const unsub = subscribeWorkspaces(sync);
    if (ownerWin) {
      ownerWin.addEventListener("synapdraw:design-doc-updated", sync);
    }
    return () => {
      unsub();
      if (ownerWin) {
        ownerWin.removeEventListener("synapdraw:design-doc-updated", sync);
      }
    };
  }, [commentAuthorId]);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) || null;

  const filteredTasks = tasks.filter((t) => {
    if (assigneeFilter === "humans") {
      const m = team.find((mem) => mem.id === t.assigneeId);
      if (!m || m.kind !== "human") return false;
    } else if (assigneeFilter === "agents") {
      const m = team.find((mem) => mem.id === t.assigneeId);
      if (!m || m.kind !== "ai_agent") return false;
    } else if (assigneeFilter !== "all" && t.assigneeId !== assigneeFilter) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.key.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleOpenCreate = (defaultStatus: TaskStatus = "backlog") => {
    setNewTitle("");
    setNewDesc("");
    setNewStatus(defaultStatus);
    setNewPriority("high");
    setNewAssigneeId(team[0]?.id || "");
    setNewCriteriaText("");
    setNewLinkedDocs([]);
    setNewLinkedArtboards([]);
    setIsCreateOpen(true);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const criteria = newCriteriaText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const created = createProjectTask({
      title: newTitle,
      description: newDesc,
      status: newStatus,
      priority: newPriority,
      assigneeId: newAssigneeId || null,
      acceptanceCriteria: criteria,
      linkedDocIds: newLinkedDocs,
      linkedArtboards: newLinkedArtboards,
    });
    setIsCreateOpen(false);
    setSelectedTaskId(created.id);
    showToast(`${created.key} oluşturuldu.`);
  };

  const handleToggleCriterion = (task: ProjectTask, critId: string) => {
    const updated = task.acceptanceCriteria.map((c) =>
      c.id === critId ? { ...c, completed: !c.completed } : c,
    );
    updateProjectTask(task.id, { acceptanceCriteria: updated });
  };

  const handleAddCriterion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newCriterionInput.trim()) return;
    const updated = [
      ...selectedTask.acceptanceCriteria,
      {
        id: `ac_${Date.now()}`,
        text: newCriterionInput.trim(),
        completed: false,
      },
    ];
    updateProjectTask(selectedTask.id, { acceptanceCriteria: updated });
    setNewCriterionInput("");
  };

  const handleToggleDocLink = (task: ProjectTask, docId: string) => {
    const exists = task.linkedDocIds.includes(docId);
    const updated = exists
      ? task.linkedDocIds.filter((id) => id !== docId)
      : [...task.linkedDocIds, docId];
    updateProjectTask(task.id, { linkedDocIds: updated });
  };

  const handleGenerateTDD = (task: ProjectTask) => {
    const created = generateTDDFromTask(task.id);
    if (created.length > 0) {
      showToast(`${created.length} yeni TDD test senaryosu üretildi.`);
    } else {
      showToast("Bu görevin tüm kriterleri için TDD senaryosu zaten mevcut.");
    }
  };

  const handleAddComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !commentInput.trim()) return;
    addTaskComment(
      selectedTask.id,
      commentAuthorId || team[0]?.id || "human",
      commentInput,
    );
    setCommentInput("");
  };

  return (
    <div ref={rootRef} className="sdlc-surface-root">
      {/* Top Island Toolbar */}
      <div className="sdlc-top-island Island" role="toolbar">
        <div className="sdlc-segmented">
          <button
            type="button"
            className={`seg-btn ${viewMode === "kanban" ? "seg-btn--active" : ""}`}
            onClick={() => setViewMode("kanban")}
          >
            {t("sdlc.tasks.kanban")}
          </button>
          <button
            type="button"
            className={`seg-btn ${viewMode === "list" ? "seg-btn--active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            {t("sdlc.tasks.list")}
          </button>
        </div>

        <div className="sdlc-island-divider" />

        <select
          className="sdlc-toolbar-select"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          title={t("sdlc.tasks.allAssignees")}
        >
          <option value="all">
            {t("sdlc.tasks.allAssignees")} ({tasks.length})
          </option>
          <option value="humans">{t("sdlc.teamModal.humanMemberBadge")}</option>
          <option value="agents">{t("sdlc.teamModal.aiSubagentBadge")}</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.kind === "ai_agent" ? "[AI] " : ""}
              {m.name}
            </option>
          ))}
        </select>

        {!compact && (
          <div className="sdlc-toolbar-search">
            <span className="search-icon">{searchIcon}</span>
            <input
              type="text"
              placeholder={t("sdlc.tasks.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className="sdlc-island-divider" />

        <button
          type="button"
          className="sdlc-primary-btn"
          onClick={() => handleOpenCreate("backlog")}
        >
          {PlusIcon}
          <span>{t("sdlc.tasks.newTaskBtn")}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="sdlc-content-area">
        {viewMode === "kanban" ? (
          <div className="sdlc-kanban-board">
            {COLUMNS.map((col) => {
              const colTasks = filteredTasks.filter(
                (t) => t.status === col.status,
              );
              return (
                <div
                  key={col.status}
                  className="sdlc-kanban-column"
                  style={
                    dragOverCol === col.status
                      ? {
                          outline: "2px dashed var(--color-primary)",
                          outlineOffset: -2,
                        }
                      : undefined
                  }
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (dragOverCol !== col.status) {
                      setDragOverCol(col.status);
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverCol === col.status) {
                      setDragOverCol(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverCol(null);
                    const taskId =
                      draggedTaskId || e.dataTransfer.getData("text/plain");
                    setDraggedTaskId(null);
                    if (!taskId) return;
                    const targetTask = tasks.find((t) => t.id === taskId);
                    if (targetTask && targetTask.status !== col.status) {
                      updateProjectTask(taskId, { status: col.status });
                      showToast(`${targetTask.key} → "${col.label}"`);
                    }
                  }}
                >
                  <div className="kanban-column-header">
                    <span className="col-title">{col.label}</span>
                    <span className="col-count">{colTasks.length}</span>
                    <button
                      type="button"
                      className="col-add-btn"
                      onClick={() => handleOpenCreate(col.status)}
                      title={t("sdlc.tasks.addTaskInCol")}
                    >
                      {PlusIcon}
                    </button>
                  </div>

                  <div className="kanban-column-cards">
                    {colTasks.map((task) => {
                      const assignee = team.find(
                        (m) => m.id === task.assigneeId,
                      );
                      const taskScenarios = scenarios.filter(
                        (s) => s.linkedTaskId === task.id,
                      );
                      const greenCount = taskScenarios.filter(
                        (s) => s.status === "green" || s.status === "refactor",
                      ).length;
                      const doneCriteria = task.acceptanceCriteria.filter(
                        (c) => c.completed,
                      ).length;
                      const linkedDocs = docs.filter((d) =>
                        task.linkedDocIds.includes(d.id),
                      );

                      return (
                        <div
                          key={task.id}
                          draggable
                          onDragStart={(e) => {
                            setDraggedTaskId(task.id);
                            e.dataTransfer.setData("text/plain", task.id);
                            e.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => {
                            setDraggedTaskId(null);
                            setDragOverCol(null);
                          }}
                          className={`sdlc-task-card Island ${
                            selectedTaskId === task.id
                              ? "sdlc-task-card--selected"
                              : ""
                          }`}
                          onClick={() => setSelectedTaskId(task.id)}
                        >
                          <div className="task-card-top">
                            <span className="task-key">{task.key}</span>
                            <span
                              className={`priority-pill priority-pill--${task.priority}`}
                            >
                              {PRIORITY_LABELS[task.priority]}
                            </span>
                          </div>

                          <h4 className="task-title">{task.title}</h4>
                          {task.description && (
                            <p className="task-desc">{task.description}</p>
                          )}

                          {/* Linked Artifacts Chips */}
                          {(linkedDocs.length > 0 ||
                            (task.linkedArtboards &&
                              task.linkedArtboards.length > 0) ||
                            (task.linkedSketchRefs &&
                              task.linkedSketchRefs.length > 0) ||
                            taskScenarios.length > 0) && (
                            <div
                              className="task-links-row"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {linkedDocs
                                .filter(
                                  (doc) =>
                                    doc.canvasType !== "design" ||
                                    !(task.linkedArtboards || []).some(
                                      (la) => la.docId === doc.id,
                                    ),
                                )
                                .map((doc) => (
                                  <button
                                    key={doc.id}
                                    type="button"
                                    className="artifact-chip"
                                    onClick={(e) =>
                                      e.shiftKey
                                        ? setSplitWorkspaceId(doc.id)
                                        : setActiveWorkspaceId(doc.id)
                                    }
                                    title={t("sdlc.tasks.openLinkedSurfaceTitle", {
                                      title: doc.name,
                                    })}
                                  >
                                    <span className="chip-icon">
                                      {getDocumentIcon(doc)}
                                    </span>
                                    <span className="chip-text">{doc.name}</span>
                                  </button>
                                ))}

                              {(task.linkedSketchRefs || []).map((sr, idx) => (
                                <button
                                  key={`${sr.docId}_${idx}`}
                                  type="button"
                                  className="artifact-chip"
                                  onClick={(e) =>
                                    requestSketchFocus(
                                      sr.docId,
                                      sr.elementIds,
                                      e.shiftKey,
                                    )
                                  }
                                  title={t("sdlc.tasks.focusElementOnCanvas")}
                                >
                                  <span className="chip-icon">
                                    {ArchitectureIcon}
                                  </span>
                                  <span className="chip-text">{sr.label}</span>
                                </button>
                              ))}

                              {(task.linkedArtboards || []).map((la) => (
                                <button
                                  key={`${la.docId}_${la.artboardId}`}
                                  type="button"
                                  className="artifact-chip artifact-chip--artboard"
                                  onClick={(e) =>
                                    requestArtboardFocus(
                                      la.docId,
                                      la.artboardId,
                                      e.shiftKey,
                                    )
                                  }
                                  title={t("sdlc.tdd.openLinkedArtboardTitle", {
                                    name: la.label,
                                  })}
                                >
                                  <span className="chip-icon">
                                    {frameToolIcon}
                                  </span>
                                  <span className="chip-text">
                                    {la.label}
                                  </span>
                                </button>
                              ))}

                              {taskScenarios.length > 0 && (
                                <button
                                  type="button"
                                  className={`artifact-chip ${
                                    greenCount === taskScenarios.length
                                      ? "artifact-chip--green"
                                      : "artifact-chip--red"
                                  }`}
                                  onClick={() => {
                                    const tddDoc = docs.find(
                                      (d) => d.canvasType === "tdd",
                                    );
                                    if (tddDoc) setActiveWorkspaceId(tddDoc.id);
                                  }}
                                  title={t("sdlc.tasks.tddScenariosLabel", {
                                    count: taskScenarios.length,
                                  })}
                                >
                                  <span className="chip-icon">{TDDTestIcon}</span>
                                  <span>
                                    TDD {greenCount}/{taskScenarios.length}
                                  </span>
                                </button>
                              )}
                            </div>
                          )}

                          <div className="task-card-footer">
                            {assignee ? (
                              <span
                                className={`assignee-badge assignee-badge--${assignee.kind}`}
                              >
                                <span
                                  className="avatar-dot"
                                  style={{
                                    backgroundColor: assignee.avatarColor,
                                  }}
                                >
                                  {assignee.kind === "ai_agent" ? "AI" : "U"}
                                </span>
                                <span className="assignee-name">
                                  {assignee.name}
                                </span>
                              </span>
                            ) : (
                              <span className="assignee-unassigned">
                                {t("sdlc.common.unassigned")}
                              </span>
                            )}

                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {assignee?.kind === "ai_agent" && (
                                <button
                                  type="button"
                                  className="artifact-chip"
                                  style={{
                                    background:
                                      "var(--color-surface-primary-container)",
                                    color:
                                      "var(--color-on-primary-container)",
                                    fontWeight: 700,
                                  }}
                                  onClick={async () => {
                                    const res = await runLiveAgentPipeline(
                                      task.id,
                                      "auto",
                                    );
                                    showToast(res.summary);
                                  }}
                                  title={assignee.name}
                                >
                                  <span className="chip-icon">{brainIcon}</span>
                                  <span>{t("sdlc.common.run")}</span>
                                </button>
                              )}
                              {task.acceptanceCriteria.length > 0 && (
                                <span
                                  className="criteria-progress"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 3,
                                  }}
                                >
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      width: 11,
                                      height: 11,
                                    }}
                                  >
                                    {checkIcon}
                                  </span>
                                  <span>
                                    {doneCriteria}/
                                    {task.acceptanceCriteria.length}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="sdlc-list-view Island">
            <table className="sdlc-table">
              <thead>
                <tr>
                  <th>{t("sdlc.tasks.thKey")}</th>
                  <th>{t("sdlc.tasks.thTitle")}</th>
                  <th>{t("sdlc.tasks.thStatus")}</th>
                  <th>{t("sdlc.tasks.thPriority")}</th>
                  <th>{t("sdlc.tasks.thAssignee")}</th>
                  <th>{t("sdlc.tasks.thLinks")}</th>
                  <th>TDD</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.map((task) => {
                  const assignee = team.find((m) => m.id === task.assigneeId);
                  const linkedDocs = docs.filter((d) =>
                    task.linkedDocIds.includes(d.id),
                  );
                  const taskScenarios = scenarios.filter(
                    (s) => s.linkedTaskId === task.id,
                  );
                  const greenCount = taskScenarios.filter(
                    (s) => s.status === "green" || s.status === "refactor",
                  ).length;

                  return (
                    <tr
                      key={task.id}
                      className={
                        selectedTaskId === task.id ? "row--selected" : ""
                      }
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <td className="td-key">{task.key}</td>
                      <td className="td-title">{task.title}</td>
                      <td>
                        <select
                          className="inline-status-select"
                          value={task.status}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) =>
                            updateProjectTask(task.id, {
                              status: e.target.value as TaskStatus,
                            })
                          }
                        >
                          {COLUMNS.map((c) => (
                            <option key={c.status} value={c.status}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <span
                          className={`priority-pill priority-pill--${task.priority}`}
                        >
                          {PRIORITY_LABELS[task.priority]}
                        </span>
                      </td>
                      <td>
                        {assignee ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                          >
                            <span
                              style={{
                                display: "inline-flex",
                                width: 13,
                                height: 13,
                              }}
                            >
                              {assignee.kind === "ai_agent"
                                ? brainIcon
                                : usersIcon}
                            </span>
                            <span>{assignee.name}</span>
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <div
                          className="table-chips"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {linkedDocs
                            .filter(
                              (doc) =>
                                doc.canvasType !== "design" ||
                                !(task.linkedArtboards || []).some(
                                  (la) => la.docId === doc.id,
                                ),
                            )
                            .map((doc) => (
                              <button
                                key={doc.id}
                                type="button"
                                className="artifact-chip"
                                onClick={() => setActiveWorkspaceId(doc.id)}
                              >
                                <span className="chip-icon">
                                  {getDocumentIcon(doc)}
                                </span>
                                <span className="chip-text">{doc.name}</span>
                              </button>
                            ))}
                          {(task.linkedArtboards || []).map((la) => (
                            <button
                              key={`${la.docId}_${la.artboardId}`}
                              type="button"
                              className="artifact-chip artifact-chip--artboard"
                              onClick={() =>
                                requestArtboardFocus(
                                  la.docId,
                                  la.artboardId,
                                  false,
                                )
                              }
                            >
                              <span className="chip-icon">{frameToolIcon}</span>
                              <span className="chip-text">{la.label}</span>
                            </button>
                          ))}
                        </div>
                      </td>
                      <td>
                        {taskScenarios.length > 0
                          ? `${greenCount}/${taskScenarios.length} Green`
                          : "Test Yok"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Right Task Detail & Cross-Artifact Coordination Drawer */}
        {selectedTask && (() => {
          const selectedTaskScenarios = scenarios.filter(
            (s) => s.linkedTaskId === selectedTask.id,
          );
          const sketchDocs = docs.filter((d) => d.canvasType === "sketch");
          const designDocs = docs.filter((d) => d.canvasType === "design");
          const tddDoc = docs.find((d) => d.canvasType === "tdd");
          const linkedSketchCount = sketchDocs.filter((d) =>
            selectedTask.linkedDocIds.includes(d.id),
          ).length + (selectedTask.linkedSketchRefs || []).length;
          const linkedArtboardCount = (selectedTask.linkedArtboards || []).length;
          const totalTraceabilityCount =
            linkedSketchCount + linkedArtboardCount + selectedTaskScenarios.length;
          const doneCritCount = selectedTask.acceptanceCriteria.filter(
            (c) => c.completed,
          ).length;

          return (
            <aside className="sdlc-detail-drawer Island">
              <div className="detail-drawer-header">
                <div className="header-left">
                  <span className="task-key">{selectedTask.key}</span>
                  <select
                    className="detail-status-select"
                    value={selectedTask.status}
                    onChange={(e) =>
                      updateProjectTask(selectedTask.id, {
                        status: e.target.value as TaskStatus,
                      })
                    }
                  >
                    {COLUMNS.map((c) => (
                      <option key={c.status} value={c.status}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="header-actions">
                  <button
                    type="button"
                    className="detail-icon-btn detail-icon-btn--danger"
                    title={t("sdlc.tasks.deleteTaskBtn")}
                    onClick={() => {
                      deleteProjectTask(selectedTask.id);
                      setSelectedTaskId(null);
                    }}
                  >
                    {TrashIcon}
                  </button>
                  <button
                    type="button"
                    className="detail-icon-btn"
                    title={t("sdlc.common.close")}
                    onClick={() => setSelectedTaskId(null)}
                  >
                    {CloseIcon}
                  </button>
                </div>
              </div>

              {/* Clean Segmented Inspector Tabs */}
              <div className="detail-drawer-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === "overview"}
                  className={`detail-tab-btn ${
                    inspectorTab === "overview" ? "detail-tab-btn--active" : ""
                  }`}
                  onClick={() => setInspectorTab("overview")}
                >
                  <span>{t("sdlc.tasks.tabOverview")}</span>
                  <span className="detail-tab-badge">
                    {doneCritCount}/{selectedTask.acceptanceCriteria.length}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === "traceability"}
                  className={`detail-tab-btn ${
                    inspectorTab === "traceability"
                      ? "detail-tab-btn--active"
                      : ""
                  }`}
                  onClick={() => setInspectorTab("traceability")}
                >
                  <span>{t("sdlc.tasks.tabTraceability")}</span>
                  <span className="detail-tab-badge">
                    {totalTraceabilityCount}
                  </span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === "agent"}
                  className={`detail-tab-btn ${
                    inspectorTab === "agent" ? "detail-tab-btn--active" : ""
                  }`}
                  onClick={() => setInspectorTab("agent")}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      width: 13,
                      height: 13,
                    }}
                  >
                    {brainIcon}
                  </span>
                  <span>{t("sdlc.tasks.tabAgent")}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={inspectorTab === "activity"}
                  className={`detail-tab-btn ${
                    inspectorTab === "activity" ? "detail-tab-btn--active" : ""
                  }`}
                  onClick={() => setInspectorTab("activity")}
                >
                  <span>{t("sdlc.tasks.tabActivity")}</span>
                  {selectedTask.comments.length > 0 && (
                    <span className="detail-tab-badge">
                      {selectedTask.comments.length}
                    </span>
                  )}
                </button>
              </div>

              <div className="detail-drawer-body">
                {/* TAB 1: OVERVIEW & ACCEPTANCE CRITERIA */}
                {inspectorTab === "overview" && (
                  <>
                    <div className="detail-section">
                      <label className="detail-label">
                        {t("sdlc.tasks.descriptionLabel")}
                      </label>
                      <input
                        type="text"
                        className="detail-input"
                        value={selectedTask.title}
                        onChange={(e) =>
                          updateProjectTask(selectedTask.id, {
                            title: e.target.value,
                          })
                        }
                      />
                      <textarea
                        className="detail-textarea"
                        rows={3}
                        placeholder={t(
                          "sdlc.tasks.descriptionModalPlaceholder",
                        )}
                        value={selectedTask.description}
                        onChange={(e) =>
                          updateProjectTask(selectedTask.id, {
                            description: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="detail-grid-2">
                      <div className="detail-section">
                        <label className="detail-label">
                          {t("sdlc.tasks.assigneeLabel")}
                        </label>
                        <select
                          className="detail-select"
                          value={selectedTask.assigneeId || ""}
                          onChange={(e) =>
                            updateProjectTask(selectedTask.id, {
                              assigneeId: e.target.value || null,
                            })
                          }
                        >
                          <option value="">{t("sdlc.common.unassigned")}</option>
                          {team.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.kind === "ai_agent" ? "[AI] " : ""}
                              {m.name} ({m.roleLabel})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="detail-section">
                        <label className="detail-label">
                          {t("sdlc.tasks.priorityLabel")}
                        </label>
                        <select
                          className="detail-select"
                          value={selectedTask.priority}
                          onChange={(e) =>
                            updateProjectTask(selectedTask.id, {
                              priority: e.target.value as TaskPriority,
                            })
                          }
                        >
                          <option value="low">
                            {t("sdlc.tasks.priorityLow")}
                          </option>
                          <option value="medium">
                            {t("sdlc.tasks.priorityMedium")}
                          </option>
                          <option value="high">
                            {t("sdlc.tasks.priorityHigh")}
                          </option>
                          <option value="critical">
                            {t("sdlc.tasks.priorityCritical")}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div className="detail-section">
                      <div className="detail-section-header">
                        <label className="detail-label">
                          {t("sdlc.tasks.acceptanceCriteriaTitle", {
                            done: doneCritCount,
                            total: selectedTask.acceptanceCriteria.length,
                          })}
                        </label>
                        <button
                          type="button"
                          className="detail-mini-btn"
                          onClick={() => handleGenerateTDD(selectedTask)}
                          title={t("sdlc.tasks.generateTddWithAgent")}
                        >
                          {TDDTestIcon}
                          <span>{t("sdlc.tasks.generateTddWithAgent")}</span>
                        </button>
                      </div>

                      <div className="criteria-list">
                        {selectedTask.acceptanceCriteria.map((crit) => (
                          <label key={crit.id} className="criterion-item">
                            <input
                              type="checkbox"
                              checked={crit.completed}
                              onChange={() =>
                                handleToggleCriterion(selectedTask, crit.id)
                              }
                            />
                            <span className={crit.completed ? "crit-done" : ""}>
                              {crit.text}
                            </span>
                          </label>
                        ))}
                      </div>

                      <form
                        className="detail-inline-form"
                        onSubmit={handleAddCriterion}
                      >
                        <input
                          type="text"
                          className="detail-input"
                          placeholder={t("sdlc.tasks.addCriterionPlaceholder")}
                          value={newCriterionInput}
                          onChange={(e) => setNewCriterionInput(e.target.value)}
                        />
                        <button type="submit" className="detail-add-btn">
                          {t("sdlc.common.add")}
                        </button>
                      </form>
                    </div>
                  </>
                )}

                {/* TAB 2: END-TO-END TRACEABILITY (ANALYSIS CANVASES + ARTBOARD-LEVEL DESIGN + TDD) */}
                {inspectorTab === "traceability" && (
                  <>
                    {/* A. Analysis & Architecture Canvases (Canvas-Level) */}
                    <div className="detail-section">
                      <label className="detail-label">
                        {t("sdlc.tasks.analysisCanvasesSection")}
                      </label>
                      <div className="linked-docs-list">
                        {sketchDocs.map((doc) => {
                          const isLinked = selectedTask.linkedDocIds.includes(
                            doc.id,
                          );
                          return (
                            <div
                              key={doc.id}
                              className={`linked-doc-row ${
                                isLinked ? "linked-doc-row--active" : ""
                              }`}
                            >
                              <label className="doc-check-label">
                                <input
                                  type="checkbox"
                                  checked={isLinked}
                                  onChange={() =>
                                    handleToggleDocLink(selectedTask, doc.id)
                                  }
                                />
                                <span className="doc-icon">
                                  {getDocumentIcon(doc)}
                                </span>
                                <span className="doc-name">{doc.name}</span>
                                <span className="doc-cat">
                                  {getCategoryLabel(doc.category)}
                                </span>
                              </label>
                              <div className="doc-jump-actions">
                                <button
                                  type="button"
                                  className="jump-btn"
                                  onClick={() => setActiveWorkspaceId(doc.id)}
                                  title={t("sdlc.common.open")}
                                >
                                  {t("sdlc.common.open")}
                                </button>
                                <button
                                  type="button"
                                  className="jump-btn"
                                  onClick={() => setSplitWorkspaceId(doc.id)}
                                  title={t("sdlc.common.openInSplitView")}
                                >
                                  {SplitViewIcon}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {(selectedTask.linkedSketchRefs || []).length > 0 && (
                        <div
                          className="linked-docs-list"
                          style={{ marginTop: 6 }}
                        >
                          {(selectedTask.linkedSketchRefs || []).map(
                            (sr, idx) => (
                              <div
                                key={`${sr.docId}_${idx}`}
                                className="linked-doc-row linked-doc-row--active"
                              >
                                <div className="doc-check-label">
                                  <span className="doc-icon">{PinIcon}</span>
                                  <span className="doc-name">{sr.label}</span>
                                </div>
                                <div className="doc-jump-actions">
                                  <button
                                    type="button"
                                    className="jump-btn"
                                    onClick={() =>
                                      requestSketchFocus(
                                        sr.docId,
                                        sr.elementIds,
                                        false,
                                      )
                                    }
                                    title={t("sdlc.tasks.focusElementOnCanvas")}
                                  >
                                    {t("sdlc.common.focus")}
                                  </button>
                                  <button
                                    type="button"
                                    className="jump-btn"
                                    onClick={() =>
                                      requestSketchFocus(
                                        sr.docId,
                                        sr.elementIds,
                                        true,
                                      )
                                    }
                                    title={t("sdlc.common.openInSplitView")}
                                  >
                                    {SplitViewIcon}
                                  </button>
                                </div>
                              </div>
                            ),
                          )}
                        </div>
                      )}
                    </div>

                    {/* B. UI Design Canvases — Artboard-Level Granular Traceability */}
                    <div className="detail-section">
                      <div className="detail-section-header">
                        <label className="detail-label">
                          {t("sdlc.tasks.designArtboardsSection")}
                        </label>
                      </div>
                      <p className="detail-traceability-hint">
                        {t("sdlc.tasks.designArtboardsHint")}
                      </p>

                      <div className="design-artboard-groups">
                        {designDocs.map((designDoc) => {
                          const docArtboards =
                            designArtboardsByDoc[designDoc.id] || [];
                          const linkedCountForDoc = (
                            selectedTask.linkedArtboards || []
                          ).filter((la) => la.docId === designDoc.id).length;

                          return (
                            <div
                              key={designDoc.id}
                              className="design-artboard-group-card"
                            >
                              <div className="design-group-header">
                                <div className="design-group-title">
                                  <span className="doc-icon">
                                    {frameToolIcon}
                                  </span>
                                  <span>{designDoc.name}</span>
                                  {linkedCountForDoc > 0 && (
                                    <span className="detail-count-badge">
                                      {linkedCountForDoc} Artboard
                                    </span>
                                  )}
                                </div>
                                <div className="doc-jump-actions">
                                  <button
                                    type="button"
                                    className="detail-mini-btn"
                                    onClick={() => {
                                      const ownerWin =
                                        rootRef.current?.ownerDocument
                                          ?.defaultView || undefined;
                                      const createdAb =
                                        createArtboardInDesignDoc(
                                          designDoc.id,
                                          designDoc.name,
                                          `${selectedTask.key}: ${selectedTask.title.slice(
                                            0,
                                            26,
                                          )}`,
                                          "desktop",
                                          ownerWin,
                                        );
                                      toggleTaskArtboardLink(selectedTask.id, {
                                        docId: designDoc.id,
                                        artboardId: createdAb.id,
                                        label: createdAb.name,
                                      });
                                      showToast(
                                        t(
                                          "sdlc.tasks.artboardCreatedAndLinkedToast",
                                          { name: createdAb.name },
                                        ),
                                      );
                                    }}
                                  >
                                    <span>
                                      {t("sdlc.tasks.createAndLinkArtboardBtn")}
                                    </span>
                                  </button>
                                </div>
                              </div>

                              {docArtboards.length === 0 ? (
                                <div className="design-group-empty">
                                  {t("sdlc.tasks.noArtboardsInCanvas")}
                                </div>
                              ) : (
                                <div className="linked-docs-list">
                                  {docArtboards.map((ab) => {
                                    const isAbLinked = (
                                      selectedTask.linkedArtboards || []
                                    ).some(
                                      (la) =>
                                        la.docId === designDoc.id &&
                                        la.artboardId === ab.id,
                                    );
                                    const dimLabel =
                                      typeof ab.width === "number" &&
                                      typeof ab.height === "number"
                                        ? `${ab.width}×${ab.height}`
                                        : "Hug";

                                    return (
                                      <div
                                        key={ab.id}
                                        className={`linked-doc-row ${
                                          isAbLinked
                                            ? "linked-doc-row--active"
                                            : ""
                                        }`}
                                      >
                                        <label className="doc-check-label">
                                          <input
                                            type="checkbox"
                                            checked={isAbLinked}
                                            onChange={() =>
                                              toggleTaskArtboardLink(
                                                selectedTask.id,
                                                {
                                                  docId: designDoc.id,
                                                  artboardId: ab.id,
                                                  label: ab.name,
                                                },
                                              )
                                            }
                                          />
                                          <span className="doc-icon">
                                            {frameToolIcon}
                                          </span>
                                          <span
                                            className="doc-name"
                                            title={ab.name}
                                          >
                                            {ab.name}
                                          </span>
                                          <span className="doc-cat">
                                            {dimLabel}
                                          </span>
                                        </label>
                                        <div className="doc-jump-actions">
                                          <button
                                            type="button"
                                            className="jump-btn"
                                            onClick={() =>
                                              requestArtboardFocus(
                                                designDoc.id,
                                                ab.id,
                                                false,
                                              )
                                            }
                                            title={t("sdlc.common.focus")}
                                          >
                                            {t("sdlc.common.focus")}
                                          </button>
                                          <button
                                            type="button"
                                            className="jump-btn"
                                            onClick={() =>
                                              requestArtboardFocus(
                                                designDoc.id,
                                                ab.id,
                                                true,
                                              )
                                            }
                                            title={t(
                                              "sdlc.common.openInSplitView",
                                            )}
                                          >
                                            {SplitViewIcon}
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* C. Linked TDD Test Scenarios */}
                    <div className="detail-section">
                      <div className="detail-section-header">
                        <label className="detail-label">
                          {t("sdlc.tasks.relatedTddSectionTitle", {
                            count: selectedTaskScenarios.length,
                          })}
                        </label>
                        <button
                          type="button"
                          className="detail-mini-btn"
                          onClick={() => handleGenerateTDD(selectedTask)}
                        >
                          {TDDTestIcon}
                          <span>{t("sdlc.tasks.generateTddWithAgent")}</span>
                        </button>
                      </div>

                      {selectedTaskScenarios.length === 0 ? (
                        <div className="design-group-empty">
                          {t("sdlc.tasks.noLinkedTddForTask")}
                        </div>
                      ) : (
                        <div className="linked-docs-list">
                          {selectedTaskScenarios.map((sc) => {
                            const passedCount = sc.assertions.filter(
                              (a) => a.passed,
                            ).length;
                            const isGreen =
                              sc.status === "green" || sc.status === "refactor";
                            return (
                              <div
                                key={sc.id}
                                className="linked-doc-row linked-doc-row--active"
                              >
                                <div className="doc-check-label">
                                  <span
                                    className="tdd-key"
                                    style={{
                                      background: isGreen
                                        ? "rgba(12, 166, 120, 0.16)"
                                        : "rgba(224, 49, 49, 0.15)",
                                      color: isGreen ? "#099268" : "#c92a2a",
                                    }}
                                  >
                                    {sc.key}
                                  </span>
                                  <span className="doc-name" title={sc.title}>
                                    {sc.title}
                                  </span>
                                  <span className="doc-cat">
                                    {passedCount}/{sc.assertions.length}
                                  </span>
                                </div>
                                {tddDoc && (
                                  <div className="doc-jump-actions">
                                    <button
                                      type="button"
                                      className="jump-btn"
                                      onClick={() =>
                                        setActiveWorkspaceId(tddDoc.id)
                                      }
                                    >
                                      {t("sdlc.common.open")}
                                    </button>
                                    <button
                                      type="button"
                                      className="jump-btn"
                                      onClick={() =>
                                        setSplitWorkspaceId(tddDoc.id)
                                      }
                                      title={t("sdlc.common.openInSplitView")}
                                    >
                                      {SplitViewIcon}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* TAB 3: AI AGENT ORCHESTRATION */}
                {inspectorTab === "agent" && (
                  <div className="detail-section">
                    <label className="detail-label">
                      {t("sdlc.tasks.aiOrchestrationSection", {
                        name:
                          team.find((m) => m.id === selectedTask.assigneeId)
                            ?.name || "AI Agent",
                      })}
                    </label>
                    <button
                      type="button"
                      className="ai-orchestrate-btn"
                      onClick={async () => {
                        const res = await runLiveAgentPipeline(
                          selectedTask.id,
                          "auto",
                        );
                        showToast(res.summary);
                      }}
                    >
                      {brainIcon}
                      <span>
                        {t("sdlc.tasks.dispatchTaskToAgent", {
                          name:
                            team.find((m) => m.id === selectedTask.assigneeId)
                              ?.name || "AI Agent",
                          model: "Auto",
                        })}
                      </span>
                    </button>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(2, 1fr)",
                        gap: 6,
                        marginTop: 6,
                      }}
                    >
                      <button
                        type="button"
                        className="detail-mini-btn"
                        style={{ justifyContent: "center", padding: "7px 8px" }}
                        onClick={async () => {
                          const res = await runLiveAgentPipeline(
                            selectedTask.id,
                            "architecture",
                          );
                          showToast(res.summary);
                        }}
                        title={t("sdlc.categories.architecture")}
                      >
                        {ArchitectureIcon}
                        <span>{t("sdlc.categories.architecture")}</span>
                      </button>
                      <button
                        type="button"
                        className="detail-mini-btn"
                        style={{ justifyContent: "center", padding: "7px 8px" }}
                        onClick={async () => {
                          const res = await runLiveAgentPipeline(
                            selectedTask.id,
                            "design",
                          );
                          showToast(res.summary);
                        }}
                        title={t("sdlc.categories.ui_design")}
                      >
                        {frameToolIcon}
                        <span>{t("sdlc.categories.ui_design")}</span>
                      </button>
                      <button
                        type="button"
                        className="detail-mini-btn"
                        style={{ justifyContent: "center", padding: "7px 8px" }}
                        onClick={async () => {
                          const res = await runLiveAgentPipeline(
                            selectedTask.id,
                            "tdd",
                          );
                          showToast(res.summary);
                        }}
                        title={t("sdlc.categories.tdd_suite")}
                      >
                        {TDDTestIcon}
                        <span>{t("sdlc.categories.tdd_suite")}</span>
                      </button>
                      <button
                        type="button"
                        className="detail-mini-btn"
                        style={{ justifyContent: "center", padding: "7px 8px" }}
                        onClick={async () => {
                          const res = await runLiveAgentPipeline(
                            selectedTask.id,
                            "analysis",
                          );
                          showToast(res.summary);
                        }}
                        title={t("sdlc.categories.analysis")}
                      >
                        {FreedrawIcon}
                        <span>{t("sdlc.categories.analysis")}</span>
                      </button>
                    </div>
                    {onOpenAIIntegrations && (
                      <button
                        type="button"
                        className="detail-mini-btn"
                        style={{
                          width: "100%",
                          justifyContent: "center",
                          marginTop: 6,
                          padding: "7px 8px",
                        }}
                        onClick={onOpenAIIntegrations}
                      >
                        {settingsIcon}
                        <span>{t("sdlc.common.aiStudio")}</span>
                      </button>
                    )}
                  </div>
                )}

                {/* TAB 4: TEAM & AGENT COORDINATION COMMENTS */}
                {inspectorTab === "activity" && (
                  <div className="detail-section">
                    <label className="detail-label">
                      {t("sdlc.tasks.activityLogSection", {
                        count: selectedTask.comments.length,
                      })}
                    </label>
                    <div className="comments-list">
                      {selectedTask.comments.length === 0 ? (
                        <div className="design-group-empty">
                          {t("sdlc.tasks.noCommentsYet")}
                        </div>
                      ) : (
                        selectedTask.comments.map((cmt) => {
                          const author = team.find(
                            (m) => m.id === cmt.authorId,
                          );
                          return (
                            <div key={cmt.id} className="comment-card">
                              <div className="comment-meta">
                                <strong
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                  }}
                                >
                                  {author && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        width: 12,
                                        height: 12,
                                      }}
                                    >
                                      {author.kind === "ai_agent"
                                        ? brainIcon
                                        : usersIcon}
                                    </span>
                                  )}
                                  <span>{author ? author.name : "Team"}</span>
                                </strong>
                                <span>
                                  {new Date(cmt.createdAt).toLocaleTimeString(
                                    [],
                                    {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )}
                                </span>
                              </div>
                              <p>{cmt.text}</p>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <form className="comment-form" onSubmit={handleAddComment}>
                      <select
                        className="detail-select"
                        value={commentAuthorId}
                        onChange={(e) => setCommentAuthorId(e.target.value)}
                      >
                        {team.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.kind === "ai_agent" ? "[AI] " : ""}
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <div className="detail-inline-form">
                        <input
                          type="text"
                          className="detail-input"
                          placeholder={t("sdlc.tasks.addCommentPlaceholder")}
                          value={commentInput}
                          onChange={(e) => setCommentInput(e.target.value)}
                        />
                        <button type="submit" className="detail-add-btn">
                          {t("sdlc.tasks.postBtn")}
                        </button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </aside>
          );
        })()}
      </div>

      {/* Create New Task Modal */}
      {isCreateOpen && (
        <div
          className="new-workspace-modal-overlay"
          onClick={() => setIsCreateOpen(false)}
        >
          <div
            className="new-workspace-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="new-workspace-modal__header">
              <h3>{t("sdlc.tasks.createModalTitle")}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateOpen(false)}
              >
                {CloseIcon}
              </button>
            </div>
            <form onSubmit={handleCreateTask}>
              <div className="new-workspace-modal__body">
                <div className="form-group">
                  <label>{t("sdlc.tasks.taskTitleLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("sdlc.tasks.taskTitlePlaceholder")}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>{t("sdlc.tasks.descriptionModalLabel")}</label>
                  <textarea
                    className="sdlc-modal-textarea"
                    rows={2}
                    placeholder={t("sdlc.tasks.descriptionModalPlaceholder")}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>

                <div className="sdlc-modal-grid-3">
                  <div className="form-group">
                    <label>{t("sdlc.tasks.statusLabel")}</label>
                    <select
                      className="sdlc-modal-select"
                      value={newStatus}
                      onChange={(e) =>
                        setNewStatus(e.target.value as TaskStatus)
                      }
                    >
                      {COLUMNS.map((c) => (
                        <option key={c.status} value={c.status}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t("sdlc.tasks.priorityLabel")}</label>
                    <select
                      className="sdlc-modal-select"
                      value={newPriority}
                      onChange={(e) =>
                        setNewPriority(e.target.value as TaskPriority)
                      }
                    >
                      <option value="low">{t("sdlc.tasks.priorityLow")}</option>
                      <option value="medium">
                        {t("sdlc.tasks.priorityMedium")}
                      </option>
                      <option value="high">
                        {t("sdlc.tasks.priorityHigh")}
                      </option>
                      <option value="critical">
                        {t("sdlc.tasks.priorityCritical")}
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t("sdlc.tasks.assigneeLabel")}</label>
                    <select
                      className="sdlc-modal-select"
                      value={newAssigneeId}
                      onChange={(e) => setNewAssigneeId(e.target.value)}
                    >
                      <option value="">{t("sdlc.common.unassigned")}</option>
                      {team.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.kind === "ai_agent" ? "[AI] " : ""}
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>{t("sdlc.tasks.addCriterionPlaceholder")}</label>
                  <textarea
                    className="sdlc-modal-textarea"
                    rows={3}
                    placeholder={t("sdlc.tasks.addCriterionPlaceholder")}
                    value={newCriteriaText}
                    onChange={(e) => setNewCriteriaText(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>{t("sdlc.tasks.analysisCanvasesSection")}</label>
                  <div className="sdlc-doc-Checkgrid">
                    {docs
                      .filter((d) => d.canvasType === "sketch")
                      .map((doc) => {
                        const checked = newLinkedDocs.includes(doc.id);
                        return (
                          <label key={doc.id} className="doc-check-pill">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() =>
                                setNewLinkedDocs((prev) =>
                                  checked
                                    ? prev.filter((id) => id !== doc.id)
                                    : [...prev, doc.id],
                                )
                              }
                            />
                            <span>{doc.name}</span>
                          </label>
                        );
                      })}
                  </div>
                </div>

                <div className="form-group">
                  <label>{t("sdlc.tasks.designArtboardsSection")}</label>
                  <div className="sdlc-doc-Checkgrid">
                    {docs
                      .filter((d) => d.canvasType === "design")
                      .flatMap((designDoc) =>
                        (designArtboardsByDoc[designDoc.id] || []).map((ab) => {
                          const checked = newLinkedArtboards.some(
                            (la) =>
                              la.docId === designDoc.id &&
                              la.artboardId === ab.id,
                          );
                          return (
                            <label
                              key={`${designDoc.id}_${ab.id}`}
                              className="doc-check-pill"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() =>
                                  setNewLinkedArtboards((prev) =>
                                    checked
                                      ? prev.filter(
                                          (item) =>
                                            !(
                                              item.docId === designDoc.id &&
                                              item.artboardId === ab.id
                                            ),
                                        )
                                      : [
                                          ...prev,
                                          {
                                            docId: designDoc.id,
                                            artboardId: ab.id,
                                            label: ab.name,
                                          },
                                        ],
                                  )
                                }
                              />
                              <span>
                                {ab.name} ({designDoc.name})
                              </span>
                            </label>
                          );
                        }),
                      )}
                  </div>
                </div>
              </div>
              <div className="new-workspace-modal__footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  {t("sdlc.common.cancel")}
                </button>
                <button type="submit" className="btn-primary">
                  {t("sdlc.tasks.createTaskSubmit")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toastMsg && (
        <div className="sdlc-toast Island">
          {checkIcon}
          <span>{toastMsg}</span>
        </div>
      )}
    </div>
  );
};
