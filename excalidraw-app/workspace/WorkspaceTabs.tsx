import React, { useEffect, useState } from "react";
import {
  getWorkspaces,
  getActiveWorkspaceId,
  setActiveWorkspaceId,
  createWorkspace,
  deleteWorkspace,
  subscribeWorkspaces,
  type WorkspaceDocument,
  type CanvasType,
} from "./workspaceStore";
import "./WorkspaceTabs.scss";

export const WorkspaceTabs: React.FC = () => {
  const [workspaces, setWorkspaces] = useState<WorkspaceDocument[]>([]);
  const [activeId, setActiveId] = useState<string>("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [selectedType, setSelectedType] = useState<CanvasType>("design");

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

  const handleDeleteTab = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (window.confirm("Bu çalışma alanını kapatmak istediğinize emin misiniz?")) {
      deleteWorkspace(id);
    }
  };

  const activeWs = workspaces.find((w) => w.id === activeId);

  return (
    <>
      <header className="workspace-tabs-bar">
        <div className="tabs-scroll-container">
          {workspaces.map((ws) => {
            const isActive = ws.id === activeId;
            return (
              <div
                key={ws.id}
                className={`workspace-tab ${isActive ? "workspace-tab--active" : ""}`}
                onClick={() => handleSelectTab(ws.id)}
                title={`${ws.name} (${ws.canvasType === "design" ? "Tasarım Tuvali" : "Çizim Tuvali"})`}
              >
                <span className="tab-icon">
                  {ws.canvasType === "design" ? "🎨" : "✏️"}
                </span>
                <span className="tab-name">{ws.name}</span>
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
                    onClick={(e) => handleDeleteTab(e, ws.id)}
                    title="Sekmeyi kapat"
                  >
                    ×
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
            +
          </button>
        </div>

        <div className="tabs-info-bar">
          {activeWs && (
            <div className="type-lock-indicator" title="Tuval tipi belge oluşturulurken kilitlenmiştir.">
              🔒 <span>Tuval Tipi: <strong>{activeWs.canvasType === "design" ? "Tasarım (CSS)" : "Çizim (Sketch)"}</strong></span>
            </div>
          )}
        </div>
      </header>

      {isModalOpen && (
        <div className="new-workspace-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div
            className="new-workspace-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="new-workspace-modal__header">
              <h3>Yeni Tuval Oluştur</h3>
              <button type="button" onClick={() => setIsModalOpen(false)}>
                ×
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
                        <span className="card-icon">✏️</span>
                        <span className="card-title">Çizim Tuvali</span>
                      </div>
                      <div className="card-desc">
                        Excalidraw el çizimi, mimari şemalar, serbest çizim ve Mermaid diyagramları.
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
                        <span className="card-icon">🎨</span>
                        <span className="card-title">Tasarım Tuvali</span>
                      </div>
                      <div className="card-desc">
                        CSS odaklı, pixel-perfect, Figma benzeri artboard'lar ve yapay zeka UI entegrasyonu.
                      </div>
                    </button>
                  </div>
                </div>

                <div className="type-lock-notice">
                  <span>ℹ️</span>
                  <span>
                    Seçtiğiniz tuval tipi bu çalışma alanı için <strong>kalıcı olarak kilitlenir</strong> ve daha sonra değiştirilemez.
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
    </>
  );
};
