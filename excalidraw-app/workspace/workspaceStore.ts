export type CanvasType = "sketch" | "design" | "tasks" | "tdd";

export type DocumentCategory =
  | "analysis"
  | "architecture"
  | "ui_design"
  | "task_board"
  | "tdd_suite";

export interface WorkspaceDocument {
  id: string;
  projectId: string;
  name: string;
  canvasType: CanvasType;
  category: DocumentCategory;
  description?: string;
  createdAt: number;
  updatedAt: number;
}

export interface SDLCProject {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  updatedAt: number;
}

export type ParticipantKind = "human" | "ai_agent";

export type ParticipantRole =
  | "developer"
  | "pm"
  | "po"
  | "architect"
  | "designer"
  | "qa";

export type AgentModelProvider = "ollama" | "openrouter" | "openai" | "custom";

export type AgentComplexityTier = "high" | "standard" | "fast";

export interface TeamMember {
  id: string;
  projectId: string;
  name: string;
  kind: ParticipantKind;
  role: ParticipantRole;
  roleLabel: string;
  avatarColor: string;
  systemPrompt?: string;
  capabilities?: string[];
  modelProvider?: AgentModelProvider;
  modelId?: string;
  complexityTier?: AgentComplexityTier;
}

export interface AIProviderGatewayConfig {
  ollamaUrl: string;
  openRouterBaseUrl: string;
  openRouterApiKey: string;
  openAiBaseUrl: string;
  openAiApiKey: string;
}

export type TaskStatus =
  | "backlog"
  | "design"
  | "in_progress"
  | "testing"
  | "done";

export type TaskPriority = "low" | "medium" | "high" | "critical";

export interface TaskCriterion {
  id: string;
  text: string;
  completed: boolean;
}

export interface TaskComment {
  id: string;
  authorId: string;
  text: string;
  createdAt: number;
}

export interface LinkedArtboardRef {
  docId: string;
  artboardId: string;
  label: string;
}

export interface LinkedSketchRef {
  docId: string;
  elementIds: string[];
  label: string;
}

export interface ProjectTask {
  id: string;
  key: string;
  projectId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  acceptanceCriteria: TaskCriterion[];
  linkedDocIds: string[];
  linkedArtboards: LinkedArtboardRef[];
  linkedSketchRefs?: LinkedSketchRef[];
  comments: TaskComment[];
  createdAt: number;
  updatedAt: number;
}

export type TDDStatus = "draft" | "red" | "green" | "refactor";
export type TDDCategory = "acceptance" | "e2e" | "integration" | "unit";

export interface TDDAssertion {
  id: string;
  text: string;
  passed: boolean;
}

export interface TDDScenario {
  id: string;
  key: string;
  projectId: string;
  title: string;
  category: TDDCategory;
  status: TDDStatus;
  given: string;
  when: string;
  then: string;
  assertions: TDDAssertion[];
  linkedTaskId: string | null;
  linkedDocIds: string[];
  assigneeId: string | null;
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY_PROJECTS = "synapdraw_projects_v1";
const STORAGE_KEY_ACTIVE_PROJECT_ID = "synapdraw_active_project_id_v1";
const STORAGE_KEY_WORKSPACES = "synapdraw_workspaces";
const STORAGE_KEY_ACTIVE_ID = "synapdraw_active_workspace_id";
const STORAGE_KEY_OPEN_TABS = "synapdraw_open_tabs_v1";
const STORAGE_KEY_SPLIT_ID = "synapdraw_split_workspace_id_v1";
const STORAGE_KEY_TASKS = "synapdraw_project_tasks_v1";
const STORAGE_KEY_TDD = "synapdraw_project_tdd_v1";
const STORAGE_KEY_TEAM = "synapdraw_project_team_v1";
const STORAGE_KEY_GATEWAY_CONFIG = "synapdraw_ai_gateway_config_v1";

export function getAIProviderGatewayConfig(): AIProviderGatewayConfig {
  const defaults: AIProviderGatewayConfig = {
    ollamaUrl: "http://127.0.0.1:11434",
    openRouterBaseUrl: "https://openrouter.ai/api/v1",
    openRouterApiKey: "",
    openAiBaseUrl: "https://api.openai.com/v1",
    openAiApiKey: "",
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY_GATEWAY_CONFIG);
    if (raw) {
      return { ...defaults, ...JSON.parse(raw) };
    }
    const legacy = localStorage.getItem("excalidraw_ai_settings");
    if (legacy) {
      const parsed = JSON.parse(legacy);
      return {
        ...defaults,
        ollamaUrl: parsed.ollamaUrl || defaults.ollamaUrl,
        openAiBaseUrl: parsed.customUrl || defaults.openAiBaseUrl,
        openAiApiKey: parsed.customApiKey || defaults.openAiApiKey,
      };
    }
  } catch {}
  return defaults;
}

export function saveAIProviderGatewayConfig(
  patch: Partial<AIProviderGatewayConfig>,
): AIProviderGatewayConfig {
  const next = { ...getAIProviderGatewayConfig(), ...patch };
  try {
    localStorage.setItem(STORAGE_KEY_GATEWAY_CONFIG, JSON.stringify(next));
    // Also keep legacy excalidraw_ai_settings in sync so AI Studio and Team Roster share gateway URLs/keys
    const rawLegacy = localStorage.getItem("excalidraw_ai_settings");
    const parsedLegacy = rawLegacy ? JSON.parse(rawLegacy) : {};
    const syncedLegacy = {
      ...parsedLegacy,
      ollamaUrl: next.ollamaUrl || parsedLegacy.ollamaUrl || "http://127.0.0.1:11434",
      customUrl: next.openAiBaseUrl || parsedLegacy.customUrl || "https://api.openai.com/v1",
      customApiKey: next.openAiApiKey || parsedLegacy.customApiKey || "",
      openRouterBaseUrl: next.openRouterBaseUrl || "https://openrouter.ai/api/v1",
      openRouterApiKey: next.openRouterApiKey || "",
    };
    localStorage.setItem("excalidraw_ai_settings", JSON.stringify(syncedLegacy));
  } catch {}
  notify();
  return next;
}

type Listener = () => void;
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn());
}

export function subscribeWorkspaces(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function inferCategory(
  canvasType: CanvasType,
  name: string,
  explicitCategory?: DocumentCategory,
): DocumentCategory {
  if (explicitCategory) return explicitCategory;
  if (canvasType === "design") return "ui_design";
  if (canvasType === "tasks") return "task_board";
  if (canvasType === "tdd") return "tdd_suite";
  const lower = name.toLowerCase();
  if (
    lower.includes("mimari") ||
    lower.includes("arch") ||
    lower.includes("er ") ||
    lower.includes("şema") ||
    lower.includes("sistem")
  ) {
    return "architecture";
  }
  return "analysis";
}

export function getCategoryLabel(category: DocumentCategory): string {
  switch (category) {
    case "analysis":
      return "Analiz";
    case "architecture":
      return "Mimari";
    case "ui_design":
      return "Tasarım";
    case "task_board":
      return "Görevler";
    case "tdd_suite":
      return "TDD Test";
  }
}

// ============================================================================
// PROJECTS
// ============================================================================

export function getProjects(): SDLCProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.error("[WorkspaceStore] Failed to read projects:", err);
  }

  const defaultProject: SDLCProject = {
    id: "proj_default",
    name: "Sipariş & Ürün Platformu",
    description:
      "Analiz, sistem mimarisi, UI/UX ekran tasarımları, görevler ve TDD test senaryoları çalışma alanı.",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  try {
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify([defaultProject]));
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT_ID, defaultProject.id);
  } catch {}

  return [defaultProject];
}

export function getActiveProjectId(): string {
  const projects = getProjects();
  const saved = localStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT_ID);
  if (saved && projects.some((p) => p.id === saved)) {
    return saved;
  }
  const fallback = projects[0].id;
  try {
    localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT_ID, fallback);
  } catch {}
  return fallback;
}

export function getActiveProject(): SDLCProject {
  const projects = getProjects();
  const activeId = getActiveProjectId();
  return projects.find((p) => p.id === activeId) || projects[0];
}

export function setActiveProjectId(projectId: string): void {
  const projects = getProjects();
  if (!projects.some((p) => p.id === projectId)) return;
  localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT_ID, projectId);

  // Ensure the project has at least basic surfaces and select its first open tab
  const projectDocs = getProjectWorkspaces(projectId);
  if (projectDocs.length > 0) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, projectDocs[0].id);
  }
  localStorage.removeItem(STORAGE_KEY_SPLIT_ID);
  notify();
}

export function createProject(
  name: string,
  description = "",
  copyTeamFromProjectId?: string,
): SDLCProject {
  const projects = getProjects();
  const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const cleanName = name.trim() || "Yeni Yazılım Projesi";
  const now = Date.now();

  const newProj: SDLCProject = {
    id,
    name: cleanName,
    description:
      description.trim() ||
      `${cleanName} için uçtan uca yazılım yaşam döngüsü alanı.`,
    createdAt: now,
    updatedAt: now,
  };

  const updatedProjects = [...projects, newProj];
  localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(updatedProjects));
  localStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT_ID, id);

  // Seed default SDLC surfaces for the new project
  const seededDocs: WorkspaceDocument[] = [
    {
      id: `ws_${now}_analysis`,
      projectId: id,
      name: `${cleanName} Analizi`,
      canvasType: "sketch",
      category: "analysis",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `ws_${now}_arch`,
      projectId: id,
      name: "Sistem Mimarisi",
      canvasType: "sketch",
      category: "architecture",
      createdAt: now + 1,
      updatedAt: now + 1,
    },
    {
      id: `ws_${now}_design`,
      projectId: id,
      name: "Ekran Tasarımları",
      canvasType: "design",
      category: "ui_design",
      createdAt: now + 2,
      updatedAt: now + 2,
    },
    {
      id: `ws_${now}_tasks`,
      projectId: id,
      name: "Görev Panosu",
      canvasType: "tasks",
      category: "task_board",
      createdAt: now + 3,
      updatedAt: now + 3,
    },
    {
      id: `ws_${now}_tdd`,
      projectId: id,
      name: "TDD Test Senaryoları",
      canvasType: "tdd",
      category: "tdd_suite",
      createdAt: now + 4,
      updatedAt: now + 4,
    },
  ];

  const allDocs = [...getAllWorkspacesRaw(), ...seededDocs];
  localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(allDocs));
  setOpenTabIds(id, [
    seededDocs[0].id,
    seededDocs[2].id,
    seededDocs[3].id,
    seededDocs[4].id,
  ]);
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, seededDocs[0].id);
  localStorage.removeItem(STORAGE_KEY_SPLIT_ID);

  // Seed default team or clone from selected source project
  if (copyTeamFromProjectId) {
    cloneTeamMembersToProject(copyTeamFromProjectId, id, undefined, true);
  } else {
    ensureProjectTeam(id);
  }
  notify();
  return newProj;
}

export function renameProject(projectId: string, newName: string): void {
  const projects = getProjects();
  const target = projects.find((p) => p.id === projectId);
  if (!target || !newName.trim()) return;
  target.name = newName.trim();
  target.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(projects));
  notify();
}

// ============================================================================
// WORKSPACE DOCUMENTS & OPEN TABS
// ============================================================================

function getAllWorkspacesRaw(): WorkspaceDocument[] {
  const projects = getProjects();
  const defaultProjectId = projects[0].id;

  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORKSPACES);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let mutated = false;
        const normalized: WorkspaceDocument[] = parsed.map((item: any) => {
          const projectId = item.projectId || defaultProjectId;
          const canvasType: CanvasType = item.canvasType || "sketch";
          const category = inferCategory(canvasType, item.name || "", item.category);
          if (!item.projectId || !item.category) {
            mutated = true;
          }
          return {
            ...item,
            projectId,
            canvasType,
            category,
          };
        });

        // Ensure the default project also has at least one Task Board and TDD Suite
        const hasTasks = normalized.some(
          (w) => w.projectId === defaultProjectId && w.canvasType === "tasks",
        );
        const hasTdd = normalized.some(
          (w) => w.projectId === defaultProjectId && w.canvasType === "tdd",
        );
        const now = Date.now();
        if (!hasTasks) {
          normalized.push({
            id: "ws_default_tasks",
            projectId: defaultProjectId,
            name: "Proje Görev Panosu",
            canvasType: "tasks",
            category: "task_board",
            createdAt: now,
            updatedAt: now,
          });
          mutated = true;
        }
        if (!hasTdd) {
          normalized.push({
            id: "ws_default_tdd",
            projectId: defaultProjectId,
            name: "TDD Test Senaryoları",
            canvasType: "tdd",
            category: "tdd_suite",
            createdAt: now + 1,
            updatedAt: now + 1,
          });
          mutated = true;
        }

        if (mutated) {
          localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(normalized));
        }
        return normalized;
      }
    }
  } catch (err) {
    console.error("[WorkspaceStore] Failed to read workspaces:", err);
  }

  const now = Date.now();
  const defaultDocs: WorkspaceDocument[] = [
    {
      id: "ws_default_sketch",
      projectId: defaultProjectId,
      name: "Sipariş Ekranı Analizi",
      canvasType: "sketch",
      category: "analysis",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: "ws_default_design",
      projectId: defaultProjectId,
      name: "Sipariş Ekranı Tasarımları",
      canvasType: "design",
      category: "ui_design",
      createdAt: now + 1,
      updatedAt: now + 1,
    },
    {
      id: "ws_default_tasks",
      projectId: defaultProjectId,
      name: "Proje Görev Panosu",
      canvasType: "tasks",
      category: "task_board",
      createdAt: now + 2,
      updatedAt: now + 2,
    },
    {
      id: "ws_default_tdd",
      projectId: defaultProjectId,
      name: "TDD Test Senaryoları",
      canvasType: "tdd",
      category: "tdd_suite",
      createdAt: now + 3,
      updatedAt: now + 3,
    },
  ];

  try {
    const legacyElements = localStorage.getItem("excalidraw");
    if (legacyElements) {
      localStorage.setItem(
        `synapdraw_ws_${defaultDocs[0].id}_elements`,
        legacyElements,
      );
    }
    const legacyState = localStorage.getItem("excalidraw-state");
    if (legacyState) {
      localStorage.setItem(
        `synapdraw_ws_${defaultDocs[0].id}_state`,
        legacyState,
      );
    }
    localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(defaultDocs));
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, defaultDocs[0].id);
  } catch {}

  return defaultDocs;
}

export function getProjectWorkspaces(projectId?: string): WorkspaceDocument[] {
  const pid = projectId || getActiveProjectId();
  return getAllWorkspacesRaw().filter((w) => w.projectId === pid);
}

export function getWorkspaces(): WorkspaceDocument[] {
  return getProjectWorkspaces(getActiveProjectId());
}

export function getOpenTabIds(projectId?: string): string[] {
  const pid = projectId || getActiveProjectId();
  const projectDocs = getProjectWorkspaces(pid);
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_OPEN_TABS}_${pid}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const valid = parsed.filter((id) => projectDocs.some((d) => d.id === id));
        if (valid.length > 0) {
          return valid;
        }
      }
    }
  } catch {}

  const initialIds = projectDocs.map((d) => d.id);
  setOpenTabIds(pid, initialIds);
  return initialIds;
}

export function setOpenTabIds(projectId: string, ids: string[]): void {
  try {
    localStorage.setItem(
      `${STORAGE_KEY_OPEN_TABS}_${projectId}`,
      JSON.stringify(Array.from(new Set(ids))),
    );
  } catch {}
}

export function getOpenWorkspaces(projectId?: string): WorkspaceDocument[] {
  const pid = projectId || getActiveProjectId();
  const projectDocs = getProjectWorkspaces(pid);
  const openIds = getOpenTabIds(pid);
  const activeId = getActiveWorkspaceId();

  // Always ensure the active workspace is visible in open tabs
  if (activeId && !openIds.includes(activeId)) {
    openIds.push(activeId);
    setOpenTabIds(pid, openIds);
  }

  return openIds
    .map((id) => projectDocs.find((d) => d.id === id))
    .filter((d): d is WorkspaceDocument => Boolean(d));
}

export function closeWorkspaceTab(id: string): void {
  const pid = getActiveProjectId();
  const openIds = getOpenTabIds(pid);
  if (openIds.length <= 1) {
    return; // Keep at least 1 tab open
  }
  const filtered = openIds.filter((tabId) => tabId !== id);
  setOpenTabIds(pid, filtered);

  if (getActiveWorkspaceId() === id && filtered.length > 0) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, filtered[filtered.length - 1]);
  }
  notify();
}

export function getActiveWorkspaceId(): string {
  const workspaces = getWorkspaces();
  const savedId = localStorage.getItem(STORAGE_KEY_ACTIVE_ID);
  if (savedId && workspaces.some((w) => w.id === savedId)) {
    return savedId;
  }
  const fallback = workspaces[0]?.id || "ws_default_sketch";
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, fallback);
  return fallback;
}

export function getActiveWorkspace(): WorkspaceDocument {
  const workspaces = getWorkspaces();
  const activeId = getActiveWorkspaceId();
  return workspaces.find((w) => w.id === activeId) || workspaces[0];
}

export function setActiveWorkspaceId(id: string): void {
  const pid = getActiveProjectId();
  const openIds = getOpenTabIds(pid);
  if (!openIds.includes(id)) {
    setOpenTabIds(pid, [...openIds, id]);
  }
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
  notify();
}

export function getSplitWorkspaceId(): string | null {
  const splitId = localStorage.getItem(STORAGE_KEY_SPLIT_ID);
  if (!splitId) return null;
  const workspaces = getWorkspaces();
  if (workspaces.some((w) => w.id === splitId)) {
    return splitId;
  }
  return null;
}

export function getSplitWorkspace(): WorkspaceDocument | null {
  const splitId = getSplitWorkspaceId();
  if (!splitId) return null;
  return getWorkspaces().find((w) => w.id === splitId) || null;
}

export function setSplitWorkspaceId(id: string | null): void {
  const currentActive = getActiveWorkspace();
  if (!id || id === currentActive.id) {
    localStorage.removeItem(STORAGE_KEY_SPLIT_ID);
    notify();
    return;
  }

  const targetDoc = getWorkspaces().find((w) => w.id === id);
  if (
    targetDoc &&
    targetDoc.canvasType === "sketch" &&
    currentActive.canvasType !== "sketch"
  ) {
    // Place the singleton Excalidraw sketch canvas in the primary left pane
    // and the current surface (design / tasks / tdd) in the right split pane
    // so both are 100% live and interactive simultaneously.
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, targetDoc.id);
    localStorage.setItem(STORAGE_KEY_SPLIT_ID, currentActive.id);
  } else {
    localStorage.setItem(STORAGE_KEY_SPLIT_ID, id);
  }
  notify();
}

export function createWorkspace(
  name: string,
  canvasType: CanvasType,
  explicitCategory?: DocumentCategory,
  description?: string,
): WorkspaceDocument {
  const allDocs = getAllWorkspacesRaw();
  const pid = getActiveProjectId();
  const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const defaultTitleMap: Record<CanvasType, string> = {
    sketch: explicitCategory === "architecture" ? "Mimari Taslak" : "Yeni Analiz",
    design: "Yeni Ekran Tasarımı",
    tasks: "Görev Panosu",
    tdd: "TDD Test Senaryoları",
  };

  const cleanName = name.trim() || defaultTitleMap[canvasType];
  const category = inferCategory(canvasType, cleanName, explicitCategory);

  const newDoc: WorkspaceDocument = {
    id,
    projectId: pid,
    name: cleanName,
    canvasType,
    category,
    description: description?.trim(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  const updated = [...allDocs, newDoc];
  localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(updated));

  const openIds = getOpenTabIds(pid);
  setOpenTabIds(pid, [...openIds, id]);
  localStorage.setItem(STORAGE_KEY_ACTIVE_ID, id);
  notify();
  return newDoc;
}

export function deleteWorkspace(id: string): boolean {
  const pid = getActiveProjectId();
  const projectDocs = getProjectWorkspaces(pid);
  if (projectDocs.length <= 1) {
    return false;
  }

  const allDocs = getAllWorkspacesRaw();
  const updated = allDocs.filter((w) => w.id !== id);
  localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(updated));

  try {
    localStorage.removeItem(`synapdraw_ws_${id}_elements`);
    localStorage.removeItem(`synapdraw_ws_${id}_state`);
    localStorage.removeItem(`synapdraw_design_doc_${id}`);
  } catch {}

  // Clean up orphaned references in tasks and TDD scenarios
  try {
    const allTasks = getAllTasksRaw();
    let tasksChanged = false;
    const cleanedTasks = allTasks.map((t) => {
      const nextDocs = (t.linkedDocIds || []).filter((docId) => docId !== id);
      const nextArtboards = (t.linkedArtboards || []).filter(
        (la) => la.docId !== id,
      );
      const nextSketches = (t.linkedSketchRefs || []).filter(
        (sr) => sr.docId !== id,
      );
      if (
        nextDocs.length !== (t.linkedDocIds || []).length ||
        nextArtboards.length !== (t.linkedArtboards || []).length ||
        nextSketches.length !== (t.linkedSketchRefs || []).length
      ) {
        tasksChanged = true;
        return {
          ...t,
          linkedDocIds: nextDocs,
          linkedArtboards: nextArtboards,
          linkedSketchRefs: nextSketches,
          updatedAt: Date.now(),
        };
      }
      return t;
    });
    if (tasksChanged) {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(cleanedTasks));
    }

    const allTdd = getAllTDDRaw();
    let tddChanged = false;
    const cleanedTdd = allTdd.map((s) => {
      const nextDocs = (s.linkedDocIds || []).filter((docId) => docId !== id);
      if (nextDocs.length !== (s.linkedDocIds || []).length) {
        tddChanged = true;
        return { ...s, linkedDocIds: nextDocs, updatedAt: Date.now() };
      }
      return s;
    });
    if (tddChanged) {
      localStorage.setItem(STORAGE_KEY_TDD, JSON.stringify(cleanedTdd));
    }
  } catch {}

  const openIds = getOpenTabIds(pid).filter((tabId) => tabId !== id);
  const remainingProjectDocs = updated.filter((w) => w.projectId === pid);
  if (openIds.length === 0 && remainingProjectDocs.length > 0) {
    openIds.push(remainingProjectDocs[0].id);
  }
  setOpenTabIds(pid, openIds);

  if (getActiveWorkspaceId() === id && openIds.length > 0) {
    localStorage.setItem(STORAGE_KEY_ACTIVE_ID, openIds[0]);
  }
  if (getSplitWorkspaceId() === id) {
    localStorage.removeItem(STORAGE_KEY_SPLIT_ID);
  }

  notify();
  return true;
}

export function renameWorkspace(id: string, newName: string): void {
  const allDocs = getAllWorkspacesRaw();
  const target = allDocs.find((w) => w.id === id);
  if (!target || !newName.trim()) return;

  target.name = newName.trim();
  target.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY_WORKSPACES, JSON.stringify(allDocs));
  notify();
}

// ============================================================================
// TEAM & AI AGENT ROSTER
// ============================================================================

function getDefaultTeamForProject(projectId: string): TeamMember[] {
  return [
    {
      id: `${projectId}_human_dev`,
      projectId,
      name: "Baş Yazılımcı (Sen)",
      kind: "human",
      role: "developer",
      roleLabel: "Full-Stack Yazılımcı",
      avatarColor: "#6965db",
    },
    {
      id: `${projectId}_human_po`,
      projectId,
      name: "Ürün Sahibi (PO)",
      kind: "human",
      role: "po",
      roleLabel: "Product Owner",
      avatarColor: "#0ca678",
    },
    {
      id: `${projectId}_agent_analyst`,
      projectId,
      name: "Analist & PO Agent",
      kind: "ai_agent",
      role: "po",
      roleLabel: "AI İş Analisti",
      avatarColor: "#7950f2",
      systemPrompt:
        "Kullanıcı gereksinimlerini analiz diyagramlarına, kullanıcı hikayelerine ve kabul kriterlerine dönüştürür.",
      capabilities: ["render_mermaid", "create_or_update_task"],
      modelProvider: "ollama",
      modelId: "gemma4:26b",
      complexityTier: "standard",
    },
    {
      id: `${projectId}_agent_arch`,
      projectId,
      name: "Sistem Mimarı Agent",
      kind: "ai_agent",
      role: "architect",
      roleLabel: "AI Sistem Mimarı",
      avatarColor: "#1c7ed6",
      systemPrompt:
        "Servis sınırlarını, veri akışlarını ve ER şemalarını Excalidraw mimari tuvallerinde modeller.",
      capabilities: ["render_mermaid", "create_view"],
      modelProvider: "openrouter",
      modelId: "anthropic/claude-3.7-sonnet",
      complexityTier: "high",
    },
    {
      id: `${projectId}_agent_ui`,
      projectId,
      name: "UI/UX Tasarımcı Agent",
      kind: "ai_agent",
      role: "designer",
      roleLabel: "AI UI/UX Tasarımcı",
      avatarColor: "#e64980",
      systemPrompt:
        "Analiz ve görev kabul kriterlerini temel alarak Tasarım Tuvalinde pixel-perfect CSS/HTML ekranlar üretir.",
      capabilities: ["render_design", "update_node_styles"],
      modelProvider: "openrouter",
      modelId: "google/gemini-2.5-pro",
      complexityTier: "high",
    },
    {
      id: `${projectId}_agent_tdd`,
      projectId,
      name: "TDD & QA Agent",
      kind: "ai_agent",
      role: "qa",
      roleLabel: "AI Test Mühendisi",
      avatarColor: "#f59f00",
      systemPrompt:
        "TDD disiplinine göre Given/When/Then test senaryolarını ve uç durum (edge-case) kontrollerini hazırlar.",
      capabilities: ["upsert_tdd_scenario", "list_tdd_scenarios"],
      modelProvider: "ollama",
      modelId: "qwen2.5-coder:7b",
      complexityTier: "fast",
    },
  ];
}

function getAllTeamRaw(): TeamMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TEAM);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  const pid = getActiveProjectId();
  const seeded = getDefaultTeamForProject(pid);
  try {
    localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(seeded));
  } catch {}
  return seeded;
}

export function ensureProjectTeam(projectId?: string): TeamMember[] {
  const pid = projectId || getActiveProjectId();
  const all = getAllTeamRaw();
  const forProject = all.filter((m) => m.projectId === pid);
  if (forProject.length > 0) {
    return forProject;
  }
  const seeded = getDefaultTeamForProject(pid);
  const updated = [...all, ...seeded];
  try {
    localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(updated));
  } catch {}
  return seeded;
}

export function getProjectTeam(projectId?: string): TeamMember[] {
  return ensureProjectTeam(projectId);
}

export function addTeamMember(
  member: Omit<TeamMember, "id" | "projectId">,
  projectId?: string,
): TeamMember {
  const pid = projectId || getActiveProjectId();
  const all = getAllTeamRaw();
  const newMember: TeamMember = {
    ...member,
    id: `member_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    projectId: pid,
  };
  localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify([...all, newMember]));
  notify();
  return newMember;
}

export function removeTeamMember(memberId: string): void {
  const all = getAllTeamRaw().filter((m) => m.id !== memberId);
  localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(all));
  notify();
}

export function updateTeamMember(
  memberId: string,
  patch: Partial<Omit<TeamMember, "id" | "projectId">>,
): TeamMember | null {
  const all = getAllTeamRaw();
  const idx = all.findIndex((m) => m.id === memberId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    ...patch,
  };
  localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(all));
  notify();
  return all[idx];
}

export function cloneTeamMembersToProject(
  sourceProjectId: string,
  targetProjectId?: string,
  memberIds?: string[],
  replaceExisting = false,
): TeamMember[] {
  const dstPid = targetProjectId || getActiveProjectId();
  const sourceTeam = getProjectTeam(sourceProjectId);
  const toClone =
    Array.isArray(memberIds) && memberIds.length > 0
      ? sourceTeam.filter((m) => memberIds.includes(m.id))
      : sourceTeam;

  if (toClone.length === 0) {
    return getProjectTeam(dstPid);
  }

  const all = getAllTeamRaw();
  const remaining = replaceExisting
    ? all.filter((m) => m.projectId !== dstPid)
    : all;
  const existingTarget = remaining.filter((m) => m.projectId === dstPid);

  const clonedMembers: TeamMember[] = [];
  for (const src of toClone) {
    // Avoid duplicate names when merging
    const alreadyExists = existingTarget.some(
      (m) => m.name.toLowerCase() === src.name.toLowerCase() && m.kind === src.kind,
    );
    if (alreadyExists && !replaceExisting) {
      continue;
    }
    clonedMembers.push({
      ...src,
      id: `member_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      projectId: dstPid,
    });
  }

  const nextAll = [...remaining, ...clonedMembers];
  localStorage.setItem(STORAGE_KEY_TEAM, JSON.stringify(nextAll));
  notify();
  return getProjectTeam(dstPid);
}

// ============================================================================
// PROJECT TASKS
// ============================================================================

function getSeededTasks(projectId: string): ProjectTask[] {
  const docs = getProjectWorkspaces(projectId);
  const sketchDocs = docs.filter((d) => d.canvasType === "sketch");
  const designDocs = docs.filter((d) => d.canvasType === "design");
  const team = ensureProjectTeam(projectId);
  const devId = team.find((m) => m.role === "developer")?.id || null;
  const uiAgentId =
    team.find((m) => m.kind === "ai_agent" && m.role === "designer")?.id || null;
  const archAgentId =
    team.find((m) => m.kind === "ai_agent" && m.role === "architect")?.id || null;
  const now = Date.now();

  return [
    {
      id: `${projectId}_task_1`,
      key: "TASK-1",
      projectId,
      title: "Sipariş Ekranı İş Akışı ve Alan Analizi",
      description:
        "Sipariş oluşturma, kupon uygulama, stok kontrolü ve iptal/iade adımlarının analiz diyagramında netleştirilmesi.",
      status: "done",
      priority: "high",
      assigneeId: archAgentId,
      acceptanceCriteria: [
        {
          id: "ac_1",
          text: "Sepetten siparişe geçiş durumları çizim tuvalinde modellenmeli",
          completed: true,
        },
        {
          id: "ac_2",
          text: "Ödeme hatası ve stok yetersizliği alternatif akışları gösterilmeli",
          completed: true,
        },
      ],
      linkedDocIds: sketchDocs.map((d) => d.id),
      linkedArtboards: [],
      comments: [
        {
          id: "cmt_1",
          authorId: archAgentId || "system",
          text: "Analiz diyagramı ve temel akış düğümleri çizim tuvaline bağlandı.",
          createdAt: now - 3600_000,
        },
      ],
      createdAt: now - 7200_000,
      updatedAt: now - 3600_000,
    },
    {
      id: `${projectId}_task_2`,
      key: "TASK-2",
      projectId,
      title: "Sipariş Özeti ve Fiyatlandırma Kartı UI Tasarımı",
      description:
        "Kullanıcının sipariş özetini, plan/paket seçimini ve kupon girişini yapacağı pixel-perfect bileşenlerin Tasarım Tuvalinde hazırlanması.",
      status: "in_progress",
      priority: "critical",
      assigneeId: uiAgentId,
      acceptanceCriteria: [
        {
          id: "ac_21",
          text: "Fiyatlandırma ve sipariş özeti kartı Hug Contents veya Masaüstü çerçevesinde yer almalı",
          completed: true,
        },
        {
          id: "ac_22",
          text: "Kupon kodu hata/başarı durumları görsel olarak doğrulanmalı",
          completed: false,
        },
        {
          id: "ac_23",
          text: "Mobil (390x844) uyumlu görünüm kontrol edilmeli",
          completed: false,
        },
      ],
      linkedDocIds: [
        ...sketchDocs.slice(0, 1).map((d) => d.id),
        ...designDocs.map((d) => d.id),
      ],
      linkedArtboards: [],
      comments: [
        {
          id: "cmt_2",
          authorId: devId || "system",
          text: "Tasarım tuvalindeki bileşenleri doğrudan TDD senaryolarıyla eşleştiriyoruz.",
          createdAt: now - 1800_000,
        },
      ],
      createdAt: now - 5400_000,
      updatedAt: now - 1800_000,
    },
    {
      id: `${projectId}_task_3`,
      key: "TASK-3",
      projectId,
      title: "Sipariş Doğrulama ve Kupon Hesaplama Servisi (TDD)",
      description:
        "TDD Red-Green-Refactor döngüsüyle sipariş toplamı, KDV ve indirim kuponu doğrulama kurallarının geliştirilmesi.",
      status: "testing",
      priority: "high",
      assigneeId: devId,
      acceptanceCriteria: [
        {
          id: "ac_31",
          text: "Süresi dolmuş kuponlar için 422 doğrulama hatası dönmeli",
          completed: true,
        },
        {
          id: "ac_32",
          text: "Sepet tutarı 0'ın altına düşememeli",
          completed: true,
        },
        {
          id: "ac_33",
          text: "Tüm TDD senaryoları Green durumuna geçmeli",
          completed: false,
        },
      ],
      linkedDocIds: designDocs.map((d) => d.id),
      linkedArtboards: [],
      comments: [],
      createdAt: now - 3600_000,
      updatedAt: now - 900_000,
    },
  ];
}

function getAllTasksRaw(): ProjectTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TASKS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  const pid = getActiveProjectId();
  const seeded = getSeededTasks(pid);
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(seeded));
  } catch {}
  return seeded;
}

export function getProjectTasks(projectId?: string): ProjectTask[] {
  const pid = projectId || getActiveProjectId();
  const all = getAllTasksRaw();
  const forProject = all.filter((t) => t.projectId === pid);
  if (forProject.length > 0) {
    return forProject;
  }
  const seeded = getSeededTasks(pid);
  const updated = [...all, ...seeded];
  try {
    localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(updated));
  } catch {}
  return seeded;
}

export function createProjectTask(
  input: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string | null;
    acceptanceCriteria?: string[];
    linkedDocIds?: string[];
  },
  projectId?: string,
): ProjectTask {
  const pid = projectId || getActiveProjectId();
  const all = getAllTasksRaw();
  const existingForProj = all.filter((t) => t.projectId === pid);
  const maxNum = existingForProj.reduce((max, t) => {
    const m = typeof t.key === "string" ? t.key.match(/(\d+)$/) : null;
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const nextNum = maxNum + 1;
  const now = Date.now();

  const newTask: ProjectTask = {
    id: `task_${now}_${Math.random().toString(36).substring(2, 6)}`,
    key: `TASK-${nextNum}`,
    projectId: pid,
    title: input.title.trim() || "Yeni Görev",
    description: input.description?.trim() || "",
    status: input.status || "backlog",
    priority: input.priority || "medium",
    assigneeId: input.assigneeId ?? null,
    acceptanceCriteria: (input.acceptanceCriteria || []).map((item: any, idx) => ({
      id: `ac_${now}_${idx}`,
      text: typeof item === "string" ? item : String(item?.text || ""),
      completed: Boolean(item?.completed),
    })),
    linkedDocIds: input.linkedDocIds || [],
    linkedArtboards: [],
    comments: [],
    createdAt: now,
    updatedAt: now,
  };

  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify([...all, newTask]));
  notify();
  return newTask;
}

export function updateProjectTask(
  taskId: string,
  patch: Partial<Omit<ProjectTask, "id" | "projectId">>,
): ProjectTask | null {
  const all = getAllTasksRaw();
  const idx = all.findIndex((t) => t.id === taskId);
  if (idx === -1) return null;

  const updated: ProjectTask = {
    ...all[idx],
    ...patch,
    updatedAt: Date.now(),
  };
  all[idx] = updated;
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(all));
  notify();
  return updated;
}

export function deleteProjectTask(taskId: string): void {
  const all = getAllTasksRaw().filter((t) => t.id !== taskId);
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(all));

  // Unlink any TDD scenarios pointing to this deleted task
  try {
    const allTdd = getAllTDDRaw();
    let changed = false;
    const cleaned = allTdd.map((s) => {
      if (s.linkedTaskId === taskId) {
        changed = true;
        return { ...s, linkedTaskId: null, updatedAt: Date.now() };
      }
      return s;
    });
    if (changed) {
      localStorage.setItem(STORAGE_KEY_TDD, JSON.stringify(cleaned));
    }
  } catch {}

  notify();
}

export function addTaskComment(
  taskId: string,
  authorId: string,
  text: string,
): void {
  if (!text.trim()) return;
  const all = getAllTasksRaw();
  const target = all.find((t) => t.id === taskId);
  if (!target) return;
  target.comments.push({
    id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    authorId,
    text: text.trim(),
    createdAt: Date.now(),
  });
  target.updatedAt = Date.now();
  localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(all));
  notify();
}

// ============================================================================
// TDD & TEST SCENARIOS
// ============================================================================

function getSeededTDDScenarios(projectId: string): TDDScenario[] {
  const tasks = getProjectTasks(projectId);
  const docs = getProjectWorkspaces(projectId);
  const designDocs = docs.filter((d) => d.canvasType === "design");
  const sketchDocs = docs.filter((d) => d.canvasType === "sketch");
  const team = ensureProjectTeam(projectId);
  const qaAgentId =
    team.find((m) => m.kind === "ai_agent" && m.role === "qa")?.id || null;
  const now = Date.now();

  return [
    {
      id: `${projectId}_tdd_1`,
      key: "TEST-1",
      projectId,
      title: "Geçerli Sipariş ve Plan Seçimi Akışı",
      category: "acceptance",
      status: "green",
      given:
        "Kullanıcı Sipariş Ekranında aktif bir plan/ürün seçmiş ve stok mevcuttur",
      when: "'Hemen Başla / Siparişi Tamamla' aksiyonunu tetikler",
      then: "Sipariş özeti doğrulanır ve ödeme adımına hatasız geçilir",
      assertions: [
        {
          id: "as_1",
          text: "Plan başlığı ve fiyat bilgisi ($49/ay) doğru render edilir",
          passed: true,
        },
        {
          id: "as_2",
          text: "CTA butonu tıklanabilir ve fokus durumunu korur",
          passed: true,
        },
      ],
      linkedTaskId: tasks[1]?.id || tasks[0]?.id || null,
      linkedDocIds: [
        ...designDocs.map((d) => d.id),
        ...sketchDocs.slice(0, 1).map((d) => d.id),
      ],
      assigneeId: qaAgentId,
      createdAt: now - 5000_000,
      updatedAt: now - 1200_000,
    },
    {
      id: `${projectId}_tdd_2`,
      key: "TEST-2",
      projectId,
      title: "Süresi Dolmuş veya Geçersiz İndirim Kuponu Reddi",
      category: "integration",
      status: "red",
      given: "Kullanıcı ödeme adımında süresi geçmiş 'EXPIRED2026' kuponunu girer",
      when: "'Kuponu Uygula' butonuna tıklar",
      then: "422 hatası döner, uyarı mesajı gösterilir ve sepet tutarı değişmez",
      assertions: [
        {
          id: "as_21",
          text: "Toplam tutar orijinal fiyatta kalır",
          passed: true,
        },
        {
          id: "as_22",
          text: "Kullanıcıya kırmızı doğrulama rozeti gösterilir",
          passed: false,
        },
      ],
      linkedTaskId: tasks[2]?.id || tasks[1]?.id || null,
      linkedDocIds: designDocs.map((d) => d.id),
      assigneeId: qaAgentId,
      createdAt: now - 3600_000,
      updatedAt: now - 600_000,
    },
    {
      id: `${projectId}_tdd_3`,
      key: "TEST-3",
      projectId,
      title: "Negatif Sepet Tutarı Koruması (Boundary Test)",
      category: "unit",
      status: "refactor",
      given: "Sepet tutarı 49 TL ve sabit indirim kuponu 100 TL olarak tanımlanmıştır",
      when: "İndirim hesaplama fonksiyonu çalıştırılır",
      then: "Net ödenecek tutar negatif olmaz, minimum 0 TL olarak sınırlandırılır",
      assertions: [
        {
          id: "as_31",
          text: "calculateNetTotal(49, 100) === 0 döner",
          passed: true,
        },
      ],
      linkedTaskId: tasks[2]?.id || null,
      linkedDocIds: sketchDocs.slice(0, 1).map((d) => d.id),
      assigneeId: qaAgentId,
      createdAt: now - 2400_000,
      updatedAt: now - 300_000,
    },
  ];
}

function getAllTDDRaw(): TDDScenario[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_TDD);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {}
  const pid = getActiveProjectId();
  const seeded = getSeededTDDScenarios(pid);
  try {
    localStorage.setItem(STORAGE_KEY_TDD, JSON.stringify(seeded));
  } catch {}
  return seeded;
}

export function getProjectTDDScenarios(projectId?: string): TDDScenario[] {
  const pid = projectId || getActiveProjectId();
  const all = getAllTDDRaw();
  const forProject = all.filter((s) => s.projectId === pid);
  if (forProject.length > 0) {
    return forProject;
  }
  const seeded = getSeededTDDScenarios(pid);
  const updated = [...all, ...seeded];
  try {
    localStorage.setItem(STORAGE_KEY_TDD, JSON.stringify(updated));
  } catch {}
  return seeded;
}

export function createTDDScenario(
  input: {
    title: string;
    category?: TDDCategory;
    status?: TDDStatus;
    given: string;
    when: string;
    then: string;
    assertions?: Array<string | { text?: string; description?: string; passed?: boolean }>;
    linkedTaskId?: string | null;
    linkedDocIds?: string[];
    assigneeId?: string | null;
  },
  projectId?: string,
): TDDScenario {
  const pid = projectId || getActiveProjectId();
  const all = getAllTDDRaw();
  const existingForProj = all.filter((s) => s.projectId === pid);
  const maxNum = existingForProj.reduce((max, s) => {
    const m = typeof s.key === "string" ? s.key.match(/(\d+)$/) : null;
    return m ? Math.max(max, parseInt(m[1], 10)) : max;
  }, 0);
  const nextNum = maxNum + 1;
  const now = Date.now();

  const scenario: TDDScenario = {
    id: `tdd_${now}_${Math.random().toString(36).substring(2, 6)}`,
    key: `TEST-${nextNum}`,
    projectId: pid,
    title: input.title.trim() || "Yeni TDD Test Senaryosu",
    category: input.category || "acceptance",
    status: input.status || "red",
    given: input.given.trim() || "Başlangıç koşulu",
    when: input.when.trim() || "Tetiklenen eylem",
    then: input.then.trim() || "Beklenen sonuç",
    assertions: (input.assertions || []).map((item, idx) => ({
      id: `as_${now}_${idx}`,
      text:
        typeof item === "string"
          ? item
          : String(item?.text || item?.description || ""),
      passed: typeof item === "object" && item !== null ? Boolean(item.passed) : false,
    })),
    linkedTaskId: input.linkedTaskId ?? null,
    linkedDocIds: input.linkedDocIds || [],
    assigneeId: input.assigneeId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  localStorage.setItem(STORAGE_KEY_TDD, JSON.stringify([...all, scenario]));
  notify();
  return scenario;
}

export function updateTDDScenario(
  scenarioId: string,
  patch: Partial<Omit<TDDScenario, "id" | "projectId">>,
): TDDScenario | null {
  const all = getAllTDDRaw();
  const idx = all.findIndex((s) => s.id === scenarioId);
  if (idx === -1) return null;

  const updated: TDDScenario = {
    ...all[idx],
    ...patch,
    updatedAt: Date.now(),
  };
  all[idx] = updated;
  localStorage.setItem(STORAGE_KEY_TDD, JSON.stringify(all));

  // Bidirectional state propagation: when a TDD scenario becomes green/refactor,
  // sync matching acceptance criteria on the linked task
  if (
    updated.linkedTaskId &&
    (updated.status === "green" || updated.status === "refactor")
  ) {
    try {
      const allTasks = getAllTasksRaw();
      const tIdx = allTasks.findIndex((t) => t.id === updated.linkedTaskId);
      if (tIdx !== -1) {
        const targetTask = allTasks[tIdx];
        let criteriaChanged = false;
        const nextCriteria = targetTask.acceptanceCriteria.map((crit) => {
          if (crit.completed) return crit;
          const matchesThen =
            updated.then &&
            (updated.then.toLowerCase().includes(crit.text.toLowerCase()) ||
              crit.text.toLowerCase().includes(updated.then.toLowerCase()));
          const matchesAssertion = updated.assertions.some(
            (a) =>
              a.passed &&
              a.text.toLowerCase().includes(crit.text.toLowerCase()),
          );
          if (matchesThen || matchesAssertion) {
            criteriaChanged = true;
            return { ...crit, completed: true };
          }
          return crit;
        });

        if (criteriaChanged) {
          allTasks[tIdx] = {
            ...targetTask,
            acceptanceCriteria: nextCriteria,
            updatedAt: Date.now(),
          };
          localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(allTasks));
        }
      }
    } catch {}
  }

  notify();
  return updated;
}

export function deleteTDDScenario(scenarioId: string): void {
  const all = getAllTDDRaw().filter((s) => s.id !== scenarioId);
  localStorage.setItem(STORAGE_KEY_TDD, JSON.stringify(all));
  notify();
}

export function generateTDDFromTask(taskId: string): TDDScenario[] {
  const tasks = getProjectTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return [];

  const existing = getProjectTDDScenarios();
  const team = getProjectTeam();
  const qaAgentId =
    team.find((m) => m.kind === "ai_agent" && m.role === "qa")?.id || null;

  const created: TDDScenario[] = [];
  const criteria =
    task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria
      : [{ id: "default", text: task.title, completed: false }];

  for (const crit of criteria) {
    const alreadyExists = existing.some(
      (s) => s.linkedTaskId === task.id && s.then.includes(crit.text),
    );
    if (alreadyExists) continue;

    const sc = createTDDScenario({
      title: `${task.key}: ${crit.text.slice(0, 64)}`,
      category: "acceptance",
      status: crit.completed ? "green" : "red",
      given: `"${task.title}" görevi kapsamında ilgili ekran/servis hazırdır`,
      when: "Kullanıcı veya istemci ilgili iş akışını tetikler",
      then: crit.text,
      assertions: [crit.text],
      linkedTaskId: task.id,
      linkedDocIds: task.linkedDocIds,
      assigneeId: qaAgentId,
    });
    created.push(sc);
  }

  return created;
}

// ============================================================================
// ARTBOARD DEEP-LINKING & AUTO-FOCUS
// ============================================================================

const pendingArtboardFocusMap: Record<string, string> = {};

export function requestArtboardFocus(
  docId: string,
  artboardId: string,
  openInSplit = false,
): void {
  pendingArtboardFocusMap[docId] = artboardId;
  if (openInSplit) {
    setSplitWorkspaceId(docId);
  } else {
    setActiveWorkspaceId(docId);
  }
  notify();
}

export function consumePendingArtboardFocus(docId: string): string | null {
  const target = pendingArtboardFocusMap[docId] || null;
  if (target) {
    delete pendingArtboardFocusMap[docId];
  }
  return target;
}

export function toggleTaskArtboardLink(
  taskId: string,
  link: LinkedArtboardRef,
): ProjectTask | null {
  const tasks = getProjectTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const currentLinks = Array.isArray(task.linkedArtboards)
    ? task.linkedArtboards
    : [];
  const exists = currentLinks.some(
    (item) => item.docId === link.docId && item.artboardId === link.artboardId,
  );

  const nextArtboards = exists
    ? currentLinks.filter(
        (item) =>
          !(item.docId === link.docId && item.artboardId === link.artboardId),
      )
    : [...currentLinks, link];

  const nextDocIds = exists
    ? task.linkedDocIds
    : Array.from(new Set([...task.linkedDocIds, link.docId]));

  return updateProjectTask(task.id, {
    linkedArtboards: nextArtboards,
    linkedDocIds: nextDocIds,
  });
}

export function cleanupDeletedArtboardLinks(
  docId: string,
  artboardId: string,
): void {
  try {
    const allTasks = getAllTasksRaw();
    let changed = false;
    const cleaned = allTasks.map((t) => {
      const current = Array.isArray(t.linkedArtboards) ? t.linkedArtboards : [];
      const next = current.filter(
        (la) => !(la.docId === docId && la.artboardId === artboardId),
      );
      if (next.length !== current.length) {
        changed = true;
        return { ...t, linkedArtboards: next, updatedAt: Date.now() };
      }
      return t;
    });
    if (changed) {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(cleaned));
      notify();
    }
  } catch {}
}

// ============================================================================
// SKETCH (EXCALIDRAW) DEEP-LINKING & AUTO-FOCUS
// ============================================================================

const pendingSketchFocusMap: Record<string, string[]> = {};

export function requestSketchFocus(
  docId: string,
  elementIds: string[],
  openInSplit = false,
): void {
  pendingSketchFocusMap[docId] = elementIds;
  if (openInSplit) {
    setSplitWorkspaceId(docId);
  } else {
    setActiveWorkspaceId(docId);
  }
  notify();
}

export function consumePendingSketchFocus(docId: string): string[] | null {
  const target = pendingSketchFocusMap[docId] || null;
  if (target) {
    delete pendingSketchFocusMap[docId];
  }
  return target;
}

export function toggleTaskSketchLink(
  taskId: string,
  link: LinkedSketchRef,
): ProjectTask | null {
  const tasks = getProjectTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return null;

  const currentLinks = Array.isArray(task.linkedSketchRefs)
    ? task.linkedSketchRefs
    : [];
  const exists = currentLinks.some(
    (item) => item.docId === link.docId && item.label === link.label,
  );

  const nextSketchRefs = exists
    ? currentLinks.filter(
        (item) => !(item.docId === link.docId && item.label === link.label),
      )
    : [...currentLinks, link];

  const nextDocIds = exists
    ? task.linkedDocIds
    : Array.from(new Set([...task.linkedDocIds, link.docId]));

  return updateProjectTask(task.id, {
    linkedSketchRefs: nextSketchRefs,
    linkedDocIds: nextDocIds,
  });
}

// ============================================================================
// AI AGENT TASK ORCHESTRATION ("AI AGENT İLE ÇALIŞTIR")
// ============================================================================

export function executeAgentOnTask(
  taskId: string,
  mode: "auto" | "architecture" | "design" | "tdd" | "analysis" = "auto",
  ownerWindow: Window = window,
): {
  summary: string;
  targetDocId?: string;
  targetArtboardId?: string;
  targetSketchElementIds?: string[];
} {
  const tasks = getProjectTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return { summary: "Görev bulunamadı." };
  }

  const team = getProjectTeam(task.projectId);
  const assignedMember = team.find((m) => m.id === task.assigneeId);

  let resolvedMode: "architecture" | "design" | "tdd" | "analysis" = "design";
  if (mode !== "auto") {
    resolvedMode = mode;
  } else if (assignedMember?.role === "qa" || task.status === "testing") {
    resolvedMode = "tdd";
  } else if (assignedMember?.role === "architect") {
    resolvedMode = "architecture";
  } else if (assignedMember?.role === "po" || task.status === "backlog") {
    resolvedMode = "analysis";
  } else {
    resolvedMode = "design";
  }

  const docs = getProjectWorkspaces(task.projectId);

  if (resolvedMode === "architecture") {
    const archAgent =
      team.find((m) => m.kind === "ai_agent" && m.role === "architect") ||
      assignedMember;

    let archDoc =
      docs.find(
        (d) =>
          d.canvasType === "sketch" &&
          d.category === "architecture" &&
          task.linkedDocIds.includes(d.id),
      ) ||
      docs.find(
        (d) => d.canvasType === "sketch" && d.category === "architecture",
      ) ||
      docs.find((d) => d.canvasType === "sketch");

    if (!archDoc) {
      archDoc = createWorkspace(
        "Sistem Mimarisi",
        "sketch",
        "architecture",
        "Servis sınırları ve sistem mimarisi şemaları",
      );
    }

    const storageKey = `synapdraw_ws_${archDoc.id}_elements`;
    let existingElements: any[] = [];
    try {
      const raw = ownerWindow.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          existingElements = parsed.filter((el: any) => !el.isDeleted);
        }
      }
    } catch {}

    let maxRight = 80;
    let baseY = 100;
    for (const el of existingElements) {
      if (typeof el.x === "number" && typeof el.width === "number") {
        maxRight = Math.max(maxRight, el.x + el.width + 120);
      }
    }
    const originX = existingElements.length > 0 ? maxRight : 100;
    const originY = baseY;
    const now = Date.now();
    const prefix = `arch_${now}`;

    const makeRect = (
      id: string,
      x: number,
      y: number,
      w: number,
      h: number,
      bg: string,
      stroke: string,
    ) => ({
      type: "rectangle",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1_000_000),
      isDeleted: false,
      id,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x,
      y,
      strokeColor: stroke,
      backgroundColor: bg,
      width: w,
      height: h,
      seed: Math.floor(Math.random() * 100_000),
      groupIds: [`${prefix}_grp`],
      frameId: null,
      roundness: { type: 3 },
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
    });

    const makeText = (
      id: string,
      x: number,
      y: number,
      text: string,
      fontSize = 16,
      color = "#1e1e1e",
    ) => ({
      type: "text",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1_000_000),
      isDeleted: false,
      id,
      fillStyle: "solid",
      strokeWidth: 1,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x,
      y,
      strokeColor: color,
      backgroundColor: "transparent",
      width: Math.max(120, text.length * (fontSize * 0.54)),
      height: fontSize * 1.4,
      seed: Math.floor(Math.random() * 100_000),
      groupIds: [`${prefix}_grp`],
      frameId: null,
      roundness: null,
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
      fontSize,
      fontFamily: 1,
      text,
      textAlign: "left",
      verticalAlign: "top",
      containerId: null,
      originalText: text,
      autoResize: true,
      lineHeight: 1.25,
    });

    const makeArrow = (
      id: string,
      x: number,
      y: number,
      dx: number,
      dy: number,
    ) => ({
      type: "arrow",
      version: 1,
      versionNonce: Math.floor(Math.random() * 1_000_000),
      isDeleted: false,
      id,
      fillStyle: "solid",
      strokeWidth: 2,
      strokeStyle: "solid",
      roughness: 0,
      opacity: 100,
      angle: 0,
      x,
      y,
      strokeColor: "#495057",
      backgroundColor: "transparent",
      width: Math.abs(dx),
      height: Math.abs(dy),
      seed: Math.floor(Math.random() * 100_000),
      groupIds: [`${prefix}_grp`],
      frameId: null,
      roundness: { type: 2 },
      boundElements: [],
      updated: now,
      link: null,
      locked: false,
      points: [
        [0, 0],
        [dx, dy],
      ],
      lastCommittedPoint: null,
      startBinding: null,
      endBinding: null,
      startArrowhead: null,
      endArrowhead: "arrow",
    });

    const archNodes = [
      makeRect(
        `${prefix}_bg`,
        originX,
        originY,
        780,
        360,
        "#f8f9fa",
        "#adb5bd",
      ),
      makeText(
        `${prefix}_title`,
        originX + 24,
        originY + 18,
        `${task.key} Mimari Akışı: ${task.title.slice(0, 44)}`,
        18,
        "#1e1e1e",
      ),
      makeRect(
        `${prefix}_client`,
        originX + 30,
        originY + 80,
        190,
        85,
        "#a5d8ff",
        "#1971c2",
      ),
      makeText(
        `${prefix}_client_t`,
        originX + 46,
        originY + 112,
        "UI / İstemci Katmanı",
        15,
        "#1864ab",
      ),
      makeArrow(`${prefix}_arr1`, originX + 220, originY + 122, 70, 0),
      makeRect(
        `${prefix}_svc`,
        originX + 290,
        originY + 80,
        210,
        85,
        "#d0bfff",
        "#6741d9",
      ),
      makeText(
        `${prefix}_svc_t`,
        originX + 308,
        originY + 112,
        `${task.key} İş Mantığı Servisi`,
        15,
        "#5f3dc4",
      ),
      makeArrow(`${prefix}_arr2`, originX + 500, originY + 122, 65, 0),
      makeRect(
        `${prefix}_db`,
        originX + 565,
        originY + 80,
        185,
        85,
        "#b2f2bb",
        "#2f9e44",
      ),
      makeText(
        `${prefix}_db_t`,
        originX + 585,
        originY + 112,
        "Veri & Olay Katmanı",
        15,
        "#2b8a3e",
      ),
      makeRect(
        `${prefix}_notes`,
        originX + 30,
        originY + 205,
        720,
        125,
        "#fff3bf",
        "#f08c00",
      ),
      makeText(
        `${prefix}_notes_t`,
        originX + 48,
        originY + 222,
        `Mimari Karar & Doğrulama Kriterleri (${task.acceptanceCriteria.length} Kriter):\n` +
          (task.acceptanceCriteria
            .slice(0, 3)
            .map((c, idx) => `${idx + 1}. ${c.text.slice(0, 68)}`)
            .join("\n") || `1. ${task.title}`),
        14,
        "#1e1e1e",
      ),
    ];

    const createdIds = archNodes.map((n) => n.id);
    const mergedElements = [...existingElements, ...archNodes];
    try {
      ownerWindow.localStorage.setItem(
        storageKey,
        JSON.stringify(mergedElements),
      );
    } catch {}

    const currentSketchRefs = Array.isArray(task.linkedSketchRefs)
      ? task.linkedSketchRefs
      : [];
    const refLabel = `${task.key} Mimari Şeması`;
    const nextLinkedDocs = Array.from(
      new Set([...task.linkedDocIds, archDoc.id]),
    );

    updateProjectTask(task.id, {
      linkedDocIds: nextLinkedDocs,
      linkedSketchRefs: [
        ...currentSketchRefs,
        {
          docId: archDoc.id,
          elementIds: createdIds,
          label: refLabel,
        },
      ],
      status: task.status === "backlog" ? "design" : task.status,
    });

    addTaskComment(
      task.id,
      archAgent?.id || "system",
      `🏗️ Sistem Mimarı Agent çalıştırıldı: "${refLabel}" diyagramı "${archDoc.name}" tuvaline çizildi ve göreve pinlendi.`,
    );

    requestSketchFocus(archDoc.id, createdIds, true);

    return {
      summary: `"${refLabel}" mimari tuvale çizildi ve odaklandı`,
      targetDocId: archDoc.id,
      targetSketchElementIds: createdIds,
    };
  }

  if (resolvedMode === "tdd") {
    const qaAgent =
      team.find((m) => m.kind === "ai_agent" && m.role === "qa") ||
      assignedMember;
    const generated = generateTDDFromTask(task.id);

    // Also ensure a boundary/edge-case test exists for this task
    const allScenarios = getProjectTDDScenarios(task.projectId);
    const hasEdgeCase = allScenarios.some(
      (s) => s.linkedTaskId === task.id && s.category === "unit",
    );
    if (!hasEdgeCase) {
      const edgeSc = createTDDScenario(
        {
          title: `${task.key}: Uç Durum ve Geçersiz Veri Doğrulaması (Edge-Case)`,
          category: "unit",
          status: "red",
          given: `"${task.title}" akışında eksik veya sınır dışı parametre gönderilir`,
          when: "Doğrulama katmanı isteği işler",
          then: "Sistem güvenli hata kodu döner ve veri bütünlüğü korunur",
          assertions: [
            "Boş veya geçersiz girişte 400/422 doğrulama mesajı döner",
            "State bozulmadan kullanıcıya anlaşılır geri bildirim gösterilir",
          ],
          linkedTaskId: task.id,
          linkedDocIds: task.linkedDocIds,
          assigneeId: qaAgent?.id || null,
        },
        task.projectId,
      );
      generated.push(edgeSc);
    }

    if (task.status === "backlog" || task.status === "design") {
      updateProjectTask(task.id, { status: "testing" });
    }

    addTaskComment(
      task.id,
      qaAgent?.id || "system",
      `🧪 TDD & QA Agent çalıştırıldı: Kabul kriterleri ve uç durumlar için toplam ${
        generated.length > 0 ? `${generated.length} yeni` : "mevcut"
      } BDD (Given/When/Then) test senaryosu senkronize edildi.`,
    );

    const tddDoc = docs.find((d) => d.canvasType === "tdd");
    return {
      summary: `${
        generated.length > 0 ? `${generated.length} yeni` : "Mevcut"
      } TDD test senaryosu hazırlandı`,
      targetDocId: tddDoc?.id,
    };
  }

  if (resolvedMode === "analysis") {
    const poOrArchAgent =
      assignedMember ||
      team.find(
        (m) =>
          m.kind === "ai_agent" &&
          (m.role === "po" || m.role === "architect"),
      );

    const existingCriteria = [...task.acceptanceCriteria];
    const now = Date.now();
    if (existingCriteria.length === 0) {
      existingCriteria.push(
        {
          id: `ac_${now}_1`,
          text: `${task.title} için temel mutlu yol (happy-path) akışı tamamlanmalı`,
          completed: false,
        },
        {
          id: `ac_${now}_2`,
          text: "Hata ve sınır durumlarında kullanıcıya net geri bildirim verilmeli",
          completed: false,
        },
        {
          id: `ac_${now}_3`,
          text: "İlgili TDD kabul testleri Green statüsüne ulaşmalı",
          completed: false,
        },
      );
    } else if (existingCriteria.length < 3) {
      existingCriteria.push({
        id: `ac_${now}_extra`,
        text: "Performans, erişilebilirlik ve hata yönetimi kriterleri doğrulanmalı",
        completed: false,
      });
    }

    const analysisDocs = docs.filter((d) => d.canvasType === "sketch");
    const nextLinkedDocs = Array.from(
      new Set([
        ...task.linkedDocIds,
        ...(analysisDocs[0] ? [analysisDocs[0].id] : []),
      ]),
    );

    updateProjectTask(task.id, {
      acceptanceCriteria: existingCriteria,
      linkedDocIds: nextLinkedDocs,
      status: task.status === "backlog" ? "design" : task.status,
    });

    addTaskComment(
      task.id,
      poOrArchAgent?.id || "system",
      `📋 Analiz & Mimari Agent çalıştırıldı: Görev kabul kriterleri (${existingCriteria.length} madde) yapılandırıldı ve analiz tuvali bağlantısı güncellendi.`,
    );

    return {
      summary: `Görev analizi ve ${existingCriteria.length} kabul kriteri güncellendi`,
      targetDocId: analysisDocs[0]?.id,
    };
  }

  // Default / "design": UI/UX Tasarımcı Agent generates a pixel-perfect Artboard for the task
  const uiAgent =
    team.find((m) => m.kind === "ai_agent" && m.role === "designer") ||
    assignedMember;

  let designDoc =
    docs.find(
      (d) => d.canvasType === "design" && task.linkedDocIds.includes(d.id),
    ) || docs.find((d) => d.canvasType === "design");

  if (!designDoc) {
    designDoc = createWorkspace(
      `${task.key} UI Tasarımı`,
      "design",
      "ui_design",
      `${task.title} için ekran tasarımları`,
    );
  }

  const storageKey = `synapdraw_design_doc_${designDoc.id}`;
  let parsedDesign: any = {
    id: designDoc.id,
    name: designDoc.name,
    artboards: [],
    selectedArtboardId: null,
    selectedNodeId: null,
    zoom: 1,
    panX: 0,
    panY: 0,
  };

  try {
    const raw =
      ownerWindow.localStorage.getItem(storageKey) ||
      ownerWindow.localStorage.getItem(`excalidraw_design_doc_${designDoc.id}`);
    if (raw) {
      parsedDesign = JSON.parse(raw);
      if (!Array.isArray(parsedDesign.artboards)) {
        parsedDesign.artboards = [];
      }
    }
  } catch {}

  let nextX = 120;
  let nextY = 100;
  if (parsedDesign.artboards.length > 0) {
    const last = parsedDesign.artboards[parsedDesign.artboards.length - 1];
    const lastW =
      typeof last.width === "number" ? last.width : last.measuredWidth || 440;
    nextX = Math.round((last.x || 100) + lastW + 72);
    nextY = Math.round(last.y || 100);
  }

  const criteriaItemsHtml = (
    task.acceptanceCriteria.length > 0
      ? task.acceptanceCriteria
      : [
          {
            id: "1",
            text: "Kullanıcı odaklı, erişilebilir ve hızlı etkileşim",
            completed: true,
          },
          {
            id: "2",
            text: "Anlık doğrulama ve durum geri bildirimi",
            completed: false,
          },
        ]
  )
    .map(
      (c) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;">
        <span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:${
          c.completed ? "#dcfce7" : "#ede9fe"
        };color:${
        c.completed ? "#15803d" : "#6d28d9"
      };font-size:12px;font-weight:700;">${c.completed ? "✓" : "•"}</span>
        <span style="font-size:13px;color:#1e293b;font-weight:500;">${
          c.text
        }</span>
      </div>`,
    )
    .join("");

  const artboardId = `ab_${Date.now()}_${Math.random()
    .toString(36)
    .substring(2, 6)}`;
  const artboardName = `${task.key} · ${task.title.slice(0, 38)} (Hug Contents)`;

  const cardHtml = `<div style="width:440px;padding:28px;border-radius:18px;background:#ffffff;border:1px solid #e2e8f0;box-shadow:0 20px 40px -15px rgba(15,23,42,0.08);font-family:Assistant,system-ui,-apple-system,sans-serif;color:#0f172a;">
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
    <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;background:#ede9fe;color:#5b21b6;font-size:11px;font-weight:700;letter-spacing:0.03em;">${
      task.key
    } · UI BİLEŞENİ</span>
    <span style="font-size:12px;color:#64748b;font-weight:600;">SDLC Bağlı Ekran</span>
  </div>
  <h3 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#0f172a;line-height:1.3;">${
    task.title
  }</h3>
  <p style="margin:0 0 18px;font-size:13.5px;color:#475569;line-height:1.55;">${
    task.description ||
    "Bu bileşen görev kabul kriterlerine göre AI UI/UX Tasarımcı Agent tarafından oluşturulmuştur."
  }</p>
  <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:20px;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;">Kabul Kriterleri & Kontroller</div>
    ${criteriaItemsHtml}
  </div>
  <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:14px;border-top:1px solid #f1f5f9;">
    <button style="flex:1;padding:11px 16px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;color:#334155;font-size:13px;font-weight:700;cursor:pointer;">İptal / Geri</button>
    <button style="flex:1.4;padding:11px 16px;border-radius:10px;border:none;background:#6965db;color:#ffffff;font-size:13px;font-weight:700;cursor:pointer;box-shadow:0 4px 12px rgba(105,101,219,0.28);">Onayla ve Devam Et</button>
  </div>
</div>`;

  const newArtboard = {
    id: artboardId,
    name: artboardName,
    x: nextX,
    y: nextY,
    width: "auto",
    height: "auto",
    html: cardHtml,
    css: "",
    backgroundColor: "transparent",
    locked: false,
    allowMove: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  parsedDesign.artboards.push(newArtboard);
  parsedDesign.selectedArtboardId = artboardId;
  try {
    ownerWindow.localStorage.setItem(storageKey, JSON.stringify(parsedDesign));
  } catch {}

  const currentLinkedArtboards = Array.isArray(task.linkedArtboards)
    ? task.linkedArtboards
    : [];
  const nextLinkedDocs = Array.from(
    new Set([...task.linkedDocIds, designDoc.id]),
  );

  updateProjectTask(task.id, {
    linkedDocIds: nextLinkedDocs,
    linkedArtboards: [
      ...currentLinkedArtboards,
      {
        docId: designDoc.id,
        artboardId,
        label: artboardName,
      },
    ],
    status:
      task.status === "backlog" || task.status === "design"
        ? "in_progress"
        : task.status,
  });

  addTaskComment(
    task.id,
    uiAgent?.id || "system",
    `🎨 UI/UX Tasarımcı Agent çalıştırıldı: "${artboardName}" bileşeni "${designDoc.name}" tuvalinde üretildi ve bu göreve bağlandı.`,
  );

  requestArtboardFocus(designDoc.id, artboardId, true);

  return {
    summary: `"${artboardName}" tasarımı üretildi ve yan yana açıldı`,
    targetDocId: designDoc.id,
    targetArtboardId: artboardId,
  };
}

// ============================================================================
// PORTABLE PROJECT BUNDLE EXPORT / IMPORT (.synapdraw.json)
// ============================================================================

export interface SynapDrawProjectBundle {
  version: "1.0.0";
  exportedAt: number;
  project: SDLCProject;
  workspaces: WorkspaceDocument[];
  tasks: ProjectTask[];
  tddScenarios: TDDScenario[];
  team: TeamMember[];
  sketchScenes: Record<string, any>;
  designDocuments: Record<string, any>;
}

export function exportProjectBundle(
  projectId?: string,
  ownerWindow: Window = window,
): SynapDrawProjectBundle {
  const pid = projectId || getActiveProjectId();
  const project =
    getProjects().find((p) => p.id === pid) || getActiveProject();
  const workspaces = getProjectWorkspaces(pid);
  const tasks = getProjectTasks(pid);
  const tddScenarios = getProjectTDDScenarios(pid);
  const team = getProjectTeam(pid);

  const sketchScenes: Record<string, any> = {};
  const designDocuments: Record<string, any> = {};

  for (const ws of workspaces) {
    try {
      if (ws.canvasType === "sketch") {
        const rawScene =
          ownerWindow.localStorage.getItem(`synapdraw_ws_${ws.id}_elements`) ||
          ownerWindow.localStorage.getItem(`excalidraw_ws_scene_${ws.id}`);
        if (rawScene) {
          sketchScenes[ws.id] = JSON.parse(rawScene);
        }
      } else if (ws.canvasType === "design") {
        const rawDesign =
          ownerWindow.localStorage.getItem(`synapdraw_design_doc_${ws.id}`) ||
          ownerWindow.localStorage.getItem(`excalidraw_design_doc_${ws.id}`);
        if (rawDesign) {
          designDocuments[ws.id] = JSON.parse(rawDesign);
        }
      }
    } catch {}
  }

  return {
    version: "1.0.0",
    exportedAt: Date.now(),
    project,
    workspaces,
    tasks,
    tddScenarios,
    team,
    sketchScenes,
    designDocuments,
  };
}

export function importProjectBundle(
  bundleJson: string,
  ownerWindow: Window = window,
): SDLCProject {
  const parsed = JSON.parse(bundleJson) as SynapDrawProjectBundle;
  if (!parsed || !parsed.project || !Array.isArray(parsed.workspaces)) {
    throw new Error("Geçersiz SynapDraw proje paketi (.synapdraw.json).");
  }

  const incomingProject = parsed.project;
  const allProjects = getProjects().filter((p) => p.id !== incomingProject.id);
  allProjects.push({
    ...incomingProject,
    updatedAt: Date.now(),
  });
  ownerWindow.localStorage.setItem(
    STORAGE_KEY_PROJECTS,
    JSON.stringify(allProjects),
  );

  const allDocs = getAllWorkspacesRaw().filter(
    (d) => d.projectId !== incomingProject.id,
  );
  ownerWindow.localStorage.setItem(
    STORAGE_KEY_WORKSPACES,
    JSON.stringify([...allDocs, ...parsed.workspaces]),
  );

  if (Array.isArray(parsed.tasks)) {
    const otherTasks = getAllTasksRaw().filter(
      (t) => t.projectId !== incomingProject.id,
    );
    ownerWindow.localStorage.setItem(
      STORAGE_KEY_TASKS,
      JSON.stringify([...otherTasks, ...parsed.tasks]),
    );
  }

  if (Array.isArray(parsed.tddScenarios)) {
    const otherTdd = getAllTDDRaw().filter(
      (s) => s.projectId !== incomingProject.id,
    );
    ownerWindow.localStorage.setItem(
      STORAGE_KEY_TDD,
      JSON.stringify([...otherTdd, ...parsed.tddScenarios]),
    );
  }

  if (Array.isArray(parsed.team)) {
    const otherTeam = getAllTeamRaw().filter(
      (m) => m.projectId !== incomingProject.id,
    );
    ownerWindow.localStorage.setItem(
      STORAGE_KEY_TEAM,
      JSON.stringify([...otherTeam, ...parsed.team]),
    );
  }

  if (parsed.sketchScenes && typeof parsed.sketchScenes === "object") {
    for (const [docId, sceneData] of Object.entries(parsed.sketchScenes)) {
      try {
        const serialized = JSON.stringify(sceneData);
        ownerWindow.localStorage.setItem(
          `synapdraw_ws_${docId}_elements`,
          serialized,
        );
        ownerWindow.localStorage.setItem(
          `excalidraw_ws_scene_${docId}`,
          serialized,
        );
      } catch {}
    }
  }

  if (parsed.designDocuments && typeof parsed.designDocuments === "object") {
    for (const [docId, designData] of Object.entries(parsed.designDocuments)) {
      try {
        ownerWindow.localStorage.setItem(
          `synapdraw_design_doc_${docId}`,
          JSON.stringify(designData),
        );
      } catch {}
    }
  }

  setOpenTabIds(
    incomingProject.id,
    parsed.workspaces.map((w) => w.id),
  );
  setActiveProjectId(incomingProject.id);
  return incomingProject;
}

// ============================================================================
// LIVE LLM AGENT PIPELINE (WITH DETERMINISTIC FALLBACK)
// ============================================================================

export async function runLiveAgentPipeline(
  taskId: string,
  mode: "auto" | "architecture" | "design" | "tdd" | "analysis" = "auto",
  ownerWindow: Window = window,
): Promise<{
  summary: string;
  usedLiveLLM: boolean;
}> {
  const tasks = getProjectTasks();
  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    return { summary: "Görev bulunamadı.", usedLiveLLM: false };
  }

  const team = getProjectTeam(task.projectId);
  const assignedMember = team.find((m) => m.id === task.assigneeId);

  let resolvedMode: "architecture" | "design" | "tdd" | "analysis" = "design";
  if (mode !== "auto") {
    resolvedMode = mode;
  } else if (assignedMember?.role === "qa" || task.status === "testing") {
    resolvedMode = "tdd";
  } else if (assignedMember?.role === "architect") {
    resolvedMode = "architecture";
  } else if (assignedMember?.role === "po" || task.status === "backlog") {
    resolvedMode = "analysis";
  } else {
    resolvedMode = "design";
  }

  const assignedAgent =
    team.find((m) => m.id === task.assigneeId && m.kind === "ai_agent") ||
    team.find(
      (m) =>
        m.kind === "ai_agent" &&
        ((resolvedMode === "architecture" && m.role === "architect") ||
          (resolvedMode === "design" && m.role === "designer") ||
          (resolvedMode === "tdd" && m.role === "qa") ||
          (resolvedMode === "analysis" && m.role === "po")),
    ) ||
    team.find((m) => m.kind === "ai_agent");

  const docs = getProjectWorkspaces(task.projectId);

  // Route through agent-specific provider (OpenRouter / Ollama / OpenAI) or fallback gateway settings
  try {
    const gateway = getAIProviderGatewayConfig();
    const rawSettings = ownerWindow.localStorage.getItem(
      "excalidraw_ai_settings",
    );
    const legacySettings = rawSettings ? JSON.parse(rawSettings) : {};

    const provider: AgentModelProvider =
      assignedAgent?.modelProvider ||
      (legacySettings.provider === "openrouter"
        ? "openrouter"
        : legacySettings.provider === "custom"
        ? "openai"
        : "ollama");

    const model =
      assignedAgent?.modelId ||
      (provider === "ollama"
        ? legacySettings.ollamaModel || "gemma4:26b"
        : provider === "openrouter"
        ? legacySettings.openRouterModel || "anthropic/claude-3.7-sonnet"
        : legacySettings.customModel || "gpt-4o-mini");

    const isOllama = provider === "ollama";
    const endpoint = isOllama
      ? `${(
          gateway.ollamaUrl ||
          legacySettings.ollamaUrl ||
          "http://127.0.0.1:11434"
        ).replace(/\/$/, "")}/api/chat`
      : provider === "openrouter"
      ? `${(
          gateway.openRouterBaseUrl || "https://openrouter.ai/api/v1"
        ).replace(/\/$/, "")}/chat/completions`
      : `${(
          gateway.openAiBaseUrl ||
          legacySettings.customUrl ||
          "https://api.openai.com/v1"
        ).replace(/\/$/, "")}/chat/completions`;

    const apiKey =
      provider === "openrouter"
        ? gateway.openRouterApiKey || legacySettings.openRouterApiKey || ""
        : gateway.openAiApiKey || legacySettings.customApiKey || "";

    if (isOllama || apiKey) {
      const ctrl = new AbortController();
      const timeoutId = setTimeout(() => ctrl.abort(), 9000);

      let sysPrompt = "";
      if (resolvedMode === "design") {
        sysPrompt = `${
          assignedAgent?.systemPrompt || "Sen kıdemli bir UI/UX tasarım uzmanısın."
        }\nGörev ve kabul kriterlerine uygun, modern, pixel-perfect, inline-style kullanan bağımsız bir HTML <div> bileşeni üret.\nKRİTİK KURALLAR:\n- Yalnızca saf HTML döndür (\`\`\`html veya açıklama metni yazma).\n- En dış kapsayıcı <div style="width:460px;padding:28px;border-radius:16px;background:#ffffff;border:1px solid #e2e8f0;font-family:Assistant,system-ui,sans-serif;color:#0f172a;"> yapısında olsun.`;
      } else if (resolvedMode === "architecture") {
        sysPrompt = `${
          assignedAgent?.systemPrompt || "Sen kıdemli bir sistem mimarısın."
        }\nGörev ve kabul kriterlerine uygun, geçerli bir Mermaid.js (graph TD) sistem mimarisi diyagramı üret.\nKRİTİK KURALLAR:\n- Yalnızca saf Mermaid kodu döndür (\`\`\`mermaid veya açıklama yazma).\n- İlk satır mutlaka 'graph TD' olsun.\n- Tüm düğüm etiketlerini çift tırnak içinde yaz: A["İstemci Katmanı"] -->|"REST / JSON"| B["Servis Katmanı"].`;
      } else if (resolvedMode === "tdd") {
        sysPrompt = `${
          assignedAgent?.systemPrompt || "Sen kıdemli bir TDD ve QA test mühendisisin."
        }\nGörev ve kabul kriterleri için 2 veya 3 adet BDD/TDD test senaryosunu YALNIZCA geçerli bir JSON dizisi olarak döndür.\nFormat: [{"title":"...","category":"acceptance","given":"...","when":"...","then":"...","assertions":["...","..."]}]\nAçıklama veya markdown kod bloğu ekleme.`;
      } else {
        sysPrompt = `${
          assignedAgent?.systemPrompt || "Sen kıdemli bir iş analisti ve Product Owner'sın."
        }\nGörev için 3 adet net, doğrulanabilir kabul kriterini her satırda bir madde olacak şekilde düz metin olarak döndür. Açıklama veya başlık yazma.`;
      }

      const userPrompt = `Görev: ${task.key} - ${task.title}\nAçıklama: ${
        task.description || ""
      }\nMevcut Kriterler: ${task.acceptanceCriteria
        .map((c) => c.text)
        .join(" | ")}`;

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (!isOllama && apiKey) {
        headers.Authorization = `Bearer ${apiKey}`;
      }
      if (provider === "openrouter") {
        headers["HTTP-Referer"] = "http://localhost:3000";
        headers["X-Title"] = "SynapDraw SDLC Super-App";
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model,
          stream: false,
          messages: [
            { role: "system", content: sysPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        const rawContent: string = (
          data?.message?.content ||
          data?.choices?.[0]?.message?.content ||
          ""
        ).trim();

        if (rawContent.length > 20) {
          // 1. ANALYSIS MODE
          if (resolvedMode === "analysis") {
            const lines = rawContent
              .split("\n")
              .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
              .filter((l) => l.length > 6 && !l.startsWith("```"))
              .slice(0, 4);
            if (lines.length > 0) {
              const now = Date.now();
              const analysisDocs = docs.filter((d) => d.canvasType === "sketch");
              const nextLinkedDocs = Array.from(
                new Set([
                  ...task.linkedDocIds,
                  ...(analysisDocs[0] ? [analysisDocs[0].id] : []),
                ]),
              );
              const merged = [
                ...task.acceptanceCriteria,
                ...lines.map((text, idx) => ({
                  id: `ac_llm_${now}_${idx}`,
                  text,
                  completed: false,
                })),
              ];
              updateProjectTask(task.id, {
                acceptanceCriteria: merged,
                linkedDocIds: nextLinkedDocs,
                status: task.status === "backlog" ? "design" : task.status,
              });
              addTaskComment(
                task.id,
                assignedAgent?.id || task.assigneeId || "system",
                `📋 ${
                  assignedAgent?.name || "AI Agent"
                } (${provider.toUpperCase()} · ${model}) ile ${
                  lines.length
                } yeni kabul kriteri üretildi.`,
              );
              return {
                summary: `${
                  assignedAgent?.name || "Agent"
                } (${model}) ile ${lines.length} kriter eklendi`,
                usedLiveLLM: true,
              };
            }
          }

          // 2. DESIGN MODE (Live HTML/CSS Artboard Generation)
          if (resolvedMode === "design") {
            const { sanitizeHtml } = await import("../utils/htmlToExcalidraw");
            const { sanitizeAndTagDesignHtml } = await import(
              "../design/sanitize"
            );
            const cleanedHtml = sanitizeHtml(rawContent);
            if (cleanedHtml.includes("<") && cleanedHtml.includes(">")) {
              let designDoc =
                docs.find(
                  (d) =>
                    d.canvasType === "design" &&
                    task.linkedDocIds.includes(d.id),
                ) || docs.find((d) => d.canvasType === "design");

              if (!designDoc) {
                designDoc = createWorkspace(
                  `${task.key} UI Tasarımı`,
                  "design",
                  "ui_design",
                  `${task.title} için ekran tasarımları`,
                );
              }

              const storageKey = `synapdraw_design_doc_${designDoc.id}`;
              let parsedDesign: any = {
                id: designDoc.id,
                name: designDoc.name,
                artboards: [],
                selectedArtboardId: null,
                selectedNodeId: null,
                zoom: 1,
                panX: 0,
                panY: 0,
              };
              try {
                const existingRaw = ownerWindow.localStorage.getItem(storageKey);
                if (existingRaw) {
                  parsedDesign = JSON.parse(existingRaw);
                  if (!Array.isArray(parsedDesign.artboards)) {
                    parsedDesign.artboards = [];
                  }
                }
              } catch {}

              let nextX = 120;
              let nextY = 100;
              if (parsedDesign.artboards.length > 0) {
                const last =
                  parsedDesign.artboards[parsedDesign.artboards.length - 1];
                const lastW =
                  typeof last.width === "number"
                    ? last.width
                    : last.measuredWidth || 460;
                nextX = Math.round((last.x || 100) + lastW + 72);
                nextY = Math.round(last.y || 100);
              }

              const artboardId = `ab_${Date.now()}_${Math.random()
                .toString(36)
                .substring(2, 6)}`;
              const artboardName = `${task.key} · ${task.title.slice(
                0,
                34,
              )} (AI UI)`;
              const taggedHtml = sanitizeAndTagDesignHtml(
                cleanedHtml,
                ownerWindow.document,
              );

              parsedDesign.artboards.push({
                id: artboardId,
                name: artboardName,
                x: nextX,
                y: nextY,
                width: "auto",
                height: "auto",
                html: taggedHtml,
                css: "",
                backgroundColor: "transparent",
                locked: false,
                allowMove: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              parsedDesign.selectedArtboardId = artboardId;
              ownerWindow.localStorage.setItem(
                storageKey,
                JSON.stringify(parsedDesign),
              );

              const currentLinkedArtboards = Array.isArray(task.linkedArtboards)
                ? task.linkedArtboards
                : [];
              const nextLinkedDocs = Array.from(
                new Set([...task.linkedDocIds, designDoc.id]),
              );

              updateProjectTask(task.id, {
                linkedDocIds: nextLinkedDocs,
                linkedArtboards: [
                  ...currentLinkedArtboards,
                  {
                    docId: designDoc.id,
                    artboardId,
                    label: artboardName,
                  },
                ],
                status:
                  task.status === "backlog" || task.status === "design"
                    ? "in_progress"
                    : task.status,
              });

              addTaskComment(
                task.id,
                assignedAgent?.id || "system",
                `🎨 ${
                  assignedAgent?.name || "UI/UX Agent"
                } (${provider.toUpperCase()} · ${model}) ile canlı "${artboardName}" bileşeni üretildi ve göreve bağlandı.`,
              );

              requestArtboardFocus(designDoc.id, artboardId, true);
              return {
                summary: `${
                  assignedAgent?.name || "UI Agent"
                } (${model}) ile "${artboardName}" üretildi`,
                usedLiveLLM: true,
              };
            }
          }

          // 3. ARCHITECTURE MODE (Live Mermaid -> Excalidraw Container Frame)
          if (resolvedMode === "architecture") {
            const cleanedMermaid = rawContent
              .replace(/```(?:mermaid)?/gi, "")
              .replace(/```/g, "")
              .trim();
            const { parseMermaidToExcalidraw } = await import(
              "@excalidraw/mermaid-to-excalidraw"
            );
            const { convertToExcalidrawElements, restoreElements } =
              await import("@excalidraw/excalidraw");
            const { wrapInContainerFrame } = await import(
              "../utils/containerHelper"
            );

            const parsedMermaid = await parseMermaidToExcalidraw(cleanedMermaid);
            if (parsedMermaid?.elements && parsedMermaid.elements.length > 0) {
              let archDoc =
                docs.find(
                  (d) =>
                    d.canvasType === "sketch" &&
                    d.category === "architecture" &&
                    task.linkedDocIds.includes(d.id),
                ) ||
                docs.find(
                  (d) =>
                    d.canvasType === "sketch" && d.category === "architecture",
                ) ||
                docs.find((d) => d.canvasType === "sketch");

              if (!archDoc) {
                archDoc = createWorkspace(
                  "Sistem Mimarisi",
                  "sketch",
                  "architecture",
                  "Servis sınırları ve sistem mimarisi şemaları",
                );
              }

              const storageKey = `synapdraw_ws_${archDoc.id}_elements`;
              let existingElements: any[] = [];
              try {
                const raw = ownerWindow.localStorage.getItem(storageKey);
                if (raw) {
                  const parsed = JSON.parse(raw);
                  if (Array.isArray(parsed)) {
                    existingElements = parsed.filter((el: any) => !el.isDeleted);
                  }
                }
              } catch {}

              let maxRight = 80;
              for (const el of existingElements) {
                if (typeof el.x === "number" && typeof el.width === "number") {
                  maxRight = Math.max(maxRight, el.x + el.width + 120);
                }
              }
              const originX = existingElements.length > 0 ? maxRight : 100;
              const refLabel = `${task.key} Mimari Şeması (${model})`;

              const container = wrapInContainerFrame(
                parsedMermaid.elements as any,
                {
                  title: refLabel,
                  originX,
                  originY: 100,
                  locked: false,
                  createFrame: true,
                  createCard: true,
                },
              );
              const converted = convertToExcalidrawElements(
                container.elements as any,
                { regenerateIds: true },
              );
              const restored = restoreElements(converted, null, {
                repairBindings: true,
                refreshDimensions: true,
              });
              const createdIds = restored.map((el) => el.id);
              const mergedElements = [...existingElements, ...restored];

              ownerWindow.localStorage.setItem(
                storageKey,
                JSON.stringify(mergedElements),
              );

              const currentSketchRefs = Array.isArray(task.linkedSketchRefs)
                ? task.linkedSketchRefs
                : [];
              const nextLinkedDocs = Array.from(
                new Set([...task.linkedDocIds, archDoc.id]),
              );

              updateProjectTask(task.id, {
                linkedDocIds: nextLinkedDocs,
                linkedSketchRefs: [
                  ...currentSketchRefs,
                  {
                    docId: archDoc.id,
                    elementIds: createdIds,
                    label: refLabel,
                  },
                ],
                status: task.status === "backlog" ? "design" : task.status,
              });

              addTaskComment(
                task.id,
                assignedAgent?.id || "system",
                `🏗️ ${
                  assignedAgent?.name || "Sistem Mimarı Agent"
                } (${provider.toUpperCase()} · ${model}) ile canlı mimari diyagram (${
                  restored.length
                } öğe) çizildi ve göreve pinlendi.`,
              );

              requestSketchFocus(archDoc.id, createdIds, true);
              return {
                summary: `${
                  assignedAgent?.name || "Mimari Agent"
                } (${model}) ile "${refLabel}" çizildi`,
                usedLiveLLM: true,
              };
            }
          }

          // 4. TDD MODE (Live BDD Scenario Suite Generation)
          if (resolvedMode === "tdd") {
            const cleanedJson = rawContent
              .replace(/```(?:json)?/gi, "")
              .replace(/```/g, "")
              .trim();
            const firstBracket = cleanedJson.search(/[\[\{]/);
            const slice =
              firstBracket >= 0 ? cleanedJson.slice(firstBracket) : cleanedJson;
            const parsed = JSON.parse(slice);
            const items = Array.isArray(parsed)
              ? parsed
              : parsed.scenarios || [parsed];

            if (Array.isArray(items) && items.length > 0) {
              let createdCount = 0;
              for (const item of items.slice(0, 5)) {
                if (!item?.title && !item?.then) continue;
                createTDDScenario(
                  {
                    title: `${task.key}: ${String(
                      item.title || item.then,
                    ).slice(0, 64)}`,
                    category: (item.category as any) || "acceptance",
                    status: "red",
                    given: String(
                      item.given ||
                        `"${task.title}" kapsamında ilgili servis/ekran hazırdır`,
                    ),
                    when: String(
                      item.when || "Kullanıcı veya istemci ilgili aksiyonu tetikler",
                    ),
                    then: String(item.then || item.title),
                    assertions: Array.isArray(item.assertions)
                      ? item.assertions
                      : [String(item.then || item.title)],
                    linkedTaskId: task.id,
                    linkedDocIds: task.linkedDocIds,
                    assigneeId: assignedAgent?.id || null,
                  },
                  task.projectId,
                );
                createdCount++;
              }

              if (createdCount > 0) {
                if (task.status === "backlog" || task.status === "design") {
                  updateProjectTask(task.id, { status: "testing" });
                }
                addTaskComment(
                  task.id,
                  assignedAgent?.id || "system",
                  `🧪 ${
                    assignedAgent?.name || "TDD & QA Agent"
                  } (${provider.toUpperCase()} · ${model}) ile ${createdCount} yeni BDD test senaryosu üretildi.`,
                );
                return {
                  summary: `${
                    assignedAgent?.name || "QA Agent"
                  } (${model}) ile ${createdCount} TDD senaryosu üretildi`,
                  usedLiveLLM: true,
                };
              }
            }
          }
        }
      }
    }
  } catch {
    // Seamless fallback to local deterministic agent execution
  }

  const localRes = executeAgentOnTask(taskId, resolvedMode, ownerWindow);
  return {
    summary: localRes.summary,
    usedLiveLLM: false,
  };
}

// ============================================================================
// EXECUTABLE TEST SPEC GENERATOR (VITEST / PLAYWRIGHT / GHERKIN)
// ============================================================================

export type TestExportFramework = "vitest" | "playwright" | "gherkin";

export function generateExecutableTestSpec(
  scenarios: TDDScenario[],
  framework: TestExportFramework,
  suiteTitle = "SynapDraw SDLC Test Suite",
): { code: string; filename: string } {
  const safeSlug = suiteTitle
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-|-$/g, "");

  if (framework === "gherkin") {
    const blocks = scenarios.map((sc) => {
      const assertionsAnd = sc.assertions
        .map((a) => `    And ${a.text}`)
        .join("\n");
      return `  @${sc.category} @${sc.status}
  Scenario: [${sc.key}] ${sc.title}
    Given ${sc.given}
    When ${sc.when}
    Then ${sc.then}${assertionsAnd ? `\n${assertionsAnd}` : ""}`;
    });

    return {
      filename: `${safeSlug || "sdlc-scenarios"}.feature`,
      code: `Feature: ${suiteTitle}
  # SynapDraw TDD Studio tarafından otomatik üretilmiştir

${blocks.join("\n\n")}
`,
    };
  }

  if (framework === "playwright") {
    const tests = scenarios.map((sc) => {
      const checks =
        sc.assertions.length > 0
          ? sc.assertions
              .map(
                (a) =>
                  `    // Doğrulama (${a.passed ? "GEÇTİ" : "BEKLİYOR"}): ${
                    a.text
                  }\n    await expect(page.locator("body")).toBeVisible();`,
              )
              .join("\n")
          : `    await expect(page.locator("body")).toBeVisible();`;

      return `  test("${sc.key}: ${sc.title.replace(/"/g, '\\"')}", async ({ page }) => {
    // GIVEN: ${sc.given}
    await page.goto("http://localhost:3000");

    // WHEN: ${sc.when}
    // TODO: İlgili kullanıcı etkileşimini tetikleyin

    // THEN: ${sc.then}
${checks}
  });`;
    });

    return {
      filename: `${safeSlug || "sdlc-e2e"}.spec.ts`,
      code: `import { test, expect } from "@playwright/test";

test.describe("${suiteTitle.replace(/"/g, '\\"')}", () => {
${tests.join("\n\n")}
});
`,
    };
  }

  // Default: Vitest / Jest (.test.ts)
  const unitTests = scenarios.map((sc) => {
    const asserts =
      sc.assertions.length > 0
        ? sc.assertions
            .map(
              (a) =>
                `    // Assertion: ${a.text}\n    expect(${
                  a.passed ? "true" : "true /* TODO: implement */"
                }).toBe(true);`,
            )
            .join("\n")
        : `    expect(true).toBe(true);`;

    return `  it("${sc.key}: ${sc.title.replace(/"/g, '\\"')} [${sc.status.toUpperCase()}]", async () => {
    // GIVEN: ${sc.given}
    // WHEN:  ${sc.when}
    // THEN:  ${sc.then}
${asserts}
  });`;
  });

  return {
    filename: `${safeSlug || "sdlc-suite"}.test.ts`,
    code: `import { describe, it, expect } from "vitest";

describe("${suiteTitle.replace(/"/g, '\\"')}", () => {
${unitTests.join("\n\n")}
});
`,
  };
}

// ============================================================================
// SDLC TRACEABILITY PULSE (PROJECT HEALTH & MISSING LINK AUDITOR)
// ============================================================================

export interface ProjectTraceabilityPulse {
  totalTasks: number;
  doneTasks: number;
  taskCompletionPercent: number;
  totalScenarios: number;
  greenScenarios: number;
  redScenarios: number;
  tddPassPercent: number;
  tasksMissingTDD: ProjectTask[];
  tasksMissingVisualLink: ProjectTask[];
}

export function computeProjectTraceabilityPulse(
  projectId?: string,
): ProjectTraceabilityPulse {
  const pid = projectId || getActiveProjectId();
  const tasks = getProjectTasks(pid);
  const scenarios = getProjectTDDScenarios(pid);

  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const taskCompletionPercent =
    totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

  const totalScenarios = scenarios.length;
  const greenScenarios = scenarios.filter(
    (s) => s.status === "green" || s.status === "refactor",
  ).length;
  const redScenarios = scenarios.filter((s) => s.status === "red").length;
  const tddPassPercent =
    totalScenarios > 0
      ? Math.round((greenScenarios / totalScenarios) * 100)
      : 0;

  const tasksMissingTDD = tasks.filter(
    (t) => !scenarios.some((s) => s.linkedTaskId === t.id),
  );
  const tasksMissingVisualLink = tasks.filter(
    (t) =>
      t.linkedDocIds.length === 0 &&
      (!t.linkedArtboards || t.linkedArtboards.length === 0) &&
      (!t.linkedSketchRefs || t.linkedSketchRefs.length === 0),
  );

  return {
    totalTasks,
    doneTasks,
    taskCompletionPercent,
    totalScenarios,
    greenScenarios,
    redScenarios,
    tddPassPercent,
    tasksMissingTDD,
    tasksMissingVisualLink,
  };
}
