import React, { useEffect, useState } from "react";
import {
  CloseIcon,
  PlusIcon,
  TrashIcon,
  brainIcon,
} from "@excalidraw/excalidraw/components/icons";
import {
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
  removeTeamMember,
  setActiveWorkspaceId,
  setSplitWorkspaceId,
  subscribeWorkspaces,
  type WorkspaceDocument,
  type ProjectTask,
  type TDDScenario,
  type TDDStatus,
  type TeamMember,
  type ParticipantKind,
  type ParticipantRole,
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
}

export const SDLCContextDrawer: React.FC<SDLCContextDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const [activeDoc, setActiveDoc] = useState<WorkspaceDocument | null>(null);
  const [allDocs, setAllDocs] = useState<WorkspaceDocument[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [scenarios, setScenarios] = useState<TDDScenario[]>([]);

  const [quickTaskTitle, setQuickTaskTitle] = useState("");
  const [quickTestTitle, setQuickTestTitle] = useState("");

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
}

const ROLE_OPTIONS: { role: ParticipantRole; label: string }[] = [
  { role: "developer", label: "Full-Stack Yazılımcı" },
  { role: "po", label: "Product Owner / İş Analisti" },
  { role: "pm", label: "Proje Yöneticisi (PM)" },
  { role: "architect", label: "Sistem Mimarı" },
  { role: "designer", label: "UI/UX Tasarımcı" },
  { role: "qa", label: "TDD / QA Test Mühendisi" },
];

export const TeamRosterModal: React.FC<TeamRosterModalProps> = ({
  isOpen,
  onClose,
  onOpenAIStudio,
}) => {
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [kind, setKind] = useState<ParticipantKind>("ai_agent");
  const [name, setName] = useState("");
  const [role, setRole] = useState<ParticipantRole>("developer");
  const [systemPrompt, setSystemPrompt] = useState("");

  useEffect(() => {
    const sync = () => setTeam(getProjectTeam());
    sync();
    return subscribeWorkspaces(sync);
  }, []);

  if (!isOpen) return null;

  const humans = team.filter((m) => m.kind === "human");
  const agents = team.filter((m) => m.kind === "ai_agent");

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const roleMeta =
      ROLE_OPTIONS.find((r) => r.role === role) || ROLE_OPTIONS[0];
    const colors = ["#6965db", "#0ca678", "#1c7ed6", "#e64980", "#f59f00"];
    const avatarColor = colors[team.length % colors.length];

    addTeamMember({
      name: name.trim(),
      kind,
      role,
      roleLabel:
        kind === "ai_agent" ? `AI ${roleMeta.label}` : roleMeta.label,
      avatarColor,
      systemPrompt:
        kind === "ai_agent"
          ? systemPrompt.trim() ||
            `${roleMeta.label} rolünde proje analiz, tasarım ve TDD süreçlerini yürütür.`
          : undefined,
    });
    setName("");
    setSystemPrompt("");
  };

  return (
    <div className="new-workspace-modal-overlay" onClick={onClose}>
      <div
        className="new-workspace-modal sdlc-team-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="new-workspace-modal__header">
          <h3>Proje Ekibi & AI Agent Kadrosu</h3>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
          >
            {CloseIcon}
          </button>
        </div>

        <div className="new-workspace-modal__body">
          <div className="team-roster-columns">
            {/* Human Members */}
            <div className="roster-column">
              <div className="roster-col-header">
                <span>👤 İNSAN EKİP ÜYELERİ ({humans.length})</span>
              </div>
              <div className="roster-list">
                {humans.map((m) => (
                  <div key={m.id} className="roster-member-card">
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
                        onClick={() => removeTeamMember(m.id)}
                        title="Ekipten çıkar"
                      >
                        {TrashIcon}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* AI Agent Squad */}
            <div className="roster-column">
              <div className="roster-col-header">
                <span>🤖 ENTEGRE AI AGENT EKİBİ ({agents.length})</span>
              </div>
              <div className="roster-list">
                {agents.map((m) => (
                  <div
                    key={m.id}
                    className="roster-member-card roster-member-card--agent"
                  >
                    <span
                      className="member-avatar"
                      style={{ backgroundColor: m.avatarColor }}
                    >
                      AI
                    </span>
                    <div className="member-info">
                      <strong>{m.name}</strong>
                      <span>{m.roleLabel}</span>
                      {m.systemPrompt && (
                        <p className="member-prompt">{m.systemPrompt}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="member-remove-btn"
                      onClick={() => removeTeamMember(m.id)}
                      title="Agent'ı kaldır"
                    >
                      {TrashIcon}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Add New Human or AI Agent Form */}
          <form className="team-add-form" onSubmit={handleAdd}>
            <div className="form-header-row">
              <strong>Yeni Ekip Arkadaşı veya Uzman AI Agent Ekle</strong>
              <div className="sdlc-segmented">
                <button
                  type="button"
                  className={`seg-btn ${
                    kind === "ai_agent" ? "seg-btn--active" : ""
                  }`}
                  onClick={() => setKind("ai_agent")}
                >
                  🤖 AI Agent
                </button>
                <button
                  type="button"
                  className={`seg-btn ${
                    kind === "human" ? "seg-btn--active" : ""
                  }`}
                  onClick={() => setKind("human")}
                >
                  👤 İnsan Üye
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
                      ? "Örn: Güvenlik Denetçisi Agent..."
                      : "Örn: Mert (Product Owner)..."
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Uzmanlık / Rol</label>
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
              <div className="form-group">
                <label>Agent Görev Yönergesi (System Prompt)</label>
                <input
                  type="text"
                  placeholder="Örn: Sipariş akışındaki uç durumları analiz eder ve TDD senaryoları yazar..."
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                />
              </div>
            )}

            <div className="team-add-actions">
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
                  <span>AI Studio & MCP Ayarları</span>
                </button>
              )}
              <button type="submit" className="btn-primary">
                {PlusIcon}
                <span>
                  {kind === "ai_agent" ? "AI Agent'ı Kadroya Ekle" : "Ekibe Ekle"}
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
