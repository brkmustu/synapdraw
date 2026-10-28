import type { AgentModelProvider } from "./types";
import { writeCachedJson } from "./storageCache";
import {
  addTaskComment,
  createTDDScenario,
  createWorkspace,
  generateTDDFromTask,
  getAIProviderGatewayConfig,
  getProjectTDDScenarios,
  getProjectTasks,
  getProjectTeam,
  getProjectWorkspaces,
  requestArtboardFocus,
  requestSketchFocus,
  updateProjectTask,
} from "./workspaceStore";

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
    const baseY = 100;
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
    writeCachedJson(storageKey, mergedElements, ownerWindow.localStorage);

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
  writeCachedJson(storageKey, parsedDesign, ownerWindow.localStorage);

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
              writeCachedJson(
                storageKey,
                parsedDesign,
                ownerWindow.localStorage,
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

              writeCachedJson(
                storageKey,
                mergedElements,
                ownerWindow.localStorage,
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
