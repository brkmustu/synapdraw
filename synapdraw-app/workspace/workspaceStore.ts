import {
  inferCategory,
  getCategoryLabel,
  type CanvasType,
  type DocumentCategory,
  type WorkspaceDocument,
  type SDLCProject,
  type ParticipantKind,
  type ParticipantRole,
  type AgentModelProvider,
  type AgentComplexityTier,
  type TeamMember,
  type AIProviderGatewayConfig,
  type TaskStatus,
  type TaskPriority,
  type TaskCriterion,
  type TaskComment,
  type LinkedArtboardRef,
  type LinkedSketchRef,
  type ProjectTask,
  type TDDStatus,
  type TDDCategory,
  type TDDAssertion,
  type TDDScenario,
  type SynapDrawProjectBundle,
  type TestExportFramework,
  type ProjectTraceabilityPulse,
} from "./types";
import {
  readCachedJson,
  writeCachedJson,
  readCachedString,
  writeCachedString,
  removeCachedKey,
  invalidateStorageCache,
} from "./storageCache";
import {
  getDefaultTeamForProject,
  buildSeededTasks,
  buildSeededTDDScenarios,
} from "./seedData";
import { generateExecutableTestSpec } from "./testGenerator";
import {
  sanitizeAndTagDesignHtml,
  sanitizeDesignBackground,
  sanitizeDesignCss,
} from "../design/sanitize";
import {
  executeAgentOnTask,
  runLiveAgentPipeline,
} from "./agentOrchestrator";

export {
  inferCategory,
  getCategoryLabel,
  generateExecutableTestSpec,
  executeAgentOnTask,
  runLiveAgentPipeline,
  invalidateStorageCache,
  type CanvasType,
  type DocumentCategory,
  type WorkspaceDocument,
  type SDLCProject,
  type ParticipantKind,
  type ParticipantRole,
  type AgentModelProvider,
  type AgentComplexityTier,
  type TeamMember,
  type AIProviderGatewayConfig,
  type TaskStatus,
  type TaskPriority,
  type TaskCriterion,
  type TaskComment,
  type LinkedArtboardRef,
  type LinkedSketchRef,
  type ProjectTask,
  type TDDStatus,
  type TDDCategory,
  type TDDAssertion,
  type TDDScenario,
  type SynapDrawProjectBundle,
  type TestExportFramework,
  type ProjectTraceabilityPulse,
};

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
  const cached = readCachedJson<Partial<AIProviderGatewayConfig>>(
    STORAGE_KEY_GATEWAY_CONFIG,
  );
  if (cached) {
    return { ...defaults, ...cached };
  }
  const legacy = readCachedJson<any>("excalidraw_ai_settings");
  if (legacy) {
    return {
      ...defaults,
      ollamaUrl: legacy.ollamaUrl || defaults.ollamaUrl,
      openAiBaseUrl:
        legacy.customUrl || legacy.openaiBaseUrl || defaults.openAiBaseUrl,
      openAiApiKey:
        legacy.customApiKey || legacy.openaiKey || defaults.openAiApiKey,
      openRouterApiKey:
        legacy.openRouterApiKey ||
        legacy.openrouterKey ||
        defaults.openRouterApiKey,
    };
  }
  return defaults;
}

export function saveAIProviderGatewayConfig(
  patch: Partial<AIProviderGatewayConfig>,
): AIProviderGatewayConfig {
  const current = getAIProviderGatewayConfig();
  const next: AIProviderGatewayConfig = {
    ...current,
    ...patch,
    ollamaUrl:
      patch.ollamaUrl ||
      patch.ollamaBaseUrl ||
      current.ollamaUrl ||
      "http://127.0.0.1:11434",
    openAiBaseUrl:
      patch.openAiBaseUrl ||
      patch.customApiBaseUrl ||
      current.openAiBaseUrl ||
      "https://api.openai.com/v1",
    openAiApiKey:
      patch.openAiApiKey ?? patch.customApiKey ?? current.openAiApiKey ?? "",
  };

  writeCachedJson(STORAGE_KEY_GATEWAY_CONFIG, next);

  // Keep legacy excalidraw_ai_settings in sync so AI Studio and Team Roster share gateway URLs/keys
  const parsedLegacy = readCachedJson<any>("excalidraw_ai_settings") || {};
  const syncedLegacy = {
    ...parsedLegacy,
    ollamaUrl: next.ollamaUrl,
    customUrl: next.openAiBaseUrl,
    customApiKey: next.openAiApiKey,
    openRouterBaseUrl: next.openRouterBaseUrl,
    openRouterApiKey: next.openRouterApiKey,
  };
  writeCachedJson("excalidraw_ai_settings", syncedLegacy);

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

// ============================================================================
// PROJECTS
// ============================================================================

export function getProjects(): SDLCProject[] {
  const parsed = readCachedJson<SDLCProject[]>(STORAGE_KEY_PROJECTS);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed;
  }

  const defaultProject: SDLCProject = {
    id: "proj_default",
    name: "Sipariş & Ürün Platformu",
    description:
      "Analiz, sistem mimarisi, UI/UX ekran tasarımları, görevler ve TDD test senaryoları çalışma alanı.",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  writeCachedJson(STORAGE_KEY_PROJECTS, [defaultProject]);
  writeCachedString(STORAGE_KEY_ACTIVE_PROJECT_ID, defaultProject.id);

  return [defaultProject];
}

export function getActiveProjectId(): string {
  const projects = getProjects();
  const saved = readCachedString(STORAGE_KEY_ACTIVE_PROJECT_ID);
  if (saved && projects.some((p) => p.id === saved)) {
    return saved;
  }
  const fallback = projects[0].id;
  writeCachedString(STORAGE_KEY_ACTIVE_PROJECT_ID, fallback);
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
  writeCachedString(STORAGE_KEY_ACTIVE_PROJECT_ID, projectId);

  const projectDocs = getProjectWorkspaces(projectId);
  if (projectDocs.length > 0) {
    writeCachedString(STORAGE_KEY_ACTIVE_ID, projectDocs[0].id);
  }
  removeCachedKey(STORAGE_KEY_SPLIT_ID);
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
  writeCachedJson(STORAGE_KEY_PROJECTS, updatedProjects);
  writeCachedString(STORAGE_KEY_ACTIVE_PROJECT_ID, id);

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
  writeCachedJson(STORAGE_KEY_WORKSPACES, allDocs);
  setOpenTabIds(id, [
    seededDocs[0].id,
    seededDocs[2].id,
    seededDocs[3].id,
    seededDocs[4].id,
  ]);
  writeCachedString(STORAGE_KEY_ACTIVE_ID, seededDocs[0].id);
  removeCachedKey(STORAGE_KEY_SPLIT_ID);

  if (copyTeamFromProjectId) {
    cloneTeamMembersToProject(copyTeamFromProjectId, id, undefined, true);
  } else {
    ensureProjectTeam(id);
  }
  notify();
  return newProj;
}

export function renameProject(projectId: string, newName: string): void {
  const projects = [...getProjects()];
  const idx = projects.findIndex((p) => p.id === projectId);
  if (idx === -1 || !newName.trim()) return;
  projects[idx] = {
    ...projects[idx],
    name: newName.trim(),
    updatedAt: Date.now(),
  };
  writeCachedJson(STORAGE_KEY_PROJECTS, projects);
  notify();
}

// ============================================================================
// WORKSPACE DOCUMENTS & OPEN TABS
// ============================================================================

function getAllWorkspacesRaw(): WorkspaceDocument[] {
  const projects = getProjects();
  const defaultProjectId = projects[0].id;

  const parsed = readCachedJson<any[]>(STORAGE_KEY_WORKSPACES);
  if (Array.isArray(parsed) && parsed.length > 0) {
    let mutated = false;
    const normalized: WorkspaceDocument[] = parsed.map((item: any) => {
      const projectId = item.projectId || defaultProjectId;
      const canvasType: CanvasType = item.canvasType || "sketch";
      const category = inferCategory(
        canvasType,
        item.name || "",
        item.category,
      );
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
      writeCachedJson(STORAGE_KEY_WORKSPACES, normalized);
    }
    return normalized;
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
  } catch {}

  writeCachedJson(STORAGE_KEY_WORKSPACES, defaultDocs);
  writeCachedString(STORAGE_KEY_ACTIVE_ID, defaultDocs[0].id);

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
  const parsed = readCachedJson<string[]>(`${STORAGE_KEY_OPEN_TABS}_${pid}`);
  if (Array.isArray(parsed)) {
    const valid = parsed.filter((id) => projectDocs.some((d) => d.id === id));
    if (valid.length > 0) {
      return valid;
    }
  }

  const initialIds = projectDocs.map((d) => d.id);
  setOpenTabIds(pid, initialIds);
  return initialIds;
}

export function setOpenTabIds(projectId: string, ids: string[]): void {
  writeCachedJson(
    `${STORAGE_KEY_OPEN_TABS}_${projectId}`,
    Array.from(new Set(ids)),
  );
}

export function getOpenWorkspaces(projectId?: string): WorkspaceDocument[] {
  const pid = projectId || getActiveProjectId();
  const projectDocs = getProjectWorkspaces(pid);
  const openIds = [...getOpenTabIds(pid)];
  const activeId = getActiveWorkspaceId();

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
    return;
  }
  const filtered = openIds.filter((tabId) => tabId !== id);
  setOpenTabIds(pid, filtered);

  if (getActiveWorkspaceId() === id && filtered.length > 0) {
    writeCachedString(STORAGE_KEY_ACTIVE_ID, filtered[filtered.length - 1]);
  }
  notify();
}

export function getActiveWorkspaceId(): string {
  const workspaces = getWorkspaces();
  const savedId = readCachedString(STORAGE_KEY_ACTIVE_ID);
  if (savedId && workspaces.some((w) => w.id === savedId)) {
    return savedId;
  }
  const fallback = workspaces[0]?.id || "ws_default_sketch";
  writeCachedString(STORAGE_KEY_ACTIVE_ID, fallback);
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
  writeCachedString(STORAGE_KEY_ACTIVE_ID, id);
  notify();
}

export function getSplitWorkspaceId(): string | null {
  const splitId = readCachedString(STORAGE_KEY_SPLIT_ID);
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
    removeCachedKey(STORAGE_KEY_SPLIT_ID);
    notify();
    return;
  }

  const targetDoc = getWorkspaces().find((w) => w.id === id);
  if (
    targetDoc &&
    targetDoc.canvasType === "sketch" &&
    currentActive.canvasType !== "sketch"
  ) {
    writeCachedString(STORAGE_KEY_ACTIVE_ID, targetDoc.id);
    writeCachedString(STORAGE_KEY_SPLIT_ID, currentActive.id);
  } else {
    writeCachedString(STORAGE_KEY_SPLIT_ID, id);
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
    sketch:
      explicitCategory === "architecture" ? "Mimari Taslak" : "Yeni Analiz",
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
  writeCachedJson(STORAGE_KEY_WORKSPACES, updated);

  const openIds = getOpenTabIds(pid);
  setOpenTabIds(pid, [...openIds, id]);
  writeCachedString(STORAGE_KEY_ACTIVE_ID, id);
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
  writeCachedJson(STORAGE_KEY_WORKSPACES, updated);

  removeCachedKey(`synapdraw_ws_${id}_elements`);
  removeCachedKey(`synapdraw_ws_${id}_state`);
  removeCachedKey(`synapdraw_design_doc_${id}`);

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
      writeCachedJson(STORAGE_KEY_TASKS, cleanedTasks);
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
      writeCachedJson(STORAGE_KEY_TDD, cleanedTdd);
    }
  } catch {}

  const openIds = getOpenTabIds(pid).filter((tabId) => tabId !== id);
  const remainingProjectDocs = updated.filter((w) => w.projectId === pid);
  if (openIds.length === 0 && remainingProjectDocs.length > 0) {
    openIds.push(remainingProjectDocs[0].id);
  }
  setOpenTabIds(pid, openIds);

  if (getActiveWorkspaceId() === id && openIds.length > 0) {
    writeCachedString(STORAGE_KEY_ACTIVE_ID, openIds[0]);
  }
  if (getSplitWorkspaceId() === id) {
    removeCachedKey(STORAGE_KEY_SPLIT_ID);
  }

  notify();
  return true;
}

export function renameWorkspace(id: string, newName: string): void {
  const allDocs = [...getAllWorkspacesRaw()];
  const idx = allDocs.findIndex((w) => w.id === id);
  if (idx === -1 || !newName.trim()) return;

  allDocs[idx] = {
    ...allDocs[idx],
    name: newName.trim(),
    updatedAt: Date.now(),
  };
  writeCachedJson(STORAGE_KEY_WORKSPACES, allDocs);
  notify();
}

// ============================================================================
// TEAM & AI AGENT ROSTER
// ============================================================================

function getAllTeamRaw(): TeamMember[] {
  const parsed = readCachedJson<TeamMember[]>(STORAGE_KEY_TEAM);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed;
  }
  const pid = getActiveProjectId();
  const seeded = getDefaultTeamForProject(pid);
  writeCachedJson(STORAGE_KEY_TEAM, seeded);
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
  writeCachedJson(STORAGE_KEY_TEAM, updated);
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
  writeCachedJson(STORAGE_KEY_TEAM, [...all, newMember]);
  notify();
  return newMember;
}

export function removeTeamMember(memberId: string): void {
  const all = getAllTeamRaw().filter((m) => m.id !== memberId);
  writeCachedJson(STORAGE_KEY_TEAM, all);
  notify();
}

export function updateTeamMember(
  memberId: string,
  patch: Partial<Omit<TeamMember, "id" | "projectId">>,
): TeamMember | null {
  const all = [...getAllTeamRaw()];
  const idx = all.findIndex((m) => m.id === memberId);
  if (idx === -1) return null;
  all[idx] = {
    ...all[idx],
    ...patch,
  };
  writeCachedJson(STORAGE_KEY_TEAM, all);
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
    const alreadyExists = existingTarget.some(
      (m) =>
        m.name.toLowerCase() === src.name.toLowerCase() && m.kind === src.kind,
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
  writeCachedJson(STORAGE_KEY_TEAM, nextAll);
  notify();
  return getProjectTeam(dstPid);
}

// ============================================================================
// PROJECT TASKS
// ============================================================================

function getSeededTasks(projectId: string): ProjectTask[] {
  const docs = getProjectWorkspaces(projectId);
  const team = ensureProjectTeam(projectId);
  return buildSeededTasks(projectId, docs, team);
}

function getAllTasksRaw(): ProjectTask[] {
  const parsed = readCachedJson<ProjectTask[]>(STORAGE_KEY_TASKS);
  if (Array.isArray(parsed) && parsed.length > 0) {
    let migrated = false;
    const enriched = parsed.map((t) => {
      if (
        t.id === "proj_default_task_2" &&
        (!t.linkedArtboards || t.linkedArtboards.length === 0) &&
        t.linkedDocIds.includes("ws_default_design")
      ) {
        migrated = true;
        return {
          ...t,
          linkedArtboards: [
            {
              docId: "ws_default_design",
              artboardId: "ab_default_order_summary",
              label: "Sipariş Özeti & Plan Seçimi",
            },
            {
              docId: "ws_default_design",
              artboardId: "ab_default_mobile_checkout",
              label: "Mobil Sepet & Ödeme Görünümü",
            },
          ],
        };
      }
      if (
        t.id === "proj_default_task_3" &&
        (!t.linkedArtboards || t.linkedArtboards.length === 0) &&
        t.linkedDocIds.includes("ws_default_design")
      ) {
        migrated = true;
        return {
          ...t,
          linkedArtboards: [
            {
              docId: "ws_default_design",
              artboardId: "ab_default_coupon_card",
              label: "Kupon & İndirim Doğrulama Kartı",
            },
          ],
        };
      }
      return t;
    });
    if (migrated) {
      writeCachedJson(STORAGE_KEY_TASKS, enriched);
    }
    return enriched;
  }
  const pid = getActiveProjectId();
  const seeded = getSeededTasks(pid);
  writeCachedJson(STORAGE_KEY_TASKS, seeded);
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
  writeCachedJson(STORAGE_KEY_TASKS, updated);
  return seeded;
}

export function createProjectTask(
  input: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    assigneeId?: string | null;
    acceptanceCriteria?: Array<
      string | { id?: string; text: string; completed?: boolean }
    >;
    linkedDocIds?: string[];
    linkedArtboards?: LinkedArtboardRef[];
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

  const artboards = input.linkedArtboards || [];
  const artboardDocIds = artboards.map((a) => a.docId);
  const mergedDocIds = Array.from(
    new Set([...(input.linkedDocIds || []), ...artboardDocIds]),
  );

  const newTask: ProjectTask = {
    id: `task_${now}_${Math.random().toString(36).substring(2, 6)}`,
    key: `TASK-${nextNum}`,
    projectId: pid,
    title: input.title.trim() || "Yeni Görev",
    description: input.description?.trim() || "",
    status: input.status || "backlog",
    priority: input.priority || "medium",
    assigneeId: input.assigneeId ?? null,
    acceptanceCriteria: (input.acceptanceCriteria || []).map(
      (item: any, idx) => ({
        id: `ac_${now}_${idx}`,
        text: typeof item === "string" ? item : String(item?.text || ""),
        completed: Boolean(item?.completed),
      }),
    ),
    linkedDocIds: mergedDocIds,
    linkedArtboards: artboards,
    comments: [],
    createdAt: now,
    updatedAt: now,
  };

  writeCachedJson(STORAGE_KEY_TASKS, [...all, newTask]);
  notify();
  return newTask;
}

export function updateProjectTask(
  taskId: string,
  patch: Partial<Omit<ProjectTask, "id" | "projectId">>,
): ProjectTask | null {
  const all = [...getAllTasksRaw()];
  const idx = all.findIndex((t) => t.id === taskId);
  if (idx === -1) return null;

  const updated: ProjectTask = {
    ...all[idx],
    ...patch,
    updatedAt: Date.now(),
  };
  all[idx] = updated;
  writeCachedJson(STORAGE_KEY_TASKS, all);
  notify();
  return updated;
}

export function deleteProjectTask(taskId: string): void {
  const all = getAllTasksRaw().filter((t) => t.id !== taskId);
  writeCachedJson(STORAGE_KEY_TASKS, all);

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
      writeCachedJson(STORAGE_KEY_TDD, cleaned);
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
  const all = [...getAllTasksRaw()];
  const idx = all.findIndex((t) => t.id === taskId);
  if (idx === -1) return;
  const target = all[idx];
  all[idx] = {
    ...target,
    comments: [
      ...target.comments,
      {
        id: `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        authorId,
        text: text.trim(),
        createdAt: Date.now(),
      },
    ],
    updatedAt: Date.now(),
  };
  writeCachedJson(STORAGE_KEY_TASKS, all);
  notify();
}

// ============================================================================
// TDD & TEST SCENARIOS
// ============================================================================

function getSeededTDDScenarios(projectId: string): TDDScenario[] {
  const tasks = getProjectTasks(projectId);
  const docs = getProjectWorkspaces(projectId);
  const team = ensureProjectTeam(projectId);
  return buildSeededTDDScenarios(projectId, tasks, docs, team);
}

function getAllTDDRaw(): TDDScenario[] {
  const parsed = readCachedJson<TDDScenario[]>(STORAGE_KEY_TDD);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return parsed;
  }
  const pid = getActiveProjectId();
  const seeded = getSeededTDDScenarios(pid);
  writeCachedJson(STORAGE_KEY_TDD, seeded);
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
  writeCachedJson(STORAGE_KEY_TDD, updated);
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
    assertions?: Array<
      string | { text?: string; description?: string; passed?: boolean }
    >;
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
      passed:
        typeof item === "object" && item !== null ? Boolean(item.passed) : false,
    })),
    linkedTaskId: input.linkedTaskId ?? null,
    linkedDocIds: input.linkedDocIds || [],
    assigneeId: input.assigneeId ?? null,
    createdAt: now,
    updatedAt: now,
  };

  writeCachedJson(STORAGE_KEY_TDD, [...all, scenario]);
  notify();
  return scenario;
}

export function updateTDDScenario(
  scenarioId: string,
  patch: Partial<Omit<TDDScenario, "id" | "projectId">>,
): TDDScenario | null {
  const all = [...getAllTDDRaw()];
  const idx = all.findIndex((s) => s.id === scenarioId);
  if (idx === -1) return null;

  const updated: TDDScenario = {
    ...all[idx],
    ...patch,
    updatedAt: Date.now(),
  };
  all[idx] = updated;
  writeCachedJson(STORAGE_KEY_TDD, all);

  // Bidirectional state propagation: when a TDD scenario becomes green/refactor,
  // sync matching acceptance criteria on the linked task
  if (
    updated.linkedTaskId &&
    (updated.status === "green" || updated.status === "refactor")
  ) {
    try {
      const allTasks = [...getAllTasksRaw()];
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
          writeCachedJson(STORAGE_KEY_TASKS, allTasks);
        }
      }
    } catch {}
  }

  notify();
  return updated;
}

export function deleteTDDScenario(scenarioId: string): void {
  const all = getAllTDDRaw().filter((s) => s.id !== scenarioId);
  writeCachedJson(STORAGE_KEY_TDD, all);
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

  const hasRemainingForDoc = nextArtboards.some(
    (item) => item.docId === link.docId,
  );
  const nextDocIds = hasRemainingForDoc
    ? Array.from(new Set([...task.linkedDocIds, link.docId]))
    : task.linkedDocIds.filter((id) => id !== link.docId);

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
      writeCachedJson(STORAGE_KEY_TASKS, cleaned);
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
// PORTABLE PROJECT BUNDLE EXPORT / IMPORT (.synapdraw.json)
// ============================================================================

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
  writeCachedJson(STORAGE_KEY_PROJECTS, allProjects, ownerWindow.localStorage);

  const allDocs = getAllWorkspacesRaw().filter(
    (d) => d.projectId !== incomingProject.id,
  );
  writeCachedJson(
    STORAGE_KEY_WORKSPACES,
    [...allDocs, ...parsed.workspaces],
    ownerWindow.localStorage,
  );

  if (Array.isArray(parsed.tasks)) {
    const otherTasks = getAllTasksRaw().filter(
      (t) => t.projectId !== incomingProject.id,
    );
    writeCachedJson(
      STORAGE_KEY_TASKS,
      [...otherTasks, ...parsed.tasks],
      ownerWindow.localStorage,
    );
  }

  if (Array.isArray(parsed.tddScenarios)) {
    const otherTdd = getAllTDDRaw().filter(
      (s) => s.projectId !== incomingProject.id,
    );
    writeCachedJson(
      STORAGE_KEY_TDD,
      [...otherTdd, ...parsed.tddScenarios],
      ownerWindow.localStorage,
    );
  }

  if (Array.isArray(parsed.team)) {
    const otherTeam = getAllTeamRaw().filter(
      (m) => m.projectId !== incomingProject.id,
    );
    writeCachedJson(
      STORAGE_KEY_TEAM,
      [...otherTeam, ...parsed.team],
      ownerWindow.localStorage,
    );
  }

  if (parsed.sketchScenes && typeof parsed.sketchScenes === "object") {
    for (const [docId, sceneData] of Object.entries(parsed.sketchScenes)) {
      writeCachedJson(
        `synapdraw_ws_${docId}_elements`,
        sceneData,
        ownerWindow.localStorage,
      );
      writeCachedJson(
        `excalidraw_ws_scene_${docId}`,
        sceneData,
        ownerWindow.localStorage,
      );
    }
  }

  if (parsed.designDocuments && typeof parsed.designDocuments === "object") {
    for (const [docId, designData] of Object.entries(parsed.designDocuments)) {
      if (designData && typeof designData === "object") {
        const rawDoc = designData as Record<string, unknown>;
        const sanitizedDoc = {
          ...rawDoc,
          artboards: Array.isArray(rawDoc.artboards)
            ? rawDoc.artboards.map((ab: any) => ({
                ...ab,
                html: sanitizeAndTagDesignHtml(
                  typeof ab?.html === "string" ? ab.html : "",
                  ownerWindow.document,
                ),
                css: sanitizeDesignCss(
                  typeof ab?.css === "string" ? ab.css : "",
                ),
                backgroundColor: sanitizeDesignBackground(
                  typeof ab?.backgroundColor === "string"
                    ? ab.backgroundColor
                    : "transparent",
                ),
              }))
            : [],
        };
        writeCachedJson(
          `synapdraw_design_doc_${docId}`,
          sanitizedDoc,
          ownerWindow.localStorage,
        );
      }
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
// SDLC TRACEABILITY PULSE (PROJECT HEALTH & MISSING LINK AUDITOR)
// ============================================================================

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
