export interface DesignNodeSummary {
  nodeId: string;
  tagName: string;
  id?: string;
  className?: string;
  textPreview?: string;
  rect?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  computedStyles?: Record<string, string>;
  children: DesignNodeSummary[];
}

export interface Artboard {
  id: string;
  name: string;
  x: number;
  y: number;
  width?: number | "auto";
  height?: number | "auto";
  measuredWidth?: number;
  measuredHeight?: number;
  html: string;
  css?: string;
  backgroundColor?: string;
  locked?: boolean;
  allowMove?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DesignDocument {
  id: string;
  name: string;
  artboards: Artboard[];
  selectedArtboardId?: string | null;
  selectedNodeId?: string | null;
  zoom: number;
  panX: number;
  panY: number;
}

const STORAGE_PREFIX = "synapdraw_design_doc_";
const LEGACY_STORAGE_PREFIX = "excalidraw_design_doc_";

export function buildDefaultSeededArtboards(): Artboard[] {
  const now = Date.now();
  return [
    {
      id: "ab_default_order_summary",
      name: "Sipariş Özeti & Plan Seçimi",
      x: 80,
      y: 80,
      width: 1440,
      height: 900,
      backgroundColor: "#f8fafc",
      locked: false,
      allowMove: true,
      createdAt: now - 3600_000,
      updatedAt: now - 1800_000,
      html: `<div style="padding: 40px; font-family: Inter, system-ui, sans-serif; color: #0f172a;">
  <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px;">
    <div>
      <span style="display: inline-block; padding: 4px 10px; border-radius: 999px; background: #e0e7ff; color: #4338ca; font-size: 12px; font-weight: 700;">MASAÜSTÜ AKIŞI · 1440×900</span>
      <h2 style="margin: 8px 0 4px; font-size: 24px; font-weight: 800;">Sipariş Özeti &amp; Paket Seçimi</h2>
      <p style="margin: 0; color: #64748b; font-size: 14px;">Kurumsal ve Bireysel plan karşılaştırması ile sepet özeti ekranı</p>
    </div>
    <div style="padding: 10px 18px; border-radius: 10px; background: #4f46e5; color: #ffffff; font-weight: 700; font-size: 14px;">Ödemeye Geç →</div>
  </div>
  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 20px;">
    <div style="padding: 24px; border-radius: 14px; background: #ffffff; border: 1px solid #e2e8f0;">
      <h3 style="margin: 0 0 12px; font-size: 16px;">Seçili Plan: Pro Takım Paketi</h3>
      <p style="margin: 0; color: #475569; font-size: 13px;">Sınırsız analiz tuvali, artboard izlenebilirliği ve TDD otomasyonu</p>
    </div>
    <div style="padding: 24px; border-radius: 14px; background: #ffffff; border: 2px solid #4f46e5;">
      <div style="font-size: 12px; font-weight: 700; color: #4f46e5;">TOPLAM TUTAR</div>
      <div style="font-size: 28px; font-weight: 800; margin: 6px 0;">$49.00 <span style="font-size: 13px; color: #64748b; font-weight: 500;">/ ay</span></div>
    </div>
  </div>
</div>`,
      css: "",
    },
    {
      id: "ab_default_coupon_card",
      name: "Kupon & İndirim Doğrulama Kartı",
      x: 1580,
      y: 80,
      width: "auto",
      height: "auto",
      backgroundColor: "transparent",
      locked: false,
      allowMove: true,
      createdAt: now - 3200_000,
      updatedAt: now - 1200_000,
      html: `<div style="width: 420px; padding: 24px; border-radius: 16px; background: #ffffff; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px rgba(15,23,42,0.06); font-family: Inter, system-ui, sans-serif; color: #0f172a;">
  <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700;">BİLEŞEN · HUG CONTENTS</span>
  <h3 style="margin: 10px 0 6px; font-size: 17px; font-weight: 700;">İndirim Kuponu Doğrulama</h3>
  <p style="margin: 0 0 14px; font-size: 12.5px; color: #64748b;">Süresi dolmuş kuponlarda 422 doğrulama uyarısı ve sıfır altı tutar koruması</p>
  <div style="display: flex; gap: 8px; margin-bottom: 10px;">
    <div style="flex: 1; padding: 9px 12px; border-radius: 8px; border: 1.5px solid #ef4444; background: #fef2f2; font-size: 13px; font-weight: 600; color: #991b1b;">BAHAR2025 (Süresi Dolmuş)</div>
    <div style="padding: 9px 14px; border-radius: 8px; background: #0f172a; color: #ffffff; font-size: 13px; font-weight: 600;">Uygula</div>
  </div>
  <div style="font-size: 12px; color: #dc2626; font-weight: 600;">⚠ 422: Girdiğiniz kupon kodunun geçerlilik süresi dolmuştur.</div>
</div>`,
      css: "",
    },
    {
      id: "ab_default_mobile_checkout",
      name: "Mobil Sepet & Ödeme Görünümü",
      x: 2060,
      y: 80,
      width: 390,
      height: 844,
      backgroundColor: "#ffffff",
      locked: false,
      allowMove: true,
      createdAt: now - 2800_000,
      updatedAt: now - 900_000,
      html: `<div style="padding: 24px; font-family: Inter, system-ui, sans-serif; color: #0f172a;">
  <span style="display: inline-block; padding: 3px 8px; border-radius: 6px; background: #cffafe; color: #0e7490; font-size: 11px; font-weight: 700;">MOBİL · 390×844</span>
  <h3 style="margin: 10px 0 4px; font-size: 18px; font-weight: 800;">Mobil Sipariş Özeti</h3>
  <p style="margin: 0 0 16px; font-size: 12px; color: #64748b;">Tek elle kullanım uyumlu sabit alt ödeme çubuğu</p>
  <div style="padding: 16px; border-radius: 12px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 12px;">
    <div style="font-size: 13px; font-weight: 700;">Pro Paket (Aylık)</div>
    <div style="font-size: 18px; font-weight: 800; color: #4f46e5; margin-top: 4px;">$49.00</div>
  </div>
  <div style="padding: 12px; border-radius: 10px; background: #4f46e5; color: #ffffff; text-align: center; font-weight: 700; font-size: 14px;">Siparişi Onayla</div>
</div>`,
      css: "",
    },
  ];
}

export function loadDesignDocument(
  id: string,
  name: string,
  ownerWindow: Window = window,
): DesignDocument {
  try {
    const storage = ownerWindow.localStorage;
    const raw =
      storage.getItem(`${STORAGE_PREFIX}${id}`) ||
      storage.getItem(`${LEGACY_STORAGE_PREFIX}${id}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      const rawArtboards: Artboard[] = Array.isArray(parsed.artboards)
        ? parsed.artboards
        : [];

      // If this is the default design canvas and it had 0 artboards, seed the starter artboards
      if (id === "ws_default_design" && rawArtboards.length === 0) {
        const seeded = buildDefaultSeededArtboards();
        const seededDoc: DesignDocument = {
          id,
          name,
          artboards: seeded,
          selectedArtboardId: seeded[0].id,
          selectedNodeId: null,
          zoom: 0.55,
          panX: 40,
          panY: 40,
        };
        saveDesignDocument(seededDoc, ownerWindow);
        return seededDoc;
      }

      // Normalize artboards: fix legacy Hug Contents items that accidentally inherited 1200x800 white boxes
      const artboards = rawArtboards.map((a) => {
        const isHugTitle =
          typeof a.name === "string" &&
          a.name.toLowerCase().includes("hug contents");
        return {
          ...a,
          width: isHugTitle ? "auto" : (a.width ?? "auto"),
          height: isHugTitle ? "auto" : (a.height ?? "auto"),
          backgroundColor: isHugTitle
            ? "transparent"
            : (a.backgroundColor ?? "transparent"),
          locked: a.locked ?? false,
          allowMove: a.allowMove ?? true,
        };
      });

      return {
        id,
        name,
        artboards,
        selectedArtboardId: parsed.selectedArtboardId ?? null,
        selectedNodeId: parsed.selectedNodeId ?? parsed.selectedNodeSelector ?? null,
        zoom: typeof parsed.zoom === "number" ? parsed.zoom : 1,
        panX: typeof parsed.panX === "number" ? parsed.panX : 0,
        panY: typeof parsed.panY === "number" ? parsed.panY : 0,
      };
    }

    if (id === "ws_default_design") {
      const seeded = buildDefaultSeededArtboards();
      const seededDoc: DesignDocument = {
        id,
        name,
        artboards: seeded,
        selectedArtboardId: seeded[0].id,
        selectedNodeId: null,
        zoom: 0.55,
        panX: 40,
        panY: 40,
      };
      saveDesignDocument(seededDoc, ownerWindow);
      return seededDoc;
    }
  } catch (err) {
    console.error("[DesignModel] Error loading document:", err);
  }

  return {
    id,
    name,
    artboards: [],
    selectedArtboardId: null,
    selectedNodeId: null,
    zoom: 1,
    panX: 0,
    panY: 0,
  };
}

export function saveDesignDocument(
  doc: DesignDocument,
  ownerWindow: Window = window,
): void {
  try {
    ownerWindow.localStorage.setItem(
      `${STORAGE_PREFIX}${doc.id}`,
      JSON.stringify(doc),
    );
    ownerWindow.dispatchEvent(
      new CustomEvent("synapdraw:design-doc-updated", {
        detail: { docId: doc.id },
      }),
    );
  } catch (err) {
    console.error("[DesignModel] Error saving document:", err);
  }
}

export function createArtboardInDesignDoc(
  docId: string,
  docName: string,
  artboardName: string,
  preset: "desktop" | "mobile" | "hug" = "desktop",
  ownerWindow: Window = window,
): Artboard {
  const doc = loadDesignDocument(docId, docName, ownerWindow);
  const width =
    preset === "desktop" ? 1440 : preset === "mobile" ? 390 : "auto";
  const height =
    preset === "desktop" ? 900 : preset === "mobile" ? 844 : "auto";
  const spacing = 64;
  let nextX = 100;
  let nextY = 90;

  if (doc.artboards.length > 0) {
    const last = doc.artboards[doc.artboards.length - 1];
    const lastW =
      typeof last.width === "number" ? last.width : last.measuredWidth || 440;
    nextX = last.x + lastW + spacing;
    nextY = last.y;
  }

  const badgeText =
    preset === "desktop"
      ? "1440 × 900"
      : preset === "mobile"
      ? "390 × 844"
      : "Hug Contents";

  const newArtboard: Artboard = {
    id: `ab_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    name: artboardName.trim() || `Artboard ${doc.artboards.length + 1}`,
    x: nextX,
    y: nextY,
    width,
    height,
    backgroundColor: preset === "hug" ? "transparent" : "#ffffff",
    locked: false,
    allowMove: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    html: `<div style="padding: 36px; font-family: Inter, system-ui, sans-serif; color: #0f172a; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0;">
  <span style="display:inline-block; padding: 4px 10px; border-radius: 6px; background: #e0e7ff; color: #4338ca; font-size: 12px; font-weight: 700; margin-bottom: 12px;">${badgeText}</span>
  <h2 style="margin: 0 0 8px; font-size: 22px; font-weight: 800;">${artboardName}</h2>
  <p style="margin: 0; color: #64748b; font-size: 14px; line-height: 1.5;">Görev ve kabul kriterleriyle uçtan uca ilişkili ekran artboard'u.</p>
</div>`,
    css: "",
  };

  const updatedDoc: DesignDocument = {
    ...doc,
    artboards: [...doc.artboards, newArtboard],
    selectedArtboardId: newArtboard.id,
  };
  saveDesignDocument(updatedDoc, ownerWindow);
  return newArtboard;
}
