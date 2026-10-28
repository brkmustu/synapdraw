import type {
  ProjectTask,
  TDDScenario,
  TeamMember,
  WorkspaceDocument,
} from "./types";

export function getDefaultTeamForProject(projectId: string): TeamMember[] {
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

export function buildSeededTasks(
  projectId: string,
  docs: WorkspaceDocument[],
  team: TeamMember[],
): ProjectTask[] {
  const sketchDocs = docs.filter((d) => d.canvasType === "sketch");
  const designDocs = docs.filter((d) => d.canvasType === "design");
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

export function buildSeededTDDScenarios(
  projectId: string,
  tasks: ProjectTask[],
  docs: WorkspaceDocument[],
  team: TeamMember[],
): TDDScenario[] {
  const designDocs = docs.filter((d) => d.canvasType === "design");
  const sketchDocs = docs.filter((d) => d.canvasType === "sketch");
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
