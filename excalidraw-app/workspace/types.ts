import { t } from "@excalidraw/excalidraw/i18n";

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
  activeProvider?: AgentModelProvider;
  ollamaUrl: string;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  openRouterBaseUrl: string;
  openRouterApiKey: string;
  openRouterModel?: string;
  openAiBaseUrl: string;
  openAiApiKey: string;
  customApiBaseUrl?: string;
  customApiKey?: string;
  customApiModel?: string;
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

export type TestExportFramework = "vitest" | "playwright" | "gherkin";

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
      return t("sdlc.categories.analysis");
    case "architecture":
      return t("sdlc.categories.architecture");
    case "ui_design":
      return t("sdlc.categories.ui_design");
    case "task_board":
      return t("sdlc.categories.task_board");
    case "tdd_suite":
      return t("sdlc.categories.tdd_suite");
  }
}
