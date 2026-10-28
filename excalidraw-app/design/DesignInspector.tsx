import React, { useMemo, useState, useEffect } from "react";
import {
  CloseIcon,
  copyIcon,
  checkIcon,
  downloadIcon,
  frameToolIcon,
  codeIcon,
  chevronDownIcon,
  chevronRight,
} from "@excalidraw/excalidraw/components/icons";
import type { Artboard, DesignNodeSummary } from "./model";

interface LayersPanelProps {
  artboards: Artboard[];
  selectedArtboardId: string | null;
  selectedNodeId: string | null;
  domTree: DesignNodeSummary[];
  onSelectArtboard: (artboardId: string, nodeId?: string | null) => void;
  onFocusArtboard: (artboardId: string) => void;
  onClose: () => void;
}

const DomTreeNodeItem: React.FC<{
  node: DesignNodeSummary;
  artboardId: string;
  selectedNodeId: string | null;
  depth: number;
  onSelect: (artboardId: string, nodeId: string) => void;
}> = ({ node, artboardId, selectedNodeId, depth, onSelect }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedNodeId === node.nodeId;

  const firstClass = node.className ? `.${node.className.split(/\s+/)[0]}` : "";

  return (
    <div className="layer-tree-node">
      <div
        className={`layer-row layer-row--node ${
          isSelected ? "layer-row--selected" : ""
        }`}
        style={{ paddingLeft: `${18 + depth * 12}px` }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(artboardId, node.nodeId);
        }}
      >
        {hasChildren ? (
          <button
            type="button"
            className="layer-expand-btn"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((prev) => !prev);
            }}
          >
            {expanded ? chevronDownIcon : chevronRight}
          </button>
        ) : (
          <span className="layer-expand-spacer" />
        )}
        <span className="layer-tag">&lt;{node.tagName}&gt;</span>
        {firstClass && <span className="layer-class">{firstClass}</span>}
        {node.textPreview && (
          <span className="layer-text-preview">"{node.textPreview}"</span>
        )}
      </div>
      {hasChildren && expanded && (
        <div className="layer-children">
          {node.children.map((child) => (
            <DomTreeNodeItem
              key={child.nodeId}
              node={child}
              artboardId={artboardId}
              selectedNodeId={selectedNodeId}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export const DesignLayersPanel: React.FC<LayersPanelProps> = ({
  artboards,
  selectedArtboardId,
  selectedNodeId,
  domTree,
  onSelectArtboard,
  onFocusArtboard,
  onClose,
}) => {
  return (
    <aside className="design-side-island design-layers-island">
      <div className="design-side-island__header">
        <span className="design-side-island__title">Katmanlar</span>
        <button
          type="button"
          className="design-icon-btn"
          onClick={onClose}
          title="Katmanları Kapat"
        >
          {CloseIcon}
        </button>
      </div>

      <div className="design-side-island__body">
        {artboards.length === 0 ? (
          <div className="design-side-empty">
            Henüz tuvalde bir tasarım veya artboard bulunmuyor.
          </div>
        ) : (
          artboards.map((ab) => {
            const isAbSelected = ab.id === selectedArtboardId;
            const isHug = ab.width === "auto" || ab.width === undefined;
            return (
              <div key={ab.id} className="layer-artboard-group">
                <div
                  className={`layer-row layer-row--artboard ${
                    isAbSelected && !selectedNodeId ? "layer-row--selected" : ""
                  }`}
                  onClick={() => onSelectArtboard(ab.id, null)}
                  onDoubleClick={() => onFocusArtboard(ab.id)}
                  title="Seçmek için tıklayın, odaklamak için çift tıklayın"
                >
                  <span className="layer-icon">{frameToolIcon}</span>
                  <span className="layer-name">{ab.name}</span>
                  <span className="layer-meta">
                    {isHug
                      ? "Hug"
                      : `${ab.width}×${ab.height}`}
                  </span>
                </div>

                {isAbSelected && domTree.length > 0 && (
                  <div className="layer-dom-tree">
                    {domTree.map((node) => (
                      <DomTreeNodeItem
                        key={node.nodeId}
                        node={node}
                        artboardId={ab.id}
                        selectedNodeId={selectedNodeId}
                        depth={0}
                        onSelect={(aid, nid) => onSelectArtboard(aid, nid)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

interface InspectorPanelProps {
  artboard: Artboard | null;
  selectedNodeId: string | null;
  domTree: DesignNodeSummary[];
  onClearNodeSelection: () => void;
  onUpdateArtboard: (artboardId: string, patch: Partial<Artboard>) => void;
  onUpdateNodeStyle: (
    artboardId: string,
    nodeId: string,
    styles: Record<string, string>,
    textContent?: string,
  ) => void;
  onCopyCode: (artboardId: string) => void;
  onDownloadCode: (artboardId: string) => void;
  onClose: () => void;
}

function findNodeById(
  nodes: DesignNodeSummary[],
  nodeId: string,
): DesignNodeSummary | null {
  for (const n of nodes) {
    if (n.nodeId === nodeId) return n;
    if (n.children?.length) {
      const found = findNodeById(n.children, nodeId);
      if (found) return found;
    }
  }
  return null;
}

export const DesignInspectorPanel: React.FC<InspectorPanelProps> = ({
  artboard,
  selectedNodeId,
  domTree,
  onClearNodeSelection,
  onUpdateArtboard,
  onUpdateNodeStyle,
  onCopyCode,
  onDownloadCode,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);

  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return findNodeById(domTree, selectedNodeId);
  }, [domTree, selectedNodeId]);

  const [nodeText, setNodeText] = useState("");
  const [nodeColor, setNodeColor] = useState("");
  const [nodeBg, setNodeBg] = useState("");
  const [nodeFontSize, setNodeFontSize] = useState("");
  const [nodePadding, setNodePadding] = useState("");
  const [nodeRadius, setNodeRadius] = useState("");

  useEffect(() => {
    if (selectedNode) {
      setNodeText(selectedNode.textPreview || "");
      setNodeColor(selectedNode.computedStyles?.color || "");
      setNodeBg(selectedNode.computedStyles?.backgroundColor || "");
      setNodeFontSize(selectedNode.computedStyles?.fontSize || "");
      setNodePadding(selectedNode.computedStyles?.padding || "");
      setNodeRadius(selectedNode.computedStyles?.borderRadius || "");
    }
  }, [selectedNode]);

  if (!artboard) {
    return null;
  }

  const isHug = artboard.width === "auto" || artboard.width === undefined;

  const handleCopy = () => {
    onCopyCode(artboard.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <aside className="design-side-island design-inspector-island">
      <div className="design-side-island__header">
        <span className="design-side-island__title">
          {selectedNode ? `Düğüm: <${selectedNode.tagName}>` : "Denetçi"}
        </span>
        <div className="design-side-island__header-actions">
          {selectedNode && (
            <button
              type="button"
              className="design-pill-btn"
              onClick={onClearNodeSelection}
              title="Artboard özelliklerine dön"
            >
              Artboard
            </button>
          )}
          <button
            type="button"
            className="design-icon-btn"
            onClick={onClose}
            title="Denetçiyi Kapat"
          >
            {CloseIcon}
          </button>
        </div>
      </div>

      <div className="design-side-island__body">
        {selectedNode ? (
          <>
            <div className="inspector-section">
              <div className="inspector-node-badge">
                <code>&lt;{selectedNode.tagName}&gt;</code>
                {selectedNode.className && (
                  <span className="inspector-node-class">
                    .{selectedNode.className.split(/\s+/).join(".")}
                  </span>
                )}
              </div>
              {selectedNode.rect && (
                <div className="inspector-grid-2">
                  <div className="inspector-stat">
                    <span>X / Y</span>
                    <strong>
                      {selectedNode.rect.x}, {selectedNode.rect.y}
                    </strong>
                  </div>
                  <div className="inspector-stat">
                    <span>W × H</span>
                    <strong>
                      {selectedNode.rect.width} × {selectedNode.rect.height}
                    </strong>
                  </div>
                </div>
              )}
            </div>

            {selectedNode.children.length === 0 && (
              <div className="inspector-section">
                <label className="inspector-label">Metin İçeriği</label>
                <div className="inspector-row">
                  <input
                    type="text"
                    className="inspector-input"
                    value={nodeText}
                    onChange={(e) => setNodeText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onUpdateNodeStyle(
                          artboard.id,
                          selectedNode.nodeId,
                          {},
                          nodeText,
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="design-pill-btn"
                    onClick={() =>
                      onUpdateNodeStyle(
                        artboard.id,
                        selectedNode.nodeId,
                        {},
                        nodeText,
                      )
                    }
                  >
                    Uygula
                  </button>
                </div>
              </div>
            )}

            <div className="inspector-section">
              <label className="inspector-label">CSS Özellikleri (Canlı)</label>
              <div className="inspector-field-list">
                <div className="inspector-field">
                  <span>Yazı Boyutu</span>
                  <input
                    type="text"
                    className="inspector-input"
                    value={nodeFontSize}
                    placeholder="16px"
                    onChange={(e) => setNodeFontSize(e.target.value)}
                    onBlur={() =>
                      onUpdateNodeStyle(artboard.id, selectedNode.nodeId, {
                        "font-size": nodeFontSize,
                      })
                    }
                  />
                </div>
                <div className="inspector-field">
                  <span>Yazı Rengi</span>
                  <input
                    type="text"
                    className="inspector-input"
                    value={nodeColor}
                    placeholder="#1e293b"
                    onChange={(e) => setNodeColor(e.target.value)}
                    onBlur={() =>
                      onUpdateNodeStyle(artboard.id, selectedNode.nodeId, {
                        color: nodeColor,
                      })
                    }
                  />
                </div>
                <div className="inspector-field">
                  <span>Arka Plan</span>
                  <input
                    type="text"
                    className="inspector-input"
                    value={nodeBg}
                    placeholder="#ffffff"
                    onChange={(e) => setNodeBg(e.target.value)}
                    onBlur={() =>
                      onUpdateNodeStyle(artboard.id, selectedNode.nodeId, {
                        "background-color": nodeBg,
                      })
                    }
                  />
                </div>
                <div className="inspector-field">
                  <span>Padding</span>
                  <input
                    type="text"
                    className="inspector-input"
                    value={nodePadding}
                    placeholder="16px"
                    onChange={(e) => setNodePadding(e.target.value)}
                    onBlur={() =>
                      onUpdateNodeStyle(artboard.id, selectedNode.nodeId, {
                        padding: nodePadding,
                      })
                    }
                  />
                </div>
                <div className="inspector-field">
                  <span>Köşe Yarıçapı</span>
                  <input
                    type="text"
                    className="inspector-input"
                    value={nodeRadius}
                    placeholder="8px"
                    onChange={(e) => setNodeRadius(e.target.value)}
                    onBlur={() =>
                      onUpdateNodeStyle(artboard.id, selectedNode.nodeId, {
                        "border-radius": nodeRadius,
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="inspector-section">
              <label className="inspector-label">Tasarım / Artboard Adı</label>
              <input
                type="text"
                className="inspector-input"
                value={artboard.name}
                onChange={(e) =>
                  onUpdateArtboard(artboard.id, { name: e.target.value })
                }
              />
            </div>

            <div className="inspector-section">
              <label className="inspector-label">Konum & Boyut Modu</label>
              <div className="inspector-grid-2">
                <div className="inspector-field">
                  <span>X</span>
                  <input
                    type="number"
                    className="inspector-input"
                    value={Math.round(artboard.x)}
                    onChange={(e) =>
                      onUpdateArtboard(artboard.id, {
                        x: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div className="inspector-field">
                  <span>Y</span>
                  <input
                    type="number"
                    className="inspector-input"
                    value={Math.round(artboard.y)}
                    onChange={(e) =>
                      onUpdateArtboard(artboard.id, {
                        y: Number(e.target.value) || 0,
                      })
                    }
                  />
                </div>
              </div>

              <div className="inspector-segmented">
                <button
                  type="button"
                  className={`inspector-seg-btn ${
                    isHug ? "inspector-seg-btn--active" : ""
                  }`}
                  onClick={() =>
                    onUpdateArtboard(artboard.id, {
                      width: "auto",
                      height: "auto",
                      backgroundColor: "transparent",
                    })
                  }
                >
                  Hug Contents (Otomatik)
                </button>
                <button
                  type="button"
                  className={`inspector-seg-btn ${
                    !isHug ? "inspector-seg-btn--active" : ""
                  }`}
                  onClick={() =>
                    onUpdateArtboard(artboard.id, {
                      width:
                        typeof artboard.width === "number"
                          ? artboard.width
                          : artboard.measuredWidth || 1440,
                      height:
                        typeof artboard.height === "number"
                          ? artboard.height
                          : artboard.measuredHeight || 900,
                      backgroundColor:
                        artboard.backgroundColor &&
                        artboard.backgroundColor !== "transparent"
                          ? artboard.backgroundColor
                          : "#ffffff",
                    })
                  }
                >
                  Sabit Çerçeve
                </button>
              </div>

              {!isHug && (
                <div className="inspector-grid-2">
                  <div className="inspector-field">
                    <span>W</span>
                    <input
                      type="number"
                      className="inspector-input"
                      value={
                        typeof artboard.width === "number"
                          ? artboard.width
                          : 1440
                      }
                      onChange={(e) =>
                        onUpdateArtboard(artboard.id, {
                          width: Math.max(100, Number(e.target.value) || 390),
                        })
                      }
                    />
                  </div>
                  <div className="inspector-field">
                    <span>H</span>
                    <input
                      type="number"
                      className="inspector-input"
                      value={
                        typeof artboard.height === "number"
                          ? artboard.height
                          : 900
                      }
                      onChange={(e) =>
                        onUpdateArtboard(artboard.id, {
                          height: Math.max(100, Number(e.target.value) || 844),
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="inspector-section">
              <label className="inspector-label">Özel CSS (Shadow DOM)</label>
              <textarea
                className="inspector-textarea"
                rows={4}
                placeholder="/* Özel CSS kuralları */"
                value={artboard.css || ""}
                onChange={(e) =>
                  onUpdateArtboard(artboard.id, { css: e.target.value })
                }
              />
            </div>

            <div className="inspector-section inspector-actions">
              <button
                type="button"
                className="inspector-action-btn"
                onClick={handleCopy}
              >
                {copied ? checkIcon : copyIcon}
                <span>{copied ? "Kopyalandı" : "HTML/CSS Kopyala"}</span>
              </button>
              <button
                type="button"
                className="inspector-action-btn inspector-action-btn--primary"
                onClick={() => onDownloadCode(artboard.id)}
              >
                {downloadIcon}
                <span>.html İndir</span>
              </button>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};
