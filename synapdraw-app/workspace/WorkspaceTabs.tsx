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
  ExcalLogo,
  ArchitectureIcon,
  TaskBoardIcon,
  TDDTestIcon,
  ProjectFolderIcon,
  SplitViewIcon,
  ContextLinkIcon,
  alertTriangleIcon,
  boltIcon,
  checkIcon,
  ExportIcon,
  LoadIcon,
  abacusIcon,
} from "@excalidraw/excalidraw/components/icons";
import { languages, useI18n } from "@excalidraw/excalidraw/i18n";
import { useAppLangCode } from "../app-language/language-state";
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
  generateTDDFromTask,
  computeProjectTraceabilityPulse,
  exportProjectBundle,
  importProjectBundle,
  getCategoryLabel,
  subscribeWorkspaces,
  type SDLCProject,
  type WorkspaceDocument,
  type CanvasType,
  type DocumentCategory,
  type TeamMember,
} from "./workspaceStore";
import "./WorkspaceTabs.scss";

export {
  ArchitectureIcon,
  TaskBoardIcon,
  TDDTestIcon,
  ProjectFolderIcon,
  SplitViewIcon,
  ContextLinkIcon,
};

export const SynapDrawBrandIcon = ExcalLogo;

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

interface PresetDef {
  canvasType: CanvasType;
  category: DocumentCategory;
  icon: React.ReactNode;
}

const SURFACE_PRESET_DEFS: PresetDef[] = [
  {
    canvasType: "sketch",
    category: "analysis",
    icon: FreedrawIcon,
  },
  {
    canvasType: "sketch",
    category: "architecture",
    icon: ArchitectureIcon,
  },
  {
    canvasType: "design",
    category: "ui_design",
    icon: frameToolIcon,
  },
  {
    canvasType: "tasks",
    category: "task_board",
    icon: TaskBoardIcon,
  },
  {
    canvasType: "tdd",
    category: "tdd_suite",
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
  const { t } = useI18n();
  const [langCode, setLangCode] = useAppLangCode();
  const SURFACE_PRESETS: PresetOption[] = [
    {
      ...SURFACE_PRESET_DEFS[0],
      title: t("sdlc.categories.analysis"),
      desc: t("sdlc.explorer.catDescAnalysis"),
      placeholder: t("sdlc.explorer.surfaceTitlePlaceholder"),
    },
    {
      ...SURFACE_PRESET_DEFS[1],
      title: t("sdlc.categories.architecture"),
      desc: t("sdlc.explorer.catDescArchitecture"),
      placeholder: t("sdlc.explorer.surfaceTitlePlaceholder"),
    },
    {
      ...SURFACE_PRESET_DEFS[2],
      title: t("sdlc.categories.ui_design"),
      desc: t("sdlc.explorer.catDescUiDesign"),
      placeholder: t("sdlc.explorer.surfaceTitlePlaceholder"),
    },
    {
      ...SURFACE_PRESET_DEFS[3],
      title: t("sdlc.categories.task_board"),
      desc: t("sdlc.explorer.catDescTaskBoard"),
      placeholder: t("sdlc.explorer.surfaceTitlePlaceholder"),
    },
    {
      ...SURFACE_PRESET_DEFS[4],
      title: t("sdlc.categories.tdd_suite"),
      desc: t("sdlc.explorer.catDescTddSuite"),
      placeholder: t("sdlc.explorer.surfaceTitlePlaceholder"),
    },
  ];
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
  const [copyTeamFromProjId, setCopyTeamFromProjId] = useState<string>("");
  const [projectTeamList, setProjectTeamList] = useState<TeamMember[]>([]);

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
      setProjectTeamList(team);
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
    createProject(
      newProjectName.trim(),
      "",
      copyTeamFromProjId || undefined,
    );
    setNewProjectName("");
    setCopyTeamFromProjId("");
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
  const pulse = computeProjectTraceabilityPulse(activeProject?.id);

  return (
    <>
      <header ref={barRef} className="workspace-tabs-bar">
        <div className="tabs-left-cluster">
          {/* SynapDraw Brand Emblem */}
          <div className="synapdraw-brand-badge" title="SynapDraw">
            <span className="synapdraw-brand-icon">{SynapDrawBrandIcon}</span>
            <span className="synapdraw-brand-name">SynapDraw</span>
          </div>

          <div className="tabs-bar-divider" />

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
            title={t("sdlc.common.openWorkspaceTitle")}
          >
            <span className="proj-icon">{ProjectFolderIcon}</span>
            <span className="proj-name">
              {activeProject?.name || t("sdlc.explorer.projectsTitle")}
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
                  title={`${ws.name} — ${t("sdlc.common.doubleClickRename", {
                    category: getCategoryLabel(ws.category),
                  })}`}
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
                      title={t("sdlc.common.close")}
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
              title={t("sdlc.common.newSurfaceTitle")}
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
                  ? t("sdlc.common.closeSplit")
                  : t("sdlc.common.openInSplitView")
              }
            >
              {SplitViewIcon}
              <span>
                {splitId
                  ? t("sdlc.common.splitActive")
                  : t("sdlc.common.splitView")}
              </span>
            </button>

            {isSplitMenuOpen && (
              <div className="split-picker-popover Island">
                <div className="split-picker-header">
                  <span>{t("sdlc.common.openInSplitView")}</span>
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
              title={t("sdlc.common.contextTitle")}
            >
              {ContextLinkIcon}
              <span>{t("sdlc.common.context")}</span>
              <span className="action-count-pill">
                {linkedCounts.tasks} · {linkedCounts.tdd}
              </span>
            </button>
          )}

          {/* Team & AI Agents Roster Button */}
          {onOpenTeamModal && (
            <button
              type="button"
              className="tabs-action-btn"
              onClick={onOpenTeamModal}
              title={t("sdlc.common.teamTitle")}
            >
              {usersIcon}
              <span>{t("sdlc.common.teamAndAgents")}</span>
              <span className="action-count-pill">{teamCount}</span>
            </button>
          )}

          {onOpenAIIntegrations && (
            <button
              type="button"
              className="tabs-action-btn"
              onClick={onOpenAIIntegrations}
              title={t("sdlc.common.aiStudioTitle")}
            >
              {brainIcon}
              <span>{t("sdlc.common.aiStudio")}</span>
            </button>
          )}

          <select
            aria-label={t("buttons.selectLanguage")}
            title={t("buttons.selectLanguage")}
            value={langCode}
            onChange={(e) => setLangCode(e.target.value)}
            style={{
              height: 28,
              borderRadius: 6,
              border: "1px solid var(--default-border-color, #e5e5e5)",
              background: "var(--color-surface-low)",
              color: "var(--text-primary-color)",
              fontSize: 11,
              fontWeight: 600,
              padding: "0 6px",
              cursor: "pointer",
            }}
          >
            {languages.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>

          {onToggleTheme && (
            <button
              type="button"
              className="tabs-action-btn tabs-action-btn--icon-only"
              onClick={onToggleTheme}
              title={
                editorTheme === "dark"
                  ? t("sdlc.common.switchToLight")
                  : t("sdlc.common.switchToDark")
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
                <label className="explorer-label">
                  {t("sdlc.explorer.projectsTitle")}
                </label>
                <button
                  type="button"
                  className="explorer-new-proj-btn"
                  onClick={() => setIsCreatingProject((prev) => !prev)}
                >
                  {PlusIcon}
                  <span>{t("sdlc.explorer.newProjectBtn")}</span>
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
                    placeholder={t("sdlc.explorer.projectNamePlaceholder")}
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    autoFocus
                  />
                  <select
                    className="explorer-project-select"
                    value={copyTeamFromProjId}
                    onChange={(e) => setCopyTeamFromProjId(e.target.value)}
                  >
                    <option value="">
                      {t("sdlc.common.teamAndAgents")}: Default
                    </option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {t("sdlc.teamModal.cloneAllAgentsBtn")}: {p.name}
                      </option>
                    ))}
                  </select>
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn-cancel"
                      onClick={() => setIsCreatingProject(false)}
                    >
                      {t("sdlc.common.cancel")}
                    </button>
                    <button type="submit" className="btn-create">
                      {t("sdlc.common.create")}
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
                  placeholder={t("quickSearch.placeholder")}
                  value={explorerSearch}
                  onChange={(e) => setExplorerSearch(e.target.value)}
                />
              </div>

              {/* SDLC Traceability Pulse & Missing Link Auditor */}
              <div
                style={{
                  marginTop: 6,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: "var(--color-surface-low)",
                  border: "1px solid var(--default-border-color, #e5e5e5)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: "0.03em",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <span style={{ display: "inline-flex", width: 13, height: 13 }}>
                      {abacusIcon}
                    </span>
                    <span>{t("sdlc.explorer.traceabilityPulse")}</span>
                  </span>
                  <span>
                    {t("sdlc.categories.task_board")} %{pulse.taskCompletionPercent} · TDD %
                    {pulse.tddPassPercent}
                  </span>
                </div>
                <div
                  style={{
                    height: 5,
                    borderRadius: 999,
                    background: "var(--color-surface-mid)",
                    overflow: "hidden",
                    display: "flex",
                  }}
                >
                  <div
                    style={{
                      width: `${pulse.tddPassPercent}%`,
                      background: "#2f9e44",
                      transition: "width 0.25s ease",
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 3,
                    fontSize: 11,
                  }}
                >
                  {pulse.tasksMissingTDD.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 6,
                      }}
                    >
                      <span
                        style={{
                          color: "#e03131",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span style={{ display: "inline-flex", width: 13, height: 13 }}>
                          {alertTriangleIcon}
                        </span>
                        <span>
                          {t("sdlc.explorer.untestedTasksWarning", {
                            count: pulse.tasksMissingTDD.length,
                          })}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          for (const taskItem of pulse.tasksMissingTDD) {
                            generateTDDFromTask(taskItem.id);
                          }
                        }}
                        style={{
                          border: "none",
                          background: "var(--color-surface-primary-container)",
                          color: "var(--color-on-primary-container)",
                          borderRadius: 4,
                          padding: "2px 6px",
                          fontSize: 10.5,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 3,
                        }}
                      >
                        <span style={{ display: "inline-flex", width: 12, height: 12 }}>
                          {boltIcon}
                        </span>
                        <span>{t("sdlc.common.create")}</span>
                      </button>
                    </div>
                  )}
                  {pulse.tasksMissingVisualLink.length > 0 && (
                    <span
                      style={{
                        color: "#f08c00",
                        fontWeight: 600,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <span style={{ display: "inline-flex", width: 13, height: 13 }}>
                        {alertTriangleIcon}
                      </span>
                      <span>
                        {t("sdlc.explorer.unlinkedArtboardsWarning", {
                          count: pulse.tasksMissingVisualLink.length,
                        })}
                      </span>
                    </span>
                  )}
                  {pulse.redScenarios > 0 && (
                    <span style={{ color: "#e03131", fontWeight: 600 }}>
                      {pulse.redScenarios} {t("sdlc.tdd.statusRed")}
                    </span>
                  )}
                  {pulse.tasksMissingTDD.length === 0 &&
                    pulse.tasksMissingVisualLink.length === 0 &&
                    pulse.redScenarios === 0 && (
                      <span
                        style={{
                          color: "#2f9e44",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span style={{ display: "inline-flex", width: 13, height: 13 }}>
                          {checkIcon}
                        </span>
                        <span>{t("sdlc.explorer.allCoveredStatus")}</span>
                      </span>
                    )}
                </div>
              </div>
            </div>

            <div className="explorer-sections">
              {/* 1. Analysis & Architecture */}
              <div className="explorer-group">
                <div className="explorer-group-header">
                  <span>
                    {t("sdlc.categories.analysis")} &{" "}
                    {t("sdlc.categories.architecture")}
                  </span>
                  <div className="group-actions">
                    <button
                      type="button"
                      className="group-add-btn"
                      onClick={() => handleOpenCreateModal(0)}
                    >
                      + {t("sdlc.categories.analysis")}
                    </button>
                    <button
                      type="button"
                      className="group-add-btn"
                      onClick={() => handleOpenCreateModal(1)}
                    >
                      + {t("sdlc.categories.architecture")}
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
                          title={t("sdlc.common.openInSplitView")}
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
                          title={t("sdlc.common.deleteSurfaceTitle")}
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
                  <span>{t("sdlc.categories.ui_design")}</span>
                  <button
                    type="button"
                    className="group-add-btn"
                    onClick={() => handleOpenCreateModal(2)}
                  >
                    + {t("sdlc.categories.ui_design")}
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
                          title={t("sdlc.common.openInSplitView")}
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
                          title={t("sdlc.common.deleteSurfaceTitle")}
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
                  <span>{t("sdlc.categories.task_board")}</span>
                  <button
                    type="button"
                    className="group-add-btn"
                    onClick={() => handleOpenCreateModal(3)}
                  >
                    + {t("sdlc.categories.task_board")}
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
                          title={t("sdlc.common.openInSplitView")}
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
                  <span>{t("sdlc.categories.tdd_suite")}</span>
                  <button
                    type="button"
                    className="group-add-btn"
                    onClick={() => handleOpenCreateModal(4)}
                  >
                    + {t("sdlc.categories.tdd_suite")}
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
                          title={t("sdlc.common.openInSplitView")}
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

              {/* 5. Project Team & AI Agent Roster Quick Section */}
              <div className="explorer-group">
                <div className="explorer-group-header">
                  <span>
                    {t("sdlc.teamModal.tabRoster", {
                      count: projectTeamList.length,
                    })}
                  </span>
                  {onOpenTeamModal && (
                    <button
                      type="button"
                      className="group-add-btn"
                      onClick={() => {
                        setIsExplorerOpen(false);
                        onOpenTeamModal();
                      }}
                      title={t("sdlc.common.teamTitle")}
                    >
                      + {t("sdlc.common.teamAndAgents")}
                    </button>
                  )}
                </div>
                {projectTeamList.map((member) => (
                  <div
                    key={member.id}
                    className="explorer-doc-item"
                    onClick={() => {
                      if (onOpenTeamModal) {
                        setIsExplorerOpen(false);
                        onOpenTeamModal();
                      }
                    }}
                    title={
                      member.kind === "ai_agent"
                        ? `${member.name} (${member.roleLabel}) — Model: ${
                            member.modelProvider || "ollama"
                          } / ${member.modelId || "gemma4:26b"}`
                        : `${member.name} (${member.roleLabel})`
                    }
                  >
                    <span
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        backgroundColor: member.avatarColor,
                        color: "#ffffff",
                        fontSize: 9.5,
                        fontWeight: 700,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {member.kind === "ai_agent"
                        ? "AI"
                        : member.name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="doc-name">{member.name}</span>
                    {member.kind === "ai_agent" ? (
                      <span
                        className="doc-tag"
                        style={{
                          background: "var(--color-surface-primary-container)",
                          color: "var(--color-on-primary-container)",
                          maxWidth: 112,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {(member.modelId || "gemma4:26b").split("/").pop()}
                      </span>
                    ) : (
                      <span className="doc-tag">{member.roleLabel}</span>
                    )}
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
                title={t("sdlc.explorer.exportSnapshotTitle")}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-flex", width: 13, height: 13 }}>
                    {ExportIcon}
                  </span>
                  <span>{t("sdlc.explorer.exportSnapshotBtn")}</span>
                </span>
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
                title={t("sdlc.explorer.importBundleTitle")}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                  <span style={{ display: "inline-flex", width: 13, height: 13 }}>
                    {LoadIcon}
                  </span>
                  <span>{t("sdlc.explorer.importBundleBtn")}</span>
                </span>
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
              <h3>{t("sdlc.explorer.newModalTitle")}</h3>
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
                  <label htmlFor="ws-name">
                    {t("sdlc.explorer.surfaceTitleLabel")}
                  </label>
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
                  <label>{t("sdlc.explorer.categoryLabel")}</label>
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
                  <span>{t("sdlc.explorer.newModalSubtitle")}</span>
                </div>
              </div>
              <div className="new-workspace-modal__footer">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  {t("sdlc.common.cancel")}
                </button>
                <button type="submit" className="btn-primary">
                  {t("sdlc.explorer.createSurfaceBtn")}
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
              <h3>
                {t("sdlc.explorer.deleteModalTitle", {
                  title: pendingDeleteWs.name,
                })}
              </h3>
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
                {t("sdlc.explorer.deleteModalDesc", {
                  category: getCategoryLabel(pendingDeleteWs.category),
                })}
              </p>
            </div>
            <div className="new-workspace-modal__footer">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => setPendingDeleteId(null)}
              >
                {t("sdlc.common.cancel")}
              </button>
              <button
                type="button"
                className="btn-danger"
                onClick={handleConfirmDelete}
              >
                {t("sdlc.explorer.deleteSurfaceBtn")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
