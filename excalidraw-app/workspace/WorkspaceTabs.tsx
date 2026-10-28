import React, { useEffect, useState } from "react";
import {
  FreedrawIcon,
  frameToolIcon,
  LockedIcon,
  PlusIcon,
  CloseIcon,
  SunIcon,
  MoonIcon,
  brainIcon,
  TrashIcon,
  usersIcon,
   searchIcon,
} from "@excalidraw/excalidraw/components/icons";
import {
  getProjects,
  getActiveProject,
  setActiveProjectId,
  createProject,
  getWorkspaces,
  getOpenWorkspaces,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  closeWorkspaceTab,
  getSplitWorkspaceId,
  setSplitWorkspaceId,
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
  getProjectTasks,
  getProjectTDDScenarios,
  getProjectTeam,
  exportProjectBundle,
  importProjectBundle,
  getCategoryLabel,
  subscribeWorkspaces,
  type SDLCProject,
  type WorkspaceDocument,
  type CanvasType,
  type DocumentCategory,
} from "./workspaceStore";
import "./WorkspaceTabs.scss";

export const ArchitectureIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <rect x="3" y="17" width="6" height="4" rx="1" />
    <rect x="15" y="17" width="6" height="4" rx="1" />
    <path d="M12 7v5m0 0H6v5m6-5h6v5" />
  </svg>
);

export const TaskBoardIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16M15 4v16M6 8h1M12 8h1M18 8h1M6 12h1M12 12h1" />
  </svg>
);

export const TDDTestIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 12l2 2 4-4" />
    <path d="M12 3l8 4v5c0 5.25-3.5 8.75-8 10-4.5-1.25-8-4.75-8-10V7l8-4z" />
  </svg>
);

export const ProjectFolderIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  </svg>
);

export const SplitViewIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <line x1="12" y1="4" x2="12" y2="20" />
  </svg>
);

export const ContextLinkIcon = (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

export function getDocumentIcon(doc: WorkspaceDocument): React.ReactNode {
  if (doc.category === "architecture") return ArchitectureIcon;
  if (doc.canvasType === "design") return frameToolIcon;
  if (doc.canvasType === "tasks") return TaskBoardIcon;
  if (doc.canvasType === "tdd") return TDDTestIcon;
  return FreedrawIcon;
}

interface WorkspaceTabsProps {
  editorTheme?: "light" | "dark";
  onToggleTheme?: () => void;
  onOpenAIIntegrations?: () => void;
  isContextDrawerOpen?: boolean;
  onToggleContextDrawer?: () => void;
  onOpenTeamModal?: () => void;
}

interface PresetOption {
  canvasType: CanvasType;
  category: DocumentCategory;
  title: string;
  desc: string;
  placeholder: string;
  icon: React.ReactNode;
}

const SURFACE_PRESETS: PresetOption[] = [
  {
    canvasType: "sketch",
    category: "analysis",
    title: "Analiz & Akış Tuvali",
    desc: "İş analizi, kullanıcı akışları, süreç diyagramları ve beyin fırtınası (Excalidraw).",
    placeholder: "Örn: Sipariş İptal Akış Analizi...",
    icon: FreedrawIcon,
  },
  {
    canvasType: "sketch",
    category: "architecture",
    title: "Sistem Mimarisi & Şema",
    desc: "Mikroservis sınırları, sistem mimarisi taslağı, ER diyagramları ve Mermaid şemaları.",
    placeholder: "Örn: Ödeme Servisi Mimari Taslağı...",
    icon: ArchitectureIcon,
  },
  {
    canvasType: "design",
    category: "ui_design",
    title: "UI/UX Tasarım Tuvali",
    desc: "Pixel-perfect CSS/HTML bileşenler, Hug Contents kartlar ve canlı DOM denetçisi.",
    placeholder: "Örn: Sipariş Ekranı Tasarımları...",
    icon: frameToolIcon,
  },
  {
    canvasType: "tasks",
    category: "task_board",
    title: "Proje & Görev Panosu",
    desc: "Kanban ve liste görünümüyle analiz, tasarım ve TDD testlerine bağlı ekip görevleri.",
    placeholder: "Örn: Sprint 2 Görev Panosu...",
    icon: TaskBoardIcon,
  },
  {
    canvasType: "tdd",
    category: "tdd_suite",
    title: "TDD & Test Senaryoları",
    desc: "Given/When/Then BDD senaryoları ve Red-Green-Refactor TDD doğrulama matrisi.",
    placeholder: "Örn: Sipariş Doğrulama TDD Paketi...",
    icon: TDDTestIcon,
  },
];

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  editorTheme = "light",
  onToggleTheme,
  onOpenAIIntegrations,
  isContextDrawerOpen = false,
  onToggleContextDrawer,
  onOpenTeamModal,
}) => {
  const [projects, setProjects] = useState<SDLCProject[]>([]);
  const [activeProject, setActiveProject] = useState<SDLCProject | null>(null);
  const [allWorkspaces, setAllWorkspaces] = useState<WorkspaceDocument[]>([]);
  const [openWorkspaces, setOpenWorkspaces] = useState<WorkspaceDocument[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [splitId, setSplitId] = useState<string | null>(null);

  const [isExplorerOpen, setIsExplorerOpen] = useState(false);
  const [isSplitMenuOpen, setIsSplitMenuOpen] = useState(false);
  const [explorerSearch, setExplorerSearch] = useState("");
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedPresetIdx, setSelectedPresetIdx] = useState<number>(2);

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const [linkedCounts, setLinkedCounts] = useState({ tasks: 0, tdd: 0 });
  const [teamCount, setTeamCount] = useState(0);
  const barRef = React.useRef<HTMLElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const handleExportProject = () => {
    const ownerDoc = barRef.current?.ownerDocument;
    const ownerWin = ownerDoc?.defaultView;
    if (!ownerDoc || !ownerWin) return;
    const bundle = exportProjectBundle(activeProject?.id, ownerWin);
    const json = JSON.stringify(bundle, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = ownerWin.URL.createObjectURL(blob);
    const a = ownerDoc.createElement("a");
    a.href = url;
    const safeName = (bundle.project.name || "proje")
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/gi, "-")
      .replace(/^-|-$/g, "");
    a.download = `${safeName || "proje"}.synapdraw.json`;
    ownerDoc.body.appendChild(a);
    a.click();
    a.remove();
    ownerWin.URL.revokeObjectURL(url);
  };

  const handleImportProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ownerWin = barRef.current?.ownerDocument?.defaultView;
    if (!ownerWin) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        if (typeof reader.result === "string") {
          importProjectBundle(reader.result, ownerWin);
          setIsExplorerOpen(false);
        }
      } catch (err) {
        console.error("[SynapDraw] Proje içe aktarma hatası:", err);
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  useEffect(() => {
    const update = () => {
      const projs = getProjects();
      const actProj = getActiveProject();
      const docs = getWorkspaces();
      const openDocs = getOpenWorkspaces();
      const actId = getActiveWorkspaceId();
      const spId = getSplitWorkspaceId();

      setProjects(projs);
      setActiveProject(actProj);
      setAllWorkspaces(docs);
      setOpenWorkspaces(openDocs);
      setActiveId(actId);
      setSplitId(spId);

      const tasks = getProjectTasks(actProj.id);
      const tdds = getProjectTDDScenarios(actProj.id);
      const team = getProjectTeam(actProj.id);
      const linkedTasks = tasks.filter((t) => t.linkedDocIds.includes(actId)).length;
      const linkedTdds = tdds.filter((s) => s.linkedDocIds.includes(actId)).length;

      setLinkedCounts({
        tasks: linkedTasks || tasks.length,
        tdd: linkedTdds || tdds.length,
      });
      setTeamCount(team.length);
    };
    update();
    return subscribeWorkspaces(update);
  }, []);

  const handleSelectTab = (id: string) => {
    setActiveWorkspaceId(id);
  };

  const handleOpenCreateModal = (presetIndex = 2) => {
    setNewTitle("");
    setSelectedPresetIdx(presetIndex);
    setIsModalOpen(true);
    setIsExplorerOpen(false);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const preset = SURFACE_PRESETS[selectedPresetIdx] || SURFACE_PRESETS[0];
    const doc = createWorkspace(newTitle, preset.canvasType, preset.category);
    setIsModalOpen(false);
    setActiveWorkspaceId(doc.id);
  };

  const handleCreateNewProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    createProject(newProjectName.trim());
    setNewProjectName("");
    setIsCreatingProject(false);
  };

  const handleCommitRename = (id: string) => {
    if (editingName.trim()) {
      renameWorkspace(id, editingName.trim());
    }
    setEditingTabId(null);
  };

  const handleConfirmDelete = () => {
    if (pendingDeleteId) {
      deleteWorkspace(pendingDeleteId);
      setPendingDeleteId(null);
    }
  };

  const pendingDeleteWs = allWorkspaces.find((w) => w.id === pendingDeleteId);
  const selectedPreset = SURFACE_PRESETS[selectedPresetIdx] || SURFACE_PRESETS[0];

  const filteredDocs = allWorkspaces.filter((doc) =>
    doc.name.toLowerCase().includes(explorerSearch.trim().toLowerCase()),
  );

  const groupedDocs = {
    sketch: filteredDocs.filter((d) => d.canvasType === "sketch"),
    design: filteredDocs.filter((d) => d.canvasType === "design"),
    tasks: filteredDocs.filter((d) => d.canvasType === "tasks"),
    tdd: filteredDocs.filter((d) => d.canvasType === "tdd"),
  };

  const otherWorkspacesForSplit = allWorkspaces.filter((w) => w.id !== activeId);

  return (
    <>
      <header ref={barRef} className="workspace-tabs-bar">
        <div className="tabs-left-cluster">
          {/* Project Explorer Trigger */}
          <button
            type="button"
            className={`project-explorer-btn ${
              isExplorerOpen ? "project-explorer-btn--active" : ""
            }`}
            onClick={() => {
              setIsExplorerOpen((prev) => !prev);
              setIsSplitMenuOpen(false);
            }}
            title="Proje Gezgini ve Doküman Ağacı"
          >
            <span className="proj-icon">{ProjectFolderIcon}</span>
            <span className="proj-name">
              {activeProject?.name || "Proje"}
            </span>
            <span className="proj-count">{allWorkspaces.length}</span>
          </button>

          <div className="tabs-bar-divider" />

          {/* Open Pinned Tabs */}
          <div className="tabs-scroll-container" role="tablist">
            {openWorkspaces.map((ws) => {
              const isActive = ws.id === activeId;
              const isSplit = ws.id === splitId;
              const isEditing = editingTabId === ws.id;
              return (
                <div
                  key={ws.id}
                  role="tab"
                  aria-selected={isActive}
                  className={`workspace-tab ${
                    isActive ? "workspace-tab--active" : ""
                  } ${isSplit ? "workspace-tab--split" : ""}`}
                  onClick={() => handleSelectTab(ws.id)}
                  onDoubleClick={() => {
                    setEditingTabId(ws.id);
                    setEditingName(ws.name);
                  }}
                  title={`${ws.name} (${getCategoryLabel(
                    ws.category,
                  )}) — Yeniden adlandırmak için çift tıklayın`}
                >
                  <span className="tab-icon">{getDocumentIcon(ws)}</span>

                  {isEditing ? (
                    <input
                      type="text"
                      className="tab-name-input"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onBlur={() => handleCommitRename(ws.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCommitRename(ws.id);
                        if (e.key === "Escape") setEditingTabId(null);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span className="tab-name">{ws.name}</span>
                  )}

                  <span
                    className={`tab-badge tab-badge--${ws.category}`}
                  >
                    {getCategoryLabel(ws.category)}
                  </span>

                  {openWorkspaces.length > 1 && (
                    <button
                      type="button"
                      className="tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeWorkspaceTab(ws.id);
                      }}
                      title="Sekmeyi kapat (Proje gezgininde kalmaya devam eder)"
                    >
                      {CloseIcon}
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              className="new-tab-btn"
              onClick={() => handleOpenCreateModal(2)}
              title="Projeye Yeni Yüzey / Tuval Ekle"
            >
              {PlusIcon}
            </button>
          </div>
        </div>

        {/* Right Side Coordination & Global Actions */}
        <div className="tabs-info-bar">
          {/* Split-Peek Switcher */}
          <div className="split-menu-wrapper">
            <button
              type="button"
              className={`tabs-action-btn ${
                splitId ? "tabs-action-btn--active" : ""
              }`}
              onClick={() => {
                if (splitId) {
                  setSplitWorkspaceId(null);
                  setIsSplitMenuOpen(false);
                } else {
                  setIsSplitMenuOpen((prev) => !prev);
                  setIsExplorerOpen(false);
                }
              }}
              title={
                splitId
                  ? "Yan Yana (Split-Peek) Görünümü Kapat"
                  : "Ekranı İkiye Böl (Analiz, Tasarım, Görev veya TDD'yi Yan Yana Aç)"
              }
            >
              {SplitViewIcon}
              <span>{splitId ? "Bölünmüş: Aktif" : "Yan Yana"}</span>
            </button>

            {isSplitMenuOpen && (
              <div className="split-picker-popover Island">
                <div className="split-picker-header">
                  <span>Yan Yana Açılacak Yüzeyi Seçin</span>
                  <button
                    type="button"
                    className="split-picker-close"
                    onClick={() => setIsSplitMenuOpen(false)}
                  >
                    {CloseIcon}
                  </button>
                </div>
                <div className="split-picker-list">
                  {otherWorkspacesForSplit.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      className="split-picker-item"
                      onClick={() => {
                        setSplitWorkspaceId(doc.id);
                        setIsSplitMenuOpen(false);
                      }}
                    >
                      <span className="item-icon">{getDocumentIcon(doc)}</span>
                      <span className="item-name">{doc.name}</span>
                      <span className={`item-badge item-badge--${doc.category}`}>
                        {getCategoryLabel(doc.category)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Context & Linked Artifacts Drawer Toggle */}
          {onToggleContextDrawer && (
            <button
              type="button"
              className={`tabs-action-btn ${
                isContextDrawerOpen ? "tabs-action-btn--active" : ""
              }`}
              onClick={onToggleContextDrawer}
              title="Bu yüzeye bağlı Görevleri, Kabul Kriterlerini ve TDD Test Senaryolarını görüntüle"
            >
              {ContextLinkIcon}
              <span>Bağlam</span>
              <span className="action-count-pill">
                {linkedCounts.tasks}G · {linkedCounts.tdd}T
              </span>
            </button>
          )}

          {/* Team & AI Agents Roster Button */}
          {onOpenTeamModal && (
            <button
              type="button"
              className="tabs-action-btn"
              onClick={onOpenTeamModal}
              title="Proje Ekibi ve AI Agent Kadrosu"
            >
              {usersIcon}
              <span>Ekip & Agent</span>
              <span className="action-count-pill">{teamCount}</span>
            </button>
          )}

          {onOpenAIIntegrations && (
            <button
              type="button"
              className="tabs-action-btn"
              onClick={onOpenAIIntegrations}
              title="AI Studio & Canlı MCP Ayarları"
            >
              {brainIcon}
              <span>AI Studio</span>
            </button>
          )}

          {onToggleTheme && (
            <button
              type="button"
              className="tabs-action-btn tabs-action-btn--icon-only"
              onClick={onToggleTheme}
              title={
                editorTheme === "dark"
                  ? "Açık Temaya Geç"
                  : "Koyu Temaya Geç"
              }
            >
              {editorTheme === "dark" ? SunIcon : MoonIcon}
            </button>
          )}
        </div>
      </header>

      {/* Floating Project Explorer Island Drawer */}
      {isExplorerOpen && (
        <div
          className="project-explorer-backdrop"
          onClick={() => setIsExplorerOpen(false)}
        >
          <aside
            className="project-explorer-drawer Island"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="explorer-header">
              <div className="explorer-project-row">
                <label className="explorer-label">AKTİF PROJE</label>
                <button
                  type="button"
                  className="explorer-new-proj-btn"
                  onClick={() => setIsCreatingProject((prev) => !prev)}
                >
                  {PlusIcon}
                  <span>Yeni Proje</span>
                </button>
              </div>

              {isCreatingProject ? (
                <form
                  className="explorer-new-proj-form"
                  onSubmit={handleCreateNewProject}
                >
                  <input
                    type="text"
                    className="explorer-input"
                    placeholder="Proje adı (Örn: CRM Platformu)..."
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    autoFocus
                  />
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setIsCreatingProject(false)}
                    >
                      İptal
                    </button>
                    <button type="submit" className="btn-create">
                      Oluştur
                    </button>
                  </div>
                </form>
              ) : (
                <select
                  className="explorer-project-select"
                  value={activeProject?.id || ""}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="explorer-search-box">
                <span className="search-icon">{searchIcon}</span>
                <input
                  type="text"
                  className="explorer-search-input"
                  placeholder="Analiz, tasarım, görev veya test ara..."
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="explorer-sections">
              {/* 1. Analysis & Architecture */}
              <div className="explorer-group">
                <div className="explorer-group-header">
                  <span>ANALİZ & MİMARİ (ÇİZİM)</span>
                  <div className="group-actions">
                    <button
                      type="button"
                      className="group-add-btn"
                      onClick={() => handleOpenCreateModal(0)}
                      title="Yeni Analiz Tuvali Ekle"
                    >
                      + Analiz
                    </button>
                    <button
                      type="button"
                      className="group-add-btn"
                      onClick={() => handleOpenCreateModal(1)}
                      title="Yeni Mimari Şema Tuvali Ekle"
                    >
                      + Mimari
                    </button>
                  </div>
                </div>
                {groupedDocs.sketch.map((doc) => (
                  <div
                    key={doc.id}
                    className={`explorer-doc-item ${
                      doc.id === activeId ? "explorer-doc-item--active" : ""
                    }`}
                    onClick={() => {
                      setActiveWorkspaceId(doc.id);
                      setIsExplorerOpen(false);
                    }}
                  >
                    <span className="doc-icon">{getDocumentIcon(doc)}</span>
                    <span className="doc-name">{doc.name}</span>
                    <span className={`doc-tag doc-tag--${doc.category}`}>
                      {getCategoryLabel(doc.category)}
                    </span>
                    <div
                      className="doc-row-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {doc.id !== activeId && (
                        <button
                          type="button"
                          className="row-icon-btn"
                          title="Yan Yana (Split-Peek) Aç"
                          onClick={() => {
                            setSplitWorkspaceId(doc.id);
                            setIsExplorerOpen(false);
                          }}
                        >
                          {SplitViewIcon}
                        </button>
                      )}
                      {allWorkspaces.length > 1 && (
                        <button
                          type="button"
                          className="row-icon-btn row-icon-btn--danger"
                          title="Projeden Kalıcı Olarak Sil"
                          onClick={() => setPendingDeleteId(doc.id)}
                        >
                          {TrashIcon}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 2. UI/UX Design Canvases */}
              <div className="explorer-group">
                <div className="explorer-group-header">
                  <span>UI/UX EKRAN TASARIMLARI</span>
                  <button
                    type="button"
                    className="group-add-btn"
                    onClick={() => handleOpenCreateModal(2)}
                  >
                    + Tasarım
                  </button>
                </div>
                {groupedDocs.design.map((doc) => (
                  <div
                    key={doc.id}
                    className={`explorer-doc-item ${
                      doc.id === activeId ? "explorer-doc-item--active" : ""
                    }`}
                    onClick={() => {
                      setActiveWorkspaceId(doc.id);
                      setIsExplorerOpen(false);
                    }}
                  >
                    <span className="doc-icon">{getDocumentIcon(doc)}</span>
                    <span className="doc-name">{doc.name}</span>
                    <div
                      className="doc-row-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {doc.id !== activeId && (
                        <button
                          type="button"
                          className="row-icon-btn"
                          title="Yan Yana (Split-Peek) Aç"
                          onClick={() => {
                            setSplitWorkspaceId(doc.id);
                            setIsExplorerOpen(false);
                          }}
                        >
                          {SplitViewIcon}
                        </button>
                      )}
                      {allWorkspaces.length > 1 && (
                        <button
                          type="button"
                          className="row-icon-btn row-icon-btn--danger"
                          title="Projeden Kalıcı Olarak Sil"
                          onClick={() => setPendingDeleteId(doc.id)}
                        >
                          {TrashIcon}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 3. Task Boards */}
              <div className="explorer-group">
                <div className="explorer-group-header">
                  <span>PROJE & GÖREV YÖNETİMİ</span>
                  <button
                    type="button"
                    className="group-add-btn"
                    onClick={() => handleOpenCreateModal(3)}
                  >
                    + Pano
                  </button>
                </div>
                {groupedDocs.tasks.map((doc) => (
                  <div
                    key={doc.id}
                    className={`explorer-doc-item ${
                      doc.id === activeId ? "explorer-doc-item--active" : ""
                    }`}
                    onClick={() => {
                      setActiveWorkspaceId(doc.id);
                      setIsExplorerOpen(false);
                    }}
                  >
                    <span className="doc-icon">{getDocumentIcon(doc)}</span>
                    <span className="doc-name">{doc.name}</span>
                    <div
                      className="doc-row-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {doc.id !== activeId && (
                        <button
                          type="button"
                          className="row-icon-btn"
                          title="Yan Yana (Split-Peek) Aç"
                          onClick={() => {
                            setSplitWorkspaceId(doc.id);
                            setIsExplorerOpen(false);
                          }}
                        >
                          {SplitViewIcon}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 4. TDD & Test Suites */}
              <div className="explorer-group">
                <div className="explorer-group-header">
                  <span>TDD & TEST SENARYOLARI</span>
                  <button
                    type="button"
                    className="group-add-btn"
                    onClick={() => handleOpenCreateModal(4)}
                  >
                    + Test Paketi
                  </button>
                </div>
                {groupedDocs.tdd.map((doc) => (
                  <div
                    key={doc.id}
                    className={`explorer-doc-item ${
                      doc.id === activeId ? "explorer-doc-item--active" : ""
                    }`}
                    onClick={() => {
                      setActiveWorkspaceId(doc.id);
                      setIsExplorerOpen(false);
                    }}
                  >
                    <span className="doc-icon">{getDocumentIcon(doc)}</span>
                    <span className="doc-name">{doc.name}</span>
                    <div
                      className="doc-row-actions"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {doc.id !== activeId && (
                        <button
                          type="button"
                          className="row-icon-btn"
                          title="Yan Yana (Split-Peek) Aç"
                          onClick={() => {
                            setSplitWorkspaceId(doc.id);
                            setIsExplorerOpen(false);
                          }}
                        >
                          {SplitViewIcon}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Portable Project Bundle Export / Import Footer */}
            <div
              style={{
                padding: "10px 14px",
                borderTop: "1px solid var(--default-border-color, #e5e5e5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                background: "var(--color-surface-low)",
              }}
            >
              <button
                type="button"
                onClick={handleExportProject}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 6,
                  border: "1px solid var(--default-border-color)",
                  background: "var(--island-bg-color)",
                  color: "var(--text-primary-color)",
                  fontFamily: "var(--ui-font)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Tüm projeyi (çizimler, tasarımlar, görevler, TDD testleri ve ekip kadrosu) taşınabilir .synapdraw.json dosyası olarak indir"
              >
                📦 Projeyi İndir (.json)
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{
                  flex: 1,
                  height: 30,
                  borderRadius: 6,
                  border: "1px solid var(--default-border-color)",
                  background: "var(--island-bg-color)",
                  color: "var(--text-primary-color)",
                  fontFamily: "var(--ui-font)",
                  fontSize: 11.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                title="Başka bir bilgisayardan dışa aktarılan .synapdraw.json proje paketini yükle"
              >
                📂 Proje Yükle
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json,.synapdraw.json"
                style={{ display: "none" }}
                onChange={handleImportProjectFile}
              />
            </div>
          </aside>
        </div>
      )}

      {/* Create New Workspace Surface Modal */}
      {isModalOpen && (
        <div
          className="new-workspace-modal-overlay"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="new-workspace-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="new-workspace-modal__header">
              <h3>Projeye Yeni Çalışma Yüzeyi Ekle</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsModalOpen(false)}
              >
                {CloseIcon}
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="new-workspace-modal__body">
                <div className="form-group">
                  <label htmlFor="ws-name">Yüzey / Doküman Başlığı</label>
                  <input
                    id="ws-name"
                    type="text"
                    placeholder={selectedPreset.placeholder}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Yaşam Döngüsü Yüzey Tipi Seçin</label>
                  <div className="canvas-type-selector canvas-type-selector--grid">
                    {SURFACE_PRESETS.map((preset, idx) => (
                      <button
                        key={`${preset.canvasType}-${preset.category}`}
                        type="button"
                        className={`type-card ${
                          selectedPresetIdx === idx ? "type-card--selected" : ""
                        }`}
                        onClick={() => setSelectedPresetIdx(idx)}
                      >
                        <div className="card-header">
                          <span className="card-icon">{preset.icon}</span>
                          <span className="card-title">{preset.title}</span>
                        </div>
                        <div className="card-desc">{preset.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="type-lock-notice">
                  <span className="notice-icon">{LockedIcon}</span>
                  <span>
                    Bu yüzey <strong>{activeProject?.name}</strong> projesi
                    altında oluşturulur ve projedeki diğer görev, analiz, tasarım
                    ve TDD senaryolarıyla doğrudan ilişkilendirilebilir.
                  </span>
                </div>
              </div>
              <div className="new-workspace-modal__footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Vazgeç
                </button>
                <button type="submit" className="btn-primary">
                  Yüzeyi Oluştur
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Workspace Confirmation Modal */}
      {pendingDeleteWs && (
        <div
          className="new-workspace-modal-overlay"
          onClick={() => setPendingDeleteId(null)}
        >
          <div
            className="new-workspace-modal new-workspace-modal--compact"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="new-workspace-modal__header">
              <h3>Dokümanı Projeden Sil</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setPendingDeleteId(null)}
              >
                {CloseIcon}
              </button>
            </div>
            <div className="new-workspace-modal__body">
              <p className="confirm-text">
                <strong>"{pendingDeleteWs.name}"</strong> dokümanını ve
                içindeki verileri projeden kalıcı olarak silmek istediğinize
                emin misiniz?
              </p>
            </div>
            <div className="new-workspace-modal__footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPendingDeleteId(null)}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
              >
                Kalıcı Olarak Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
