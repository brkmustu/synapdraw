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
} from "@excalidraw/excalidraw/components/icons";
import {
  getWorkspaces,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  createWorkspace,
  deleteWorkspace,
  renameWorkspace,
  subscribeWorkspaces,
  type WorkspaceDocument,
  type CanvasType,
} from "./workspaceStore";
import "./WorkspaceTabs.scss";

interface WorkspaceTabsProps {
  editorTheme?: "light" | "dark";
  onToggleTheme?: () => void;
  onOpenAIIntegrations?: () => void;
}

export const WorkspaceTabs: React.FC<WorkspaceTabsProps> = ({
  editorTheme = "light",
  onToggleTheme,
  onOpenAIIntegrations,
}) => {
  const [workspaces, setWorkspaces] = useState<WorkspaceDocument[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedType, setSelectedType] = useState<CanvasType>("design");

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const update = () => {
      setWorkspaces(getWorkspaces());
      setActiveId(getActiveWorkspaceId());
    };
    update();
    return subscribeWorkspaces(update);
  }, []);

  const handleSelectTab = (id: string) => {
    setActiveWorkspaceId(id);
  };

  const handleOpenCreateModal = () => {
    setNewTitle("");
    setSelectedType("design");
    setIsModalOpen(true);
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const doc = createWorkspace(newTitle, selectedType);
    setIsModalOpen(false);
    setActiveWorkspaceId(doc.id);
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

  const activeWs = workspaces.find((w) => w.id === activeId);
  const pendingDeleteWs = workspaces.find((w) => w.id === pendingDeleteId);

  return (
    <>
      <header className="workspace-tabs-bar">
        <div className="tabs-scroll-container" role="tablist">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeId;
            const isEditing = editingTabId === ws.id;
            return (
              <div
                key={ws.id}
                role="tab"
                aria-selected={isActive}
                className={`workspace-tab ${
                  isActive ? "workspace-tab--active" : ""
                }`}
                onClick={() => handleSelectTab(ws.id)}
                onDoubleClick={() => {
                  setEditingTabId(ws.id);
                  setEditingName(ws.name);
                }}
                title={`${ws.name} (${
                  ws.canvasType === "design"
                    ? "Tasarım Tuvali"
                    : "Çizim Tuvali"
                }) — Yeniden adlandırmak için çift tıklayın`}
              >
                <span className="tab-icon">
                  {ws.canvasType === "design" ? frameToolIcon : FreedrawIcon}
                </span>

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
                  className={`tab-badge tab-badge--${ws.canvasType}`}
                  title={
                    ws.canvasType === "design"
                      ? "CSS / Pixel-Perfect Tasarım Tuvali (Kilitli)"
                      : "Excalidraw Çizim Tuvali (Kilitli)"
                  }
                >
                  {ws.canvasType === "design" ? "Tasarım" : "Çizim"}
                </span>

                {workspaces.length > 1 && (
                  <button
                    type="button"
                    className="tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingDeleteId(ws.id);
                    }}
                    title="Çalışma alanını kapat"
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
            onClick={handleOpenCreateModal}
            title="Yeni Çalışma Alanı / Belge Oluştur"
          >
            {PlusIcon}
          </button>
        </div>

        <div className="tabs-info-bar">
          {activeWs && (
            <div
              className="type-lock-indicator"
              title="Tuval tipi belge oluşturulurken kilitlenmiştir ve bu belge için değiştirilemez."
            >
              <span className="lock-svg">{LockedIcon}</span>
              <span>
                Tuval Tipi:{" "}
                <strong>
                  {activeWs.canvasType === "design"
                    ? "Tasarım (CSS)"
                    : "Çizim (Sketch)"}
                </strong>
              </span>
            </div>
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

      {/* Create New Workspace Modal */}
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
              <h3>Yeni Çalışma Alanı Oluştur</h3>
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
                  <label htmlFor="ws-name">Belge Başlığı</label>
                  <input
                    id="ws-name"
                    type="text"
                    placeholder="Örn: Sipariş Ekranı, Ürün Sayfası..."
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="form-group">
                  <label>Tuval Tipi Seçin</label>
                  <div className="canvas-type-selector">
                    <button
                      type="button"
                      className={`type-card ${
                        selectedType === "sketch" ? "type-card--selected" : ""
                      }`}
                      onClick={() => setSelectedType("sketch")}
                    >
                      <div className="card-header">
                        <span className="card-icon">{FreedrawIcon}</span>
                        <span className="card-title">Çizim Tuvali</span>
                      </div>
                      <div className="card-desc">
                        Excalidraw el çizimi, sistem mimarisi şemaları, serbest
                        çizim ve Mermaid diyagramları.
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`type-card ${
                        selectedType === "design" ? "type-card--selected" : ""
                      }`}
                      onClick={() => setSelectedType("design")}
                    >
                      <div className="card-header">
                        <span className="card-icon">{frameToolIcon}</span>
                        <span className="card-title">Tasarım Tuvali</span>
                      </div>
                      <div className="card-desc">
                        CSS odaklı, pixel-perfect, Figma benzeri Hug Contents
                        bileşenler ve canlı DOM denetçisi.
                      </div>
                    </button>
                  </div>
                </div>

                <div className="type-lock-notice">
                  <span className="notice-icon">{LockedIcon}</span>
                  <span>
                    Seçtiğiniz tuval tipi bu çalışma alanı için{" "}
                    <strong>kalıcı olarak kilitlenir</strong> ve oluşturulduktan
                    sonra değiştirilemez.
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
                  Tuvali Başlat
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
              <h3>Çalışma Alanını Kapat</h3>
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
                <strong>"{pendingDeleteWs.name}"</strong> çalışma alanını ve
                içindeki verileri kapatmak istediğinize emin misiniz?
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
                Kapat ve Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
