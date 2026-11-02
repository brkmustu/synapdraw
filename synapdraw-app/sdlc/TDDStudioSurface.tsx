import React, { useEffect, useState } from "react";
import {
  PlusIcon,
  CloseIcon,
  TrashIcon,
  checkIcon,
  searchIcon,
  boltIcon,
  codeIcon,
  copyIcon,
  downloadIcon,
} from "@excalidraw/excalidraw/components/icons";
import { useI18n } from "@excalidraw/excalidraw/i18n";
import {
  getProjectTDDScenarios,
  createTDDScenario,
  updateTDDScenario,
  deleteTDDScenario,
  generateTDDFromTask,
  getProjectTasks,
  getProjectTeam,
  getWorkspaces,
  setActiveWorkspaceId,
  setSplitWorkspaceId,
  generateExecutableTestSpec,
  subscribeWorkspaces,
  type TDDScenario,
  type TDDStatus,
  type TDDCategory,
  type TestExportFramework,
  type ProjectTask,
  type TeamMember,
  type WorkspaceDocument,
} from "../workspace/workspaceStore";
import {
  getDocumentIcon,
  SplitViewIcon,
  TaskBoardIcon,
} from "../workspace/WorkspaceTabs";
import "./sdlc.scss";

interface TDDStudioSurfaceProps {
  documentId: string;
  documentName: string;
  compact?: boolean;
}

export const TDDStudioSurface: React.FC<TDDStudioSurfaceProps> = ({
  compact = false,
}) => {
  const { t } = useI18n();
  const STATUS_META: Record<
    TDDStatus,
    { label: string; short: string; badgeClass: string }
  > = {
    red: {
      label: t("sdlc.tdd.statusRed"),
      short: "RED",
      badgeClass: "tdd-status--red",
    },
    green: {
      label: t("sdlc.tdd.statusGreen"),
      short: "GREEN",
      badgeClass: "tdd-status--green",
    },
    refactor: {
      label: t("sdlc.tdd.statusRefactor"),
      short: "REFACTOR",
      badgeClass: "tdd-status--refactor",
    },
    draft: {
      label: t("sdlc.tdd.statusDraft"),
      short: "DRAFT",
      badgeClass: "tdd-status--draft",
    },
  };
  const CATEGORY_LABELS: Record<TDDCategory, string> = {
    acceptance: t("sdlc.tdd.catApiContract"),
    e2e: t("sdlc.tdd.catE2eUi"),
    integration: t("sdlc.tdd.catIntegration"),
    unit: t("sdlc.tdd.catUnit"),
  };
  const [scenarios, setScenarios] = useState<TDDScenario[]>([]);
  const [tasks, setTasks] = useState<ProjectTask[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [docs, setDocs] = useState<WorkspaceDocument[]>([]);

  const [statusFilter, setStatusFilter] = useState<TDDStatus | "all">("all");
  const [taskFilter, setTaskFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Create modal state
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<TDDCategory>("acceptance");
  const [newStatus, setNewStatus] = useState<TDDStatus>("red");
  const [newGiven, setNewGiven] = useState("");
  const [newWhen, setNewWhen] = useState("");
  const [newThen, setNewThen] = useState("");
  const [newAssertionsText, setNewAssertionsText] = useState("");
  const [newLinkedTaskId, setNewLinkedTaskId] = useState<string>("");
  const [newLinkedDocs, setNewLinkedDocs] = useState<string[]>([]);

  const [newAssertionInput, setNewAssertionInput] = useState("");
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isCodeDrawerOpen, setIsCodeDrawerOpen] = useState(false);
  const [exportFramework, setExportFramework] =
    useState<TestExportFramework>("vitest");
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const sync = () => {
      setScenarios(getProjectTDDScenarios());
      setTasks(getProjectTasks());
      setTeam(getProjectTeam());
      setDocs(getWorkspaces());
    };
    sync();
    return subscribeWorkspaces(sync);
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  };

  const selectedScenario =
    scenarios.find((s) => s.id === selectedId) || null;

  const filteredScenarios = scenarios.filter((s) => {
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (taskFilter !== "all" && s.linkedTaskId !== taskFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        s.title.toLowerCase().includes(q) ||
        s.key.toLowerCase().includes(q) ||
        s.given.toLowerCase().includes(q) ||
        s.when.toLowerCase().includes(q) ||
        s.then.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const counts = {
    total: scenarios.length,
    red: scenarios.filter((s) => s.status === "red").length,
    green: scenarios.filter((s) => s.status === "green").length,
    refactor: scenarios.filter((s) => s.status === "refactor").length,
    draft: scenarios.filter((s) => s.status === "draft").length,
  };

  const passRate =
    counts.total > 0
      ? Math.round(((counts.green + counts.refactor) / counts.total) * 100)
      : 0;

  const handleOpenCreate = () => {
    setNewTitle("");
    setNewCategory("acceptance");
    setNewStatus("red");
    setNewGiven("");
    setNewWhen("");
    setNewThen("");
    setNewAssertionsText("");
    setNewLinkedTaskId(tasks[0]?.id || "");
    setNewLinkedDocs([]);
    setIsCreateOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const assertions = newAssertionsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const qaAgent = team.find((m) => m.role === "qa");

    const created = createTDDScenario({
      title: newTitle,
      category: newCategory,
      status: newStatus,
      given: newGiven,
      when: newWhen,
      then: newThen,
      assertions,
      linkedTaskId: newLinkedTaskId || null,
      linkedDocIds: newLinkedDocs,
      assigneeId: qaAgent?.id || null,
    });
    setIsCreateOpen(false);
    setSelectedId(created.id);
    showToast(`${created.key} TDD senaryosu eklendi.`);
  };

  const handleSyncAllFromTasks = () => {
    let totalCreated = 0;
    for (const t of tasks) {
      const created = generateTDDFromTask(t.id);
      totalCreated += created.length;
    }
    if (totalCreated > 0) {
      showToast(`Görev kabul kriterlerinden ${totalCreated} yeni TDD senaryosu üretildi.`);
    } else {
      showToast("Tüm görev kriterleri zaten TDD senaryolarıyla eşleşmiş durumda.");
    }
  };

  const handleToggleAssertion = (scenario: TDDScenario, assertionId: string) => {
    const updatedAssertions = scenario.assertions.map((a) =>
      a.id === assertionId ? { ...a, passed: !a.passed } : a,
    );
    const allPassed =
      updatedAssertions.length > 0 &&
      updatedAssertions.every((a) => a.passed);

    updateTDDScenario(scenario.id, {
      assertions: updatedAssertions,
      status: allPassed
        ? scenario.status === "refactor"
          ? "refactor"
          : "green"
        : scenario.status === "green"
        ? "red"
        : scenario.status,
    });
  };

  const handleDeleteAssertion = (
    scenario: TDDScenario,
    assertionId: string,
  ) => {
    const updatedAssertions = scenario.assertions.filter(
      (a) => a.id !== assertionId,
    );
    updateTDDScenario(scenario.id, {
      assertions: updatedAssertions,
    });
  };

  const handleAddAssertion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScenario || !newAssertionInput.trim()) return;
    const updated = [
      ...selectedScenario.assertions,
      {
        id: `as_${Date.now()}`,
        text: newAssertionInput.trim(),
        passed: false,
      },
    ];
    updateTDDScenario(selectedScenario.id, { assertions: updated });
    setNewAssertionInput("");
  };

  const targetScenariosForExport = selectedScenario
    ? [selectedScenario]
    : filteredScenarios;
  const generatedSpec = generateExecutableTestSpec(
    targetScenariosForExport,
    exportFramework,
    selectedScenario
      ? `${selectedScenario.key} - ${selectedScenario.title}`
      : "SynapDraw SDLC Test Paketi",
  );

  const handleCopyTestCode = async () => {
    const ownerWin = rootRef.current?.ownerDocument?.defaultView;
    if (!ownerWin) return;
    try {
      await ownerWin.navigator.clipboard.writeText(generatedSpec.code);
      showToast(`"${generatedSpec.filename}" kodu panoya kopyalandı.`);
    } catch {
      showToast("Kopyalama başarısız oldu.");
    }
  };

  const handleDownloadTestCode = () => {
    const ownerDoc = rootRef.current?.ownerDocument;
    const ownerWin = ownerDoc?.defaultView;
    if (!ownerDoc || !ownerWin) return;
    const blob = new Blob([generatedSpec.code], {
      type: "text/plain;charset=utf-8",
    });
    const url = ownerWin.URL.createObjectURL(blob);
    const a = ownerDoc.createElement("a");
    a.href = url;
    a.download = generatedSpec.filename;
    ownerDoc.body.appendChild(a);
    a.click();
    a.remove();
    ownerWin.URL.revokeObjectURL(url);
    showToast(`"${generatedSpec.filename}" indirildi.`);
  };

  return (
    <div ref={rootRef} className="sdlc-surface-root">
      {/* Top Island Toolbar */}
      <div className="sdlc-top-island Island" role="toolbar">
        <div className="sdlc-segmented">
          <button
            type="button"
            className={`seg-btn ${statusFilter === "all" ? "seg-btn--active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            {t("sdlc.tdd.allStatuses")} ({counts.total})
          </button>
          <button
            type="button"
            className={`seg-btn seg-btn--red ${
              statusFilter === "red" ? "seg-btn--active" : ""
            }`}
            onClick={() => setStatusFilter("red")}
          >
            Red ({counts.red})
          </button>
          <button
            type="button"
            className={`seg-btn seg-btn--green ${
              statusFilter === "green" ? "seg-btn--active" : ""
            }`}
            onClick={() => setStatusFilter("green")}
          >
            Green ({counts.green})
          </button>
          <button
            type="button"
            className={`seg-btn ${
              statusFilter === "refactor" ? "seg-btn--active" : ""
            }`}
            onClick={() => setStatusFilter("refactor")}
          >
            Refactor ({counts.refactor})
          </button>
        </div>

        <div className="sdlc-island-divider" />

        <select
          className="sdlc-toolbar-select"
          value={taskFilter}
          onChange={(e) => setTaskFilter(e.target.value)}
          title={t("sdlc.tdd.linkedTaskFieldLabel")}
        >
          <option value="all">{t("sdlc.tdd.allCategories")}</option>
          {tasks.map((taskItem) => (
            <option key={taskItem.id} value={taskItem.id}>
              {taskItem.key}: {taskItem.title}
            </option>
          ))}
        </select>

        {!compact && (
          <div className="sdlc-toolbar-search">
            <span className="search-icon">{searchIcon}</span>
            <input
              type="text"
              placeholder={t("sdlc.tdd.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        )}

        <div className="sdlc-island-divider" />

        <button
          type="button"
          className="sdlc-secondary-btn"
          onClick={handleSyncAllFromTasks}
          title={t("sdlc.tasks.generateTddWithAgent")}
        >
          {boltIcon}
          <span>{t("sdlc.tasks.generateTddWithAgent")}</span>
        </button>

        <button
          type="button"
          className={`sdlc-secondary-btn ${
            isCodeDrawerOpen ? "seg-btn--active" : ""
          }`}
          onClick={() => setIsCodeDrawerOpen((prev) => !prev)}
          title={t("sdlc.tdd.exportCodeBtn")}
        >
          {codeIcon}
          <span>
            {t("sdlc.tdd.exportCodeBtn")} ({targetScenariosForExport.length})
          </span>
        </button>

        <button
          type="button"
          className="sdlc-primary-btn"
          onClick={handleOpenCreate}
        >
          {PlusIcon}
          <span>{t("sdlc.tdd.newScenarioBtn")}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="sdlc-content-area">
        <div className="sdlc-tdd-main">
          {/* TDD Cycle Summary Banner */}
          <div className="tdd-summary-strip Island">
            <div className="tdd-summary-metrics">
              <div className="tdd-metric">
                <span className="metric-label">
                  {t("sdlc.tdd.coverageTitle")}
                </span>
                <strong className="metric-value">%{passRate}</strong>
              </div>
              <div className="tdd-progress-bar">
                <div
                  className="tdd-progress-fill"
                  style={{ width: `${passRate}%` }}
                />
              </div>
            </div>
            <div className="tdd-cycle-legend">
              <span className="cycle-step cycle-step--red">
                {t("sdlc.tdd.cycleRed")} ({counts.red})
              </span>
              <span className="cycle-arrow">→</span>
              <span className="cycle-step cycle-step--green">
                {t("sdlc.tdd.cycleGreen")} ({counts.green})
              </span>
              <span className="cycle-arrow">→</span>
              <span className="cycle-step cycle-step--refactor">
                {t("sdlc.tdd.cycleRefactor")} ({counts.refactor})
              </span>
            </div>
          </div>

          {/* TDD Scenario Cards Grid */}
          <div className="tdd-scenarios-grid">
            {filteredScenarios.map((sc) => {
              const linkedTask = tasks.find((t) => t.id === sc.linkedTaskId);
              const linkedDocs = docs.filter((d) =>
                sc.linkedDocIds.includes(d.id),
              );
              const passedCount = sc.assertions.filter((a) => a.passed).length;

              return (
                <div
                  key={sc.id}
                  className={`tdd-scenario-card Island ${
                    selectedId === sc.id ? "tdd-scenario-card--selected" : ""
                  }`}
                  onClick={() => setSelectedId(sc.id)}
                >
                  <div className="tdd-card-header">
                    <div className="tdd-id-group">
                      <span className="tdd-key">{sc.key}</span>
                      <span className="tdd-category">
                        {CATEGORY_LABELS[sc.category]}
                      </span>
                    </div>

                    {/* Quick Status Switcher Pills */}
                    <div
                      className="tdd-quick-status"
                      onClick={(e) => e.stopPropagation()}
                    >
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
                            {STATUS_META[st].short}
                          </button>
                        ),
                      )}
                    </div>
                  </div>

                  <h4 className="tdd-title">{sc.title}</h4>

                  {/* BDD Given / When / Then */}
                  <div className="bdd-steps-box">
                    <div className="bdd-row">
                      <span className="bdd-keyword bdd-keyword--given">
                        GIVEN
                      </span>
                      <span className="bdd-text">{sc.given}</span>
                    </div>
                    <div className="bdd-row">
                      <span className="bdd-keyword bdd-keyword--when">
                        WHEN
                      </span>
                      <span className="bdd-text">{sc.when}</span>
                    </div>
                    <div className="bdd-row">
                      <span className="bdd-keyword bdd-keyword--then">
                        THEN
                      </span>
                      <span className="bdd-text">{sc.then}</span>
                    </div>
                  </div>

                  {/* Interactive Assertions */}
                  {sc.assertions.length > 0 && (
                    <div
                      className="tdd-assertions-box"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {sc.assertions.map((asItem) => (
                        <label
                          key={asItem.id}
                          className={`assertion-check ${
                            asItem.passed ? "assertion-check--passed" : ""
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={asItem.passed}
                            onChange={() => handleToggleAssertion(sc, asItem.id)}
                          />
                          <span className={asItem.passed ? "passed" : ""}>
                            {asItem.text}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}

                  {/* Cross-Linked Task & Canvases */}
                  <div
                    className="tdd-card-footer"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="tdd-links">
                      {linkedTask && (
                        <button
                          type="button"
                          className="artifact-chip artifact-chip--task"
                          onClick={() => {
                            const taskBoard = docs.find(
                              (d) => d.canvasType === "tasks",
                            );
                            if (taskBoard) setActiveWorkspaceId(taskBoard.id);
                          }}
                          title={t("sdlc.tdd.openLinkedTaskTitle", {
                            key: linkedTask.key,
                          })}
                        >
                          <span className="chip-icon">{TaskBoardIcon}</span>
                          <span className="chip-text">
                            {linkedTask.key}: {linkedTask.title}
                          </span>
                        </button>
                      )}

                      {linkedDocs.map((doc) => (
                        <div key={doc.id} className="artifact-chip-group">
                          <button
                            type="button"
                            className="artifact-chip"
                            onClick={() => setActiveWorkspaceId(doc.id)}
                            title={t("sdlc.common.open")}
                          >
                            <span className="chip-icon">
                              {getDocumentIcon(doc)}
                            </span>
                            <span className="chip-text">{doc.name}</span>
                          </button>
                          <button
                            type="button"
                            className="artifact-split-btn"
                            onClick={() => setSplitWorkspaceId(doc.id)}
                            title={t("sdlc.common.openInSplitView")}
                          >
                            {SplitViewIcon}
                          </button>
                        </div>
                      ))}
                    </div>

                    {sc.assertions.length > 0 && (
                      <span
                        className={`assertion-summary ${
                          passedCount === sc.assertions.length
                            ? "assertion-summary--all-passed"
                            : ""
                        }`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
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
                          {t("sdlc.tdd.assertionsPassCount", {
                            passed: passedCount,
                            total: sc.assertions.length,
                          })}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Scenario Inspector Drawer */}
        {selectedScenario && (
          <aside className="sdlc-detail-drawer Island">
            <div className="detail-drawer-header">
              <div className="header-left">
                <span className="task-key">{selectedScenario.key}</span>
                <select
                  className="detail-status-select"
                  value={selectedScenario.status}
                  onChange={(e) =>
                    updateTDDScenario(selectedScenario.id, {
                      status: e.target.value as TDDStatus,
                    })
                  }
                >
                  <option value="draft">{t("sdlc.tdd.statusDraft")}</option>
                  <option value="red">{t("sdlc.tdd.statusRed")}</option>
                  <option value="green">{t("sdlc.tdd.statusGreen")}</option>
                  <option value="refactor">
                    {t("sdlc.tdd.statusRefactor")}
                  </option>
                </select>
              </div>
              <div className="header-actions">
                <button
                  type="button"
                  className="detail-icon-btn detail-icon-btn--danger"
                  title={t("sdlc.tdd.deleteScenarioBtn")}
                  onClick={() => {
                    deleteTDDScenario(selectedScenario.id);
                    setSelectedId(null);
                  }}
                >
                  {TrashIcon}
                </button>
                <button
                  type="button"
                  className="detail-icon-btn"
                  title={t("sdlc.common.close")}
                  onClick={() => setSelectedId(null)}
                >
                  {CloseIcon}
                </button>
              </div>
            </div>

            <div className="detail-drawer-body">
              <div className="detail-section">
                <label className="detail-label">
                  {t("sdlc.tdd.scenarioTitleLabel")}
                </label>
                <input
                  type="text"
                  className="detail-input"
                  value={selectedScenario.title}
                  onChange={(e) =>
                    updateTDDScenario(selectedScenario.id, {
                      title: e.target.value,
                    })
                  }
                />
              </div>

              <div className="detail-grid-2">
                <div className="detail-section">
                  <label className="detail-label">
                    {t("sdlc.tdd.categoryFieldLabel")}
                  </label>
                  <select
                    className="detail-select"
                    value={selectedScenario.category}
                    onChange={(e) =>
                      updateTDDScenario(selectedScenario.id, {
                        category: e.target.value as TDDCategory,
                      })
                    }
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>
                        {v}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="detail-section">
                  <label className="detail-label">
                    {t("sdlc.tdd.linkedTaskFieldLabel")}
                  </label>
                  <select
                    className="detail-select"
                    value={selectedScenario.linkedTaskId || ""}
                    onChange={(e) =>
                      updateTDDScenario(selectedScenario.id, {
                        linkedTaskId: e.target.value || null,
                      })
                    }
                  >
                    <option value="">{t("sdlc.tdd.noTaskLinked")}</option>
                    {tasks.map((taskItem) => (
                      <option key={taskItem.id} value={taskItem.id}>
                        {taskItem.key}: {taskItem.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="detail-section">
                <label className="detail-label">
                  {t("sdlc.tdd.givenFieldLabel")}
                </label>
                <textarea
                  className="detail-textarea"
                  rows={2}
                  value={selectedScenario.given}
                  onChange={(e) =>
                    updateTDDScenario(selectedScenario.id, {
                      given: e.target.value,
                    })
                  }
                />
                <label className="detail-label">
                  {t("sdlc.tdd.whenFieldLabel")}
                </label>
                <textarea
                  className="detail-textarea"
                  rows={2}
                  value={selectedScenario.when}
                  onChange={(e) =>
                    updateTDDScenario(selectedScenario.id, {
                      when: e.target.value,
                    })
                  }
                />
                <label className="detail-label">
                  {t("sdlc.tdd.thenFieldLabel")}
                </label>
                <textarea
                  className="detail-textarea"
                  rows={2}
                  value={selectedScenario.then}
                  onChange={(e) =>
                    updateTDDScenario(selectedScenario.id, {
                      then: e.target.value,
                    })
                  }
                />
              </div>

              {/* Assertions */}
              <div className="detail-section">
                <div className="detail-section-header">
                  <label className="detail-label">
                    {t("sdlc.tdd.assertionsSection", {
                      passed: selectedScenario.assertions.filter(
                        (a) => a.passed,
                      ).length,
                      total: selectedScenario.assertions.length,
                    })}
                  </label>
                </div>
                <div className="criteria-list">
                  {selectedScenario.assertions.map((a) => (
                    <div
                      key={a.id}
                      className={`criterion-row ${
                        a.passed ? "criterion-row--passed" : ""
                      }`}
                    >
                      <label className="criterion-item">
                        <input
                          type="checkbox"
                          checked={a.passed}
                          onChange={() =>
                            handleToggleAssertion(selectedScenario, a.id)
                          }
                        />
                        <span className={a.passed ? "crit-done" : ""}>
                          {a.text}
                        </span>
                      </label>
                      <button
                        type="button"
                        className="criterion-remove-btn"
                        title={t("sdlc.common.delete")}
                        onClick={() =>
                          handleDeleteAssertion(selectedScenario, a.id)
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
                <form
                  className="detail-inline-form"
                  onSubmit={handleAddAssertion}
                >
                  <input
                    type="text"
                    className="detail-input"
                    placeholder={t("sdlc.tdd.addAssertionPlaceholder")}
                    value={newAssertionInput}
                    onChange={(e) => setNewAssertionInput(e.target.value)}
                  />
                  <button type="submit" className="detail-add-btn">
                    {t("sdlc.common.add")}
                  </button>
                </form>
              </div>

              {/* Linked Canvases */}
              <div className="detail-section">
                <label className="detail-label">
                  {t("sdlc.tasks.analysisArchDocsLabel")}
                </label>
                <div className="linked-docs-list">
                  {docs
                    .filter(
                      (d) =>
                        d.canvasType === "sketch" || d.canvasType === "design",
                    )
                    .map((doc) => {
                      const isLinked = selectedScenario.linkedDocIds.includes(
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
                              onChange={() => {
                                const updated = isLinked
                                  ? selectedScenario.linkedDocIds.filter(
                                      (id) => id !== doc.id,
                                    )
                                  : [...selectedScenario.linkedDocIds, doc.id];
                                updateTDDScenario(selectedScenario.id, {
                                  linkedDocIds: updated,
                                });
                              }}
                            />
                            <span className="doc-icon">
                              {getDocumentIcon(doc)}
                            </span>
                            <span className="doc-name">{doc.name}</span>
                          </label>
                          {isLinked && (
                            <div className="doc-jump-actions">
                              <button
                                type="button"
                                className="jump-btn"
                                onClick={() => setActiveWorkspaceId(doc.id)}
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
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
              {/* Executable Test Code Quick Trigger inside Scenario Drawer */}
              <div className="detail-section">
                <button
                  type="button"
                  className="ai-orchestrate-btn"
                  onClick={() => setIsCodeDrawerOpen(true)}
                >
                  {codeIcon}
                  <span>{t("sdlc.tdd.exportCodeBtn")}</span>
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Right Executable Test Code Drawer (Vitest / Playwright / Gherkin) */}
        {isCodeDrawerOpen && (
          <aside className="sdlc-detail-drawer Island">
            <div className="detail-drawer-header">
              <div className="header-left">
                <span
                  className="task-key"
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
                    {codeIcon}
                  </span>
                  <span>{t("sdlc.tdd.exportCodeBtn")}</span>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 700 }}>
                  {generatedSpec.filename}
                </span>
              </div>
              <div className="header-actions">
                <button
                  type="button"
                  className="detail-icon-btn"
                  title={t("sdlc.common.close")}
                  onClick={() => setIsCodeDrawerOpen(false)}
                >
                  {CloseIcon}
                </button>
              </div>
            </div>

            <div className="detail-drawer-body">
              <div className="detail-section">
                <label className="detail-label">
                  {t("sdlc.tdd.exportModalEyebrow")}
                </label>
                <div className="sdlc-segmented" style={{ width: "100%" }}>
                  <button
                    type="button"
                    style={{ flex: 1, justifyContent: "center" }}
                    className={`seg-btn ${
                      exportFramework === "vitest" ? "seg-btn--active" : ""
                    }`}
                    onClick={() => setExportFramework("vitest")}
                  >
                    Vitest (.test.ts)
                  </button>
                  <button
                    type="button"
                    style={{ flex: 1, justifyContent: "center" }}
                    className={`seg-btn ${
                      exportFramework === "playwright" ? "seg-btn--active" : ""
                    }`}
                    onClick={() => setExportFramework("playwright")}
                  >
                    Playwright (.spec.ts)
                  </button>
                  <button
                    type="button"
                    style={{ flex: 1, justifyContent: "center" }}
                    className={`seg-btn ${
                      exportFramework === "gherkin" ? "seg-btn--active" : ""
                    }`}
                    onClick={() => setExportFramework("gherkin")}
                  >
                    Gherkin (.feature)
                  </button>
                </div>
              </div>

              <div className="detail-section">
                <div className="detail-section-header">
                  <label className="detail-label">
                    {t("sdlc.tdd.exportModalTitle", {
                      count: targetScenariosForExport.length,
                    })}
                  </label>
                  {selectedScenario && (
                    <button
                      type="button"
                      className="detail-mini-btn"
                      onClick={() => setSelectedId(null)}
                    >
                      {t("sdlc.tdd.allStatuses")}
                    </button>
                  )}
                </div>

                <pre
                  style={{
                    margin: 0,
                    padding: 12,
                    borderRadius: 8,
                    background: "var(--color-surface-low)",
                    border: "1px solid var(--default-border-color)",
                    color: "var(--text-primary-color)",
                    fontFamily:
                      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    fontSize: 11.5,
                    lineHeight: 1.5,
                    overflowX: "auto",
                    maxHeight: 380,
                    whiteSpace: "pre",
                  }}
                >
                  {generatedSpec.code}
                </pre>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className="sdlc-secondary-btn"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={handleCopyTestCode}
                >
                  {copyIcon}
                  <span>{t("sdlc.tdd.copyTestFileBtn")}</span>
                </button>
                <button
                  type="button"
                  className="sdlc-primary-btn"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={handleDownloadTestCode}
                >
                  {downloadIcon}
                  <span>{t("sdlc.common.download")}</span>
                </button>
              </div>
            </div>
          </aside>
        )}
      </div>

      {/* Create Scenario Modal */}
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
              <h3>{t("sdlc.tdd.createModalTitle")}</h3>
              <button
                type="button"
                className="modal-close-btn"
                onClick={() => setIsCreateOpen(false)}
              >
                {CloseIcon}
              </button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="new-workspace-modal__body">
                <div className="form-group">
                  <label>{t("sdlc.tdd.scenarioTitleLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("sdlc.tdd.createTitlePlaceholder")}
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="sdlc-modal-grid-3">
                  <div className="form-group">
                    <label>{t("sdlc.tdd.categoryFieldLabel")}</label>
                    <select
                      className="sdlc-modal-select"
                      value={newCategory}
                      onChange={(e) =>
                        setNewCategory(e.target.value as TDDCategory)
                      }
                    >
                      {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t("sdlc.tdd.statusFieldLabel")}</label>
                    <select
                      className="sdlc-modal-select"
                      value={newStatus}
                      onChange={(e) =>
                        setNewStatus(e.target.value as TDDStatus)
                      }
                    >
                      <option value="red">{t("sdlc.tdd.statusRed")}</option>
                      <option value="draft">
                        {t("sdlc.tdd.statusDraft")}
                      </option>
                      <option value="green">
                        {t("sdlc.tdd.statusGreen")}
                      </option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>{t("sdlc.tdd.linkedRequirementLabel")}</label>
                    <select
                      className="sdlc-modal-select"
                      value={newLinkedTaskId}
                      onChange={(e) => setNewLinkedTaskId(e.target.value)}
                    >
                      <option value="">{t("sdlc.tdd.noTaskLinked")}</option>
                      {tasks.map((taskItem) => (
                        <option key={taskItem.id} value={taskItem.id}>
                          {taskItem.key}: {taskItem.title}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label>{t("sdlc.tdd.givenFieldLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("sdlc.tdd.givenPlaceholder")}
                    value={newGiven}
                    onChange={(e) => setNewGiven(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>{t("sdlc.tdd.whenFieldLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("sdlc.tdd.whenPlaceholder")}
                    value={newWhen}
                    onChange={(e) => setNewWhen(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>{t("sdlc.tdd.thenFieldLabel")}</label>
                  <input
                    type="text"
                    placeholder={t("sdlc.tdd.thenPlaceholder")}
                    value={newThen}
                    onChange={(e) => setNewThen(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>{t("sdlc.tdd.addAssertionPlaceholder")}</label>
                  <textarea
                    className="sdlc-modal-textarea"
                    rows={2}
                    placeholder={t("sdlc.tdd.addAssertionPlaceholder")}
                    value={newAssertionsText}
                    onChange={(e) => setNewAssertionsText(e.target.value)}
                  />
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
                  {t("sdlc.tdd.createScenarioSubmit")}
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
