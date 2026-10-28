import React, { useEffect, useState } from "react";
import {
  PlusIcon,
  CloseIcon,
  TrashIcon,
  brainIcon,
  searchIcon,
  checkIcon,
} from "@excalidraw/excalidraw/components/icons";
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
} from "../workspace/workspaceStore";
import {
  getDocumentIcon,
  SplitViewIcon,
  TDDTestIcon,
} from "../workspace/WorkspaceTabs";
import "./sdlc.scss";

interface TaskBoardSurfaceProps {
  documentId: string;
  documentName: string;
  onOpenAIIntegrations?: () => void;
  compact?: boolean;
}

const COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: "backlog", label: "Backlog & Analiz" },
  { status: "design", label: "Tasarım & Mimari" },
  { status: "in_progress", label: "Geliştirmede" },
  { status: "testing", label: "TDD & Doğrulama" },
  { status: "done", label: "Tamamlandı" },
];

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
  critical: "Kritik",
};

export const TaskBoardSurface: React.FC<TaskBoardSurfaceProps> = ({
  onOpenAIIntegrations,
  compact = false,
}) => {
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

  // Detail panel state
  const [newCriterionInput, setNewCriterionInput] = useState("");
  const [commentInput, setCommentInput] = useState("");
  const [commentAuthorId, setCommentAuthorId] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  useEffect(() => {
    const sync = () => {
      const tList = getProjectTasks();
      const sList = getProjectTDDScenarios();
      const mList = getProjectTeam();
      const dList = getWorkspaces();
      setTasks(tList);
      setScenarios(sList);
      setTeam(mList);
      setDocs(dList);
      if (!commentAuthorId && mList.length > 0) {
        setCommentAuthorId(mList[0].id);
      }
    };
    sync();
    return subscribeWorkspaces(sync);
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
    <div className="sdlc-surface-root">
      {/* Top Excalidraw Island Toolbar */}
      <div className="sdlc-top-island Island" role="toolbar">
        <div className="sdlc-segmented">
          <button
            type="button"
            className={`seg-btn ${viewMode === "kanban" ? "seg-btn--active" : ""}`}
            onClick={() => setViewMode("kanban")}
          >
            Kanban Panosu
          </button>
          <button
            type="button"
            className={`seg-btn ${viewMode === "list" ? "seg-btn--active" : ""}`}
            onClick={() => setViewMode("list")}
          >
            Liste Görünümü
          </button>
        </div>

        <div className="sdlc-island-divider" />

        <select
          className="sdlc-toolbar-select"
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          title="Sorumlu / Agent Filtresi"
        >
          <option value="all">Tüm Ekip ({tasks.length})</option>
          <option value="humans">👤 İnsan Ekip Üyeleri</option>
          <option value="agents">🤖 AI Agent Kadrosu</option>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.kind === "ai_agent" ? "🤖 " : "👤 "}
              {m.name}
            </option>
          ))}
        </select>

        {!compact && (
          <div className="sdlc-toolbar-search">
            <span className="search-icon">{searchIcon}</span>
            <input
              type="text"
              placeholder="Görevlerde ara..."
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
          <span>Yeni Görev</span>
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
                <div key={col.status} className="sdlc-kanban-column">
                  <div className="kanban-column-header">
                    <span className="col-title">{col.label}</span>
                    <span className="col-count">{colTasks.length}</span>
                    <button
                      type="button"
                      className="col-add-btn"
                      onClick={() => handleOpenCreate(col.status)}
                      title={`${col.label} sütununa görev ekle`}
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
                              {linkedDocs.map((doc) => (
                                <button
                                  key={doc.id}
                                  type="button"
                                  className="artifact-chip"
                                  onClick={() => setActiveWorkspaceId(doc.id)}
                                  title={`${doc.name} (${getCategoryLabel(
                                    doc.category,
                                  )}) yüzeyine git`}
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
                                  onClick={() =>
                                    requestSketchFocus(
                                      sr.docId,
                                      sr.elementIds,
                                      true,
                                    )
                                  }
                                  title={`"${sr.label}" çizim akışını yan yana (Split-Peek) aç ve odaklan`}
                                >
                                  <span className="chip-icon">📐</span>
                                  <span className="chip-text">{sr.label}</span>
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
                                      true,
                                    )
                                  }
                                  title={`"${la.label}" Artboard'unu yan yana (Split-Peek) aç ve odaklan`}
                                >
                                  <span className="chip-icon">🎨</span>
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
                                  title="Bağlı TDD Test Senaryolarını görüntüle"
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
                                  {assignee.kind === "ai_agent" ? "AI" : "Ü"}
                                </span>
                                <span className="assignee-name">
                                  {assignee.name}
                                </span>
                              </span>
                            ) : (
                              <span className="assignee-unassigned">
                                Atanmadı
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
                                  onClick={() => {
                                    const res = executeAgentOnTask(
                                      task.id,
                                      "auto",
                                    );
                                    showToast(`🤖 ${res.summary}`);
                                  }}
                                  title={`${assignee.name} ile bu görevi çalıştır`}
                                >
                                  <span>🤖 Çalıştır</span>
                                </button>
                              )}
                              {task.acceptanceCriteria.length > 0 && (
                                <span className="criteria-progress">
                                  ✓ {doneCriteria}/
                                  {task.acceptanceCriteria.length}
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
                  <th>Kod</th>
                  <th>Görev Başlığı</th>
                  <th>Durum</th>
                  <th>Öncelik</th>
                  <th>Sorumlu (İnsan / Agent)</th>
                  <th>Bağlı Yüzeyler</th>
                  <th>TDD Durumu</th>
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
                        {assignee
                          ? `${assignee.kind === "ai_agent" ? "🤖" : "👤"} ${
                              assignee.name
                            }`
                          : "—"}
                      </td>
                      <td>
                        <div
                          className="table-chips"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {linkedDocs.map((doc) => (
                            <button
                              key={doc.id}
                              type="button"
                              className="artifact-chip"
                              onClick={() => setActiveWorkspaceId(doc.id)}
                            >
                              {doc.name}
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
        {selectedTask && (
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
                  title="Görevi Sil"
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
                  title="Kapat"
                  onClick={() => setSelectedTaskId(null)}
                >
                  {CloseIcon}
                </button>
              </div>
            </div>

            <div className="detail-drawer-body">
              <div className="detail-section">
                <label className="detail-label">GÖREV BAŞLIĞI & AÇIKLAMA</label>
                <input
                  type="text"
                  className="detail-input"
                  value={selectedTask.title}
                  onChange={(e) =>
                    updateProjectTask(selectedTask.id, { title: e.target.value })
                  }
                />
                <textarea
                  className="detail-textarea"
                  rows={3}
                  placeholder="Görev kapsamı ve teknik notlar..."
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
                  <label className="detail-label">SORUMLU (İNSAN / AI AGENT)</label>
                  <select
                    className="detail-select"
                    value={selectedTask.assigneeId || ""}
                    onChange={(e) =>
                      updateProjectTask(selectedTask.id, {
                        assigneeId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">Atanmadı</option>
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.kind === "ai_agent" ? "🤖 " : "👤 "}
                        {m.name} ({m.roleLabel})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="detail-section">
                  <label className="detail-label">ÖNCELİK</label>
                  <select
                    className="detail-select"
                    value={selectedTask.priority}
                    onChange={(e) =>
                      updateProjectTask(selectedTask.id, {
                        priority: e.target.value as TaskPriority,
                      })
                    }
                  >
                    <option value="low">Düşük</option>
                    <option value="medium">Orta</option>
                    <option value="high">Yüksek</option>
                    <option value="critical">Kritik</option>
                  </select>
                </div>
              </div>

              {/* Acceptance Criteria */}
              <div className="detail-section">
                <div className="detail-section-header">
                  <label className="detail-label">
                    KABUL KRİTERLERİ ({selectedTask.acceptanceCriteria.filter((c) => c.completed).length}/
                    {selectedTask.acceptanceCriteria.length})
                  </label>
                  <button
                    type="button"
                    className="detail-mini-btn"
                    onClick={() => handleGenerateTDD(selectedTask)}
                    title="Kabul kriterlerinden otomatik TDD test senaryoları oluştur"
                  >
                    {TDDTestIcon}
                    <span>TDD Senaryoları Üret</span>
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
                      <span
                        className={crit.completed ? "crit-done" : ""}
                      >
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
                    placeholder="Yeni kabul kriteri ekle..."
                    value={newCriterionInput}
                    onChange={(e) => setNewCriterionInput(e.target.value)}
                  />
                  <button type="submit" className="detail-add-btn">
                    Ekle
                  </button>
                </form>
              </div>

              {/* Cross-Linked Canvases (Analysis, Architecture, UI Design) */}
              <div className="detail-section">
                <label className="detail-label">
                  BAĞLI ANALİZ, MİMARİ VE TASARIM YÜZEYLERİ
                </label>
                <div className="linked-docs-list">
                  {docs
                    .filter((d) => d.canvasType === "sketch" || d.canvasType === "design")
                    .map((doc) => {
                      const isLinked = selectedTask.linkedDocIds.includes(doc.id);
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
                          {isLinked && (
                            <div className="doc-jump-actions">
                              <button
                                type="button"
                                className="jump-btn"
                                onClick={() => setActiveWorkspaceId(doc.id)}
                                title="Bu yüzeye git"
                              >
                                Aç
                              </button>
                              <button
                                type="button"
                                className="jump-btn"
                                onClick={() => setSplitWorkspaceId(doc.id)}
                                title="Ekranı bölerek yan yana aç"
                              >
                                {SplitViewIcon}
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Linked Sketch Diagrams */}
              {(selectedTask.linkedSketchRefs || []).length > 0 && (
                <div className="detail-section">
                  <label className="detail-label">
                    PİNLENMİŞ ÇİZİM & MİMARİ AKIŞLAR (
                    {(selectedTask.linkedSketchRefs || []).length})
                  </label>
                  <div className="linked-docs-list">
                    {(selectedTask.linkedSketchRefs || []).map((sr, idx) => (
                      <div
                        key={`${sr.docId}_${idx}`}
                        className="linked-doc-row linked-doc-row--active"
                      >
                        <div className="doc-check-label">
                          <span className="doc-icon">📐</span>
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
                            title="Çizim Tuvaline git ve bu akışa zoom yap"
                          >
                            Odaklan
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
                            title="Yan Yana (Split-Peek) aç ve bu akışa zoom yap"
                          >
                            {SplitViewIcon}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Linked Design Artboards */}
              {(selectedTask.linkedArtboards || []).length > 0 && (
                <div className="detail-section">
                  <label className="detail-label">
                    BAĞLI TASARIM ARTBOARD BİLEŞENLERİ (
                    {(selectedTask.linkedArtboards || []).length})
                  </label>
                  <div className="linked-docs-list">
                    {(selectedTask.linkedArtboards || []).map((la) => (
                      <div
                        key={`${la.docId}_${la.artboardId}`}
                        className="linked-doc-row linked-doc-row--active"
                      >
                        <div className="doc-check-label">
                          <span className="doc-icon">🎨</span>
                          <span className="doc-name">{la.label}</span>
                        </div>
                        <div className="doc-jump-actions">
                          <button
                            type="button"
                            className="jump-btn"
                            onClick={() =>
                              requestArtboardFocus(
                                la.docId,
                                la.artboardId,
                                false,
                              )
                            }
                            title="Tasarım Tuvaline git ve bu Artboard'a odaklan"
                          >
                            Odaklan
                          </button>
                          <button
                            type="button"
                            className="jump-btn"
                            onClick={() =>
                              requestArtboardFocus(
                                la.docId,
                                la.artboardId,
                                true,
                              )
                            }
                            title="Yan Yana (Split-Peek) aç ve bu Artboard'a odaklan"
                          >
                            {SplitViewIcon}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Agent Orchestration Suite */}
              <div className="detail-section">
                <label className="detail-label">
                  🤖 AI AGENT GÖREV ORKESTRASYONU
                </label>
                <button
                  type="button"
                  className="ai-orchestrate-btn"
                  onClick={async () => {
                    const res = await runLiveAgentPipeline(
                      selectedTask.id,
                      "auto",
                    );
                    showToast(`🤖 ${res.summary}`);
                  }}
                >
                  {brainIcon}
                  <span>
                    Atanan AI Agent ile Görevi Çalıştır (Otomatik Evre)
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
                    style={{ justifyContent: "center", padding: "6px 8px" }}
                    onClick={() => {
                      const res = executeAgentOnTask(
                        selectedTask.id,
                        "architecture",
                      );
                      showToast(`🏗️ ${res.summary}`);
                    }}
                    title="Sistem Mimarı Agent ile bu görev için Excalidraw mimari şeması çiz ve göreve pinle"
                  >
                    <span>🏗️ Mimari Şema Çiz</span>
                  </button>
                  <button
                    type="button"
                    className="detail-mini-btn"
                    style={{ justifyContent: "center", padding: "6px 8px" }}
                    onClick={() => {
                      const res = executeAgentOnTask(selectedTask.id, "design");
                      showToast(`🎨 ${res.summary}`);
                    }}
                    title="UI/UX Tasarımcı Agent ile bu görev için pixel-perfect bileşen tasarla ve yan yana aç"
                  >
                    <span>🎨 UI Tasarla</span>
                  </button>
                  <button
                    type="button"
                    className="detail-mini-btn"
                    style={{ justifyContent: "center", padding: "6px 8px" }}
                    onClick={() => {
                      const res = executeAgentOnTask(selectedTask.id, "tdd");
                      showToast(`🧪 ${res.summary}`);
                    }}
                    title="TDD & QA Agent ile kabul ve uç durum (edge-case) test senaryoları üret"
                  >
                    <span>🧪 TDD Üret</span>
                  </button>
                  <button
                    type="button"
                    className="detail-mini-btn"
                    style={{ justifyContent: "center", padding: "6px 8px" }}
                    onClick={async () => {
                      const res = await runLiveAgentPipeline(
                        selectedTask.id,
                        "analysis",
                      );
                      showToast(`📋 ${res.summary}`);
                    }}
                    title="Analist Agent (Canlı LLM / Yerel) ile kabul kriterlerini yapılandır"
                  >
                    <span>📋 Kriter Analizi</span>
                  </button>
                </div>
                {onOpenAIIntegrations && (
                  <button
                    type="button"
                    className="detail-mini-btn"
                    style={{
                      width: "100%",
                      justifyContent: "center",
                      marginTop: 4,
                    }}
                    onClick={onOpenAIIntegrations}
                  >
                    <span>⚙️ Harici LLM / Canlı MCP Köprüsü Ayarları</span>
                  </button>
                )}
              </div>

              {/* Team & Agent Coordination Comments */}
              <div className="detail-section">
                <label className="detail-label">
                  EKİP & AGENT KOORDİNASYON NOTLARI ({selectedTask.comments.length})
                </label>
                <div className="comments-list">
                  {selectedTask.comments.map((cmt) => {
                    const author = team.find((m) => m.id === cmt.authorId);
                    return (
                      <div key={cmt.id} className="comment-card">
                        <div className="comment-meta">
                          <strong>
                            {author
                              ? `${author.kind === "ai_agent" ? "🤖" : "👤"} ${
                                  author.name
                                }`
                              : "Ekip Üyesi"}
                          </strong>
                          <span>
                            {new Date(cmt.createdAt).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p>{cmt.text}</p>
                      </div>
                    );
                  })}
                </div>

                <form className="comment-form" onSubmit={handleAddComment}>
                  <select
                    className="detail-select"
                    value={commentAuthorId}
                    onChange={(e) => setCommentAuthorId(e.target.value)}
                  >
                    {team.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.kind === "ai_agent" ? "🤖 " : "👤 "}
                        {m.name} olarak yaz
                      </option>
                    ))}
                  </select>
                  <div className="detail-inline-form">
                    <input
                      type="text"
                      className="detail-input"
                      placeholder="Koordinasyon notu veya karar ekle..."
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                    />
                    <button type="submit" className="detail-add-btn">
                      Gönder
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </aside>
        )}
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
              <h3>Yeni Proje Görevi Oluştur</h3>
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
                  <label>Görev Başlığı</label>
                  <input
                    type="text"
                    placeholder="Örn: İndirim Kuponu Doğrulama Akışı..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Açıklama & Teknik Kapsam</label>
                  <textarea
                    className="sdlc-modal-textarea"
                    rows={2}
                    placeholder="Analiz, tasarım ve geliştirme beklentileri..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                  />
                </div>

                <div className="sdlc-modal-grid-3">
                  <div className="form-group">
                    <label>Evre / Durum</label>
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
                    <label>Öncelik</label>
                    <select
                      className="sdlc-modal-select"
                      value={newPriority}
                      onChange={(e) =>
                        setNewPriority(e.target.value as TaskPriority)
                      }
                    >
                      <option value="low">Düşük</option>
                      <option value="medium">Orta</option>
                      <option value="high">Yüksek</option>
                      <option value="critical">Kritik</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Atanan (İnsan / Agent)</label>
                    <select
                      className="sdlc-modal-select"
                      value={newAssigneeId}
                      onChange={(e) => setNewAssigneeId(e.target.value)}
                    >
                      <option value="">Atanmadı</option>
                      {team.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.kind === "ai_agent" ? "🤖 " : "👤 "}
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>Kabul Kriterleri (Her satıra bir kriter)</label>
                  <textarea
                    className="sdlc-modal-textarea"
                    rows={3}
                    placeholder={
                      "Geçersiz kuponda uyarı gösterilmeli\nToplam tutar anlık güncellenmeli"
                    }
                    value={newCriteriaText}
                    onChange={(e) => setNewCriteriaText(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>İlgili Analiz, Mimari ve Tasarım Tuvalleri</label>
                  <div className="sdlc-doc-Checkgrid">
                    {docs
                      .filter(
                        (d) =>
                          d.canvasType === "sketch" || d.canvasType === "design",
                      )
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
              </div>
              <div className="new-workspace-modal__footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Vazgeç
                </button>
                <button type="submit" className="btn-primary">
                  Görevi Oluştur
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
