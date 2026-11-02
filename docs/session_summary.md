# SynapDraw — Genel Oturum Özeti (Session Summary)

**Tarih:** 2 Kasım 2026  
**Aktif Branch (Ana Depo & Alt Depo):** `feature/super-app`  
**İlgili Mimari Plan:** [`docs/sdlc_superapp_plan.md`](./sdlc_superapp_plan.md)

Bu doküman, başka bir bilgisayardan veya yeni bir oturumdan geliştirmeye devam edildiğinde **şimdiye kadar yapılan mimari, tasarımsal ve deneysel SDLC çalışmalarını** aktarmak amacıyla hazırlanmıştır. Uygulamadaki yazılım geliştirme yaşam döngüsü (SDLC) yüzeyleri ve AI agent tanımlama/tetikleme özellikleri halen **geliştirme aşamasındadır**.

---

## 1. Git & Depo Yapılandırması (Kronolojik Özet)

1. **`master` Branch'ının Temizlenmesi:**
   - Tasarım tuvali (`DesignCanvas`) geliştirmelerinin başladığı commit (`2eb2f4f8`) tespit edildi.
   - `master` branch'ı, bu geliştirmelerin hemen öncesindeki kararlı commit olan `27eb1a81` (*"feat: rename project to SynapDraw and finalize containerization"*) noktasına çekildi ve uzak depoya (`origin/master`) aktarıldı.
2. **`features/design-canvas` Branch'ı ve Alt Depo Yeniden Adlandırması:**
   - Tasarım tuvali çalışmaları `features/design-canvas` branch'ına taşındı.
   - Alt depo dizini **`synapdraw-mcp`** olarak yeniden adlandırıldı ve `.gitmodules` ile uygulama içi referansları (`AIIntegrationsModal.tsx`, `package.json`) güncellendi.
3. **`feature/super-app` Branch'ı:**
   - SynapDraw'ı uçtan uca bir yazılım yaşam döngüsü (**SDLC Super-App**) aracına dönüştüren çalışmalar, hem ana depoda (`synapdraw`) hem de MCP alt deposunda (`synapdraw-mcp`) **`feature/super-app`** branch'ı altında toplandı.

---

## 2. Tamamlanan Çalışmalar

### Aşama A: SynapDraw Tasarım Sistemi Uyumluluğu (`DesignCanvas` & `WorkspaceTabs`)
Uygulamada sonradan eklenen bileşenlerin (sekme çubuğu, yeni tuval modalı, tasarım tuvali araç çubuğu, artboard çerçeve başlıkları, katmanlar ve denetçi panelleri) SynapDraw'ın kendi tasarım diliyle %100 uyumlu olması sağlandı:

- **Kullanılan Tasarım Token'ları:**
  - Yüzey ve Paneller: `var(--island-bg-color)`, `var(--shadow-island)`, `var(--default-border-color)`, `var(--border-radius-lg)`
  - Buton ve Kontroller: `var(--color-surface-low)`, `var(--color-surface-mid)`, `var(--button-hover-bg)`
  - Seçili / Aktif Durumlar: `var(--color-surface-primary-container)`, `var(--color-on-primary-container)`, `var(--color-primary)`
  - Yazı Tipi: `var(--ui-font)` (`Assistant`, system-ui)
- **Önemli CSS İzolasyonu Notu:**
  - Global `styles.scss` içerisindeki `input[type="text"]` ve `textarea` seçicileri yüksek özgüllüğe (specificity) sahiptir ve global olarak `white-space: nowrap; padding: 0.75rem;` uygular.
  - Bu nedenle `WorkspaceTabs.scss`, `DesignCanvas.scss` ve `sdlc.scss` içerisindeki özel form elemanlarında `input.sinif-adi` ve `textarea.sinif-adi` seçicileriyle `padding`, `height`, `border` ve `white-space: pre-wrap` özellikleri korunmuştur.
- **Tasarım Tuvali (`DesignCanvas`) Yetenekleri:**
  - Bileşenlerin sabit `1440x900` çerçeveye zorlanmadan kendi doğal CSS boyutlarında (**`Hug Contents`**) veya isteğe bağlı Masaüstü (`1440×900`) / Mobil (`390×844`) çerçevelerde **Shadow DOM** izolasyonuyla render edilmesi.
  - Sol üstte **Katmanlar (Layers)**, sağda **Tasarım Denetçisi (Inspector)** ve alt ortada çizim tuvali zoom barıyla uyumlu yakınlaştırma kontrolleri.

---

### Aşama B: Geliştirme Aşamasındaki SDLC Özellikleri (`feature/super-app`)

Analiz, ekran tasarımı, görev takibi ve TDD test senaryoları arasında bağlantı kurabilmek adına geliştirilmekte olan özellikler:

#### 1. Veri ve Durum Katmanı (`workspace/workspaceStore.ts`)
- **Çoklu Proje (`SDLCProject`):** Her proje kendi dokümanlarını, görevlerini, TDD senaryolarını ve ekip kadrosunu barındırır.
- **5 Doküman Kategorisi (`DocumentCategory`) ve 4 Yüzey Motoru (`CanvasType`):**
  1. `analysis` (`sketch` - Çizim Motoru): İş akışı ve analiz diyagramları
  2. `architecture` (`sketch` - Çizim Motoru): Sistem mimarisi, servis sınırları, ER diyagramları
  3. `ui_design` (`design` - DesignCanvas): Pixel-perfect CSS/HTML ekran tasarımları
  4. `task_board` (`tasks` - TaskBoardSurface): Proje görev ve koordinasyon panosu
  5. `tdd_suite` (`tdd` - TDDStudioSurface): TDD & BDD test senaryoları stüdyosu
- **Açık Sekmeler vs. Proje Ağacı (`openTabIds`):** Üst barda yalnızca açık sekmeler gösterilir; bir sekmeyi kapatmak (`closeWorkspaceTab`) dokümanı projeden silmez, yalnızca üst bardan kaldırır.
- **Otomatik Migrasyon ve Başlangıç Verisi (Seeding):** Mevcut `localStorage` verileri korunarak örnek görevler (`TASK-1..3`), TDD senaryoları (`TEST-1..3`) ve İnsan + AI Agent ekip kadrosu otomatik oluşturulur.

#### 2. Proje Gezgini ve Üst Navigasyon (`workspace/WorkspaceTabs.tsx`)
- **Sol Üst Proje Gezgini Çekmecesi (`Project Explorer Island`):**
  - Aktif projeyi değiştirme veya yeni proje oluşturma.
  - Proje altındaki tüm analiz, mimari, tasarım, görev panosu ve TDD paketlerini evrelere göre gruplanmış ağaç yapısında görüntüleme ve filtreleme.
- **Üst Bar Aksiyonları:**
  - **Yan Yana (`Split-Peek`):** Aktif ekranın yanına ikinci bir çalışma yüzeyi açma.
  - **Bağlam (`G · T`):** Aktif tuvale bağlı görev ve TDD testlerini sağ çekmecede açma.
  - **Ekip & Agent:** İnsan ve AI Agent ekip kadrosunu yönetme.

#### 3. Proje & Görev Yönetimi Yüzeyi (`sdlc/TaskBoardSurface.tsx`)
- **Kanban & Liste Görünümü:** `Backlog`, `Yapılacak`, `Geliştirmede`, `TDD / Doğrulama`, `Tamamlandı` sütunları.
- **Çapraz Bağlantı Rozetleri (Cross-Artifact Chips):** Görev kartlarının üzerinde bağlı Analiz/Mimari/Tasarım tuvalleri ve TDD test geçiş oranları (`2/3 Green`) doğrudan tıklanabilir rozetler halinde yer alır.
- **Sağ Görev Detay & Koordinasyon Çekmecesi:**
  - Kabul Kriterleri (Acceptance Criteria) kontrol listesi.
  - **"Kabul Kriterlerinden TDD Üret"** butonu ile görevdeki kriterleri tek tıkla `TDDStudioSurface` altında Given/When/Then test senaryolarına dönüştürme.
  - Bağlı dokümanları tek tıkla tam ekran veya **Yan Yana (`Split-Peek`)** açma.
  - Ekip üyeleri (PM, PO, Dev, QA) ve AI Agent'lar adına koordinasyon notu/yorum ekleme.

#### 4. TDD & BDD Test Senaryoları Stüdyosu (`sdlc/TDDStudioSurface.tsx`)
- **TDD Döngüsü:** `🔴 Red (Geçmiyor)`, `🟢 Green (Geçti)`, `🟣 Refactor`, `⚪ Draft (Taslak)` durum filtreleri ve canlı kapsama (pass-rate) çubuğu.
- **Yapılandırılmış BDD Blokları:** Her test kartında **GIVEN (Ön Koşul)**, **WHEN (Tetiklenen Eylem)** ve **THEN (Beklenen Sonuç)** blokları ile etkileşimli **Alt Doğrulamalar (Assertions)** listesi bulunur.
- **Görevlerle Çift Yönlü Senkronizasyon:** "Görev Kriterlerinden Senkronize Et" butonuyla projedeki görevlerin kabul kriterlerinden eksik TDD senaryoları otomatik üretilir.

#### 5. Yan Yana Görünüm (`Split-Peek`), Bağlam Çekmecesi & Ekip Kadrosu (`sdlc/ContextAndTeamDrawers.tsx`, `App.tsx`)
- **Akıllı `Split-Peek` Mimarisi:** Çizim tuvali bileşeni uygulama genelinde tekil (singleton) olduğundan, bir `sketch` (Analiz/Mimari) tuvali ile `design` / `tasks` / `tdd` yüzeyi yan yana açıldığında `setSplitWorkspaceId` otomatik olarak `sketch` tuvalini sol ana bölmeye, diğer yüzeyi sağ bölünmüş bölmeye yerleştirir; böylece her iki ekran da aynı anda %100 canlı ve etkileşimli çalışır.
- **`SDLCContextDrawer`:** Çizim veya tasarım tuvalinden ayrılmadan, o tuvale bağlı görevleri ve TDD testlerini sağ kenarda yüzen bir `.Island` çekmecesinde gösterir ve durumlarını değiştirmeye izin verir.
- **`TeamRosterModal`:** Projeye insan ekip arkadaşları veya özelleştirilmiş sistem prompt'una sahip **AI Agent**'lar (*PO & Analist Agent*, *Sistem Mimarı Agent*, *UI/UX Tasarımcı Agent*, *TDD & QA Agent*) ekleme/çıkarma imkânı sunar.

#### 6. Genişletilmiş MCP Araçları (`synapdraw-mcp/src/server.ts`, `components/LiveMcpBridge.tsx`)
Mevcut MCP altyapısına ek özellikler kazandırılarak harici yapay zeka agent'ları ve istemcileriyle birlikte kullanılabilecek yapı iyileştirildi:
- `get_project_sdlc_overview`: Aktif projenin tuvallerini, görevlerini, TDD senaryolarını ve ekip listesini JSON olarak döner.
- `upsert_project_task`: Görev panosuna yeni görev ekler veya mevcut görevi günceller.
- `upsert_tdd_scenario`: TDD alanına yeni Given/When/Then test senaryosu ekler veya durumunu günceller.

---

## 3. Başka Bilgisayarda Kurulum ve Çalıştırma Rehberi

1. **Depoyu ve Alt Depoyu Çekme:**
   ```bash
   git fetch --all
   git checkout feature/super-app
   git pull origin feature/super-app

   cd synapdraw-mcp
   git fetch --all
   git checkout feature/super-app
   git pull origin feature/super-app
   cd ..
   ```
2. **Web Uygulamasını Docker ile Derleme ve Başlatma (`http://localhost:3000`):**
   ```bash
   docker build -t synapdraw-local:latest .
   docker rm -f synapdraw-web
   docker run -d --name synapdraw-web -p 3000:80 synapdraw-local:latest
   ```
3. **MCP Sunucusunu Derleme (`synapdraw-mcp`):**
   ```bash
   bun run --cwd synapdraw-mcp build
   ```

---

## 4. Son İterasyonda Tamamlanan İleri Seviye SDLC Özellikleri

1. **Eleman / Artboard Bazlı Derin Pinleme ve Otomatik Odaklama (`requestArtboardFocus` & `toggleTaskArtboardLink`):**
   - `DesignCanvas.tsx` üst araç çubuğuna, bir Artboard seçildiğinde aktifleşen **"🔗 Görev Bağlantısı"** menüsü eklendi. Seçili Artboard tek tıkla projedeki herhangi bir göreve (`ProjectTask.linkedArtboards`) bağlanabilir veya bağlantısı kaldırılabilir.
   - `TaskBoardSurface.tsx` ve `SDLCContextDrawer` içerisindeki görev kartlarında bağlı Artboard'lar (`🎨 Artboard Adı`) rozeti olarak listelenir; tıklandığında ilgili Tasarım Tuvali (tam ekran veya `Split-Peek` yan yana) açılır ve kamera otomatik olarak o Artboard'un koordinatlarına odaklanır (`fitZoom` + `panX/panY`).
2. **AI Agent Görev Orkestrasyonu (`executeAgentOnTask` — "🤖 Agent ile Çalıştır"):**
   - Görev kartları, Görev Detay Çekmecesi ve Sağ Bağlam Çekmecesi içerisine **AI Agent Görev Orkestrasyonu** aksiyonları eklendi:
     - **🎨 UI Tasarla (`design`):** Görevin başlığı, açıklaması ve kabul kriterlerini temel alarak bağlı Tasarım Tuvalinde doğal boyutlu (`Hug Contents`) pixel-perfect bir HTML/CSS Artboard üretir, Artboard'u göreve bağlar, göreve AI Agent koordinasyon yorumu yazar ve ekranı otomatik olarak `Split-Peek` (Yan Yana) modunda açıp yeni Artboard'a odaklanır.
     - **🧪 TDD Üret (`tdd`):** Görevin kabul kriterlerinden BDD (`Given / When / Then`) kabul testleri ve uç durum (`edge-case` / `unit`) test senaryoları üretir, görevi `TDD & Doğrulama` sütununa taşır ve QA Agent raporu yazar.
     - **📋 Kriter Analizi (`analysis`):** Eksik kabul kriterlerini yapılandırır, analiz/mimari tuvali bağlantısını kurar ve Analist Agent notu düşer.
3. **Taşınabilir Proje Paketi Dışa / İçe Aktarma (`.synapdraw.json` Bundle Export / Import):**
   - Farklı bilgisayarlar arasında kesintisiz geçiş için **Proje Gezgini (Project Explorer Drawer)** alt barına **"📦 Projeyi İndir (.json)"** ve **"📂 Proje Yükle"** butonları eklendi (`exportProjectBundle`, `importProjectBundle`).
   - Tek bir `.synapdraw.json` dosyası; proje üst verisini, tüm açık/kapalı çalışma yüzeylerini, çizim sahnelerini (`synapdraw_ws_${id}_elements`), DesignCanvas artboard'larını (`synapdraw_design_doc_${id}`), Kanban görevlerini, TDD test senaryolarını ve İnsan + AI Agent ekip kadrosunu eksiksiz taşır.
4. **Çizim / Mimari Tuvali Derin Pinleme ve "Çizimden Göreve" Akışı (`requestSketchFocus` & `toggleTaskSketchLink`):**
   - Herhangi bir Analiz veya Mimari (`sketch`) tuvalindeyken sağdaki **Bağlam (`SDLCContextDrawer`)** çekmecesi açıldığında, tuvalde seçili olan çizim elemanları ve metin düğümleri algılanır.
   - **"➕ Bu Akıştan Görev (Task) Oluştur & Pinle"** ile seçili diyagram akışı doğrudan kabul kriterleriyle birlikte yeni bir göreve dönüştürülür ve eleman kimlikleri (`elementIds`) göreve pinlenir (`ProjectTask.linkedSketchRefs`).
   - Görev kartlarındaki `📐 Şema Adı` rozetine tıklandığında ilgili çizim tuvali açılır ve kamera otomatik olarak o diyagram elemanlarına odaklanır.
5. **Sistem Mimarı Agent (`🏗️ Mimari Şema Çiz`) ve Canlı LLM Agent Zinciri (`runLiveAgentPipeline`):**
   - Görev orkestrasyonuna **`🏗️ Mimari Şema Çiz`** aksiyonu eklendi; Sistem Mimarı Agent, görev ve kabul kriterleri için çok katmanlı (*UI / İstemci → İş Mantığı Servisi → Veri & Olay Katmanı*) mimari diyagramı doğrudan **Sistem Mimarisi** tuvaline çizer, göreve pinler ve kamerayı diyagrama odaklar.
   - `runLiveAgentPipeline`, yapılandırılmış canlı LLM (Ollama, OpenRouter veya OpenAI uyumlu endpoint) erişilebilir olduğunda canlı modelden üretim yapar; çevrimdışı durumda kesintisiz olarak yerel deterministik motora başvurur.
6. **TDD Stüdyosundan Çalıştırılabilir Test Kodu Üretimi (`generateExecutableTestSpec`):**
   - `TDDStudioSurface.tsx` üst barına ve senaryo detay çekmecesine **"💻 Test Kodu"** çekmecesi eklendi.
   - Seçili senaryoyu veya tüm test paketini tek tıkla **`Vitest (.test.ts)`**, **`Playwright E2E (.spec.ts)`** veya **`Cucumber BDD (.feature)`** koduna dönüştürür; panoya kopyalama ve dosya olarak indirme imkânı sunar.
7. **SDLC İzlenebilirlik & Eksik Halka Denetçisi (`computeProjectTraceabilityPulse`):**
   - Sol üstteki **Proje Gezgini** çekmecesine eklenen **📊 SDLC İzlenebilirlik Özeti** kartı; görev tamamlanma yüzdesini, TDD geçiş oranını, henüz TDD testi yazılmamış görevleri (tek tıkla **`⚡ Üret`** aksiyonuyla birlikte) ve görsel bağlantısı eksik görevleri anlık olarak denetler.
8. **Proje Görev Yönetim Panosu & SDLC Yüzeyleri Mikro-Boşluk (Micro-Spacing) İyileştirmesi:**
   - Global `.Island` kuralının (`--padding: 0`) `.sdlc-task-card`, `.tdd-scenario-card` ve `.sdlc-top-island` iç boşluklarını sıfırlaması (`0px`) giderildi; minimalist yapı korunarak kart içlerine, sütun aralıklarına, rozet satırlarına ve alt bilgi barlarına dengeli mikro-boşluklar eklendi (`sdlc.scss`).
9. **SDLC AI & MCP Orkestrasyon Stüdyosu (`AIIntegrationsModal.tsx` & `AIIntegrationsModal.scss`):**
   - Eski stüdyo ekranı, SynapDraw tasarım sistemiyle (`--island-bg-color`, `--color-surface-low`, `--color-surface-mid`, `--color-primary`, SVG ikonlar) tam uyumlu **SDLC AI & MCP Stüdyosu**'na dönüştürüldü; sağ üstteki çift kapatma (`X`) çakışması, tuval bazlı tam ekran/modal boyut tutarsızlığı ve global `textarea`/`input` özgüllük sorunları giderildi.
   - Hem yerleşik AI sohbetinden tüm proje kaynaklarını (*Analiz/Mimari Şema*, *UI Tasarım*, *Görev & Kriter Üretimi*, *TDD Test Üretimi*) orkestre etme yeteneği eklendi hem de **Claude Desktop** ve **Gemini Antigravity** üzerinden `synapdraw-mcp` (11 SDLC + Tuval MCP aracı) ile harici orkestrasyon için özel **MCP** sekmesi ve canlı kaynak şeridi sunuldu.
10. **Proje Bazlı AI Agent Model Yönlendirme (OpenRouter / Lokal Ollama) & Projeler Arası Ekip Aktarımı:**
    - Her bir `TeamMember` (`ai_agent`) için **Görev Karmaşıklık Seviyesi (`complexityTier`: `high` | `standard` | `fast`)**, **Model Sağlayıcı (`modelProvider`: `openrouter` | `ollama` | `openai` | `custom`)** ve **Model Kimliği (`modelId`: örn. `anthropic/claude-3.7-sonnet`, `google/gemini-2.5-pro`, `qwen2.5-coder:7b`, `gemma4:26b`)** tanımlama ve düzenleme desteği eklendi (`workspaceStore.ts`, `ContextAndTeamDrawers.tsx`).
    - Sol üstteki **Proje Gezgini** çekmecesine (**`PROJE EKİBİ & AI AGENT`** bölümü) aktif projenin kadrosu ve atanmış model etiketleri eklendi; ayrıca **`+ Yeni Proje`** oluştururken mevcut bir projenin ekibini doğrudan yeni projeye aktarma seçeneği sunuldu (`WorkspaceTabs.tsx`).
    - **`TeamRosterModal`** 3 sekmeli yapıya kavuşturuldu:
      1. *Proje Kadrosu & Agent Tanımla* (mevcut agent'a tıklayarak modelini/sağlayıcısını anında güncelleme),
      2. *Projeler Arası Ekip Aktar* (`cloneTeamMembersToProject` ile başka projeden seçili agent/üyeleri veya tüm ekibi tek tıkla kopyalama),
      3. *OpenRouter & Lokal Gateway Ayarları* (`getAIProviderGatewayConfig` ile `OpenRouter` ve `Ollama` canlı model kataloğu çekme).

---

## 5. Sonraki Oturum İçin Yol Haritası (Gelecek Çalışmalar)

Ön yüz (UI/UX), 5 temel SDLC yüzeyi, derin pinleme, AI Agent orkestrasyonu ve MCP entegrasyonu tamamlandı. Sonraki aşamada ele alınacak altyapısal başlıklar:

1. **Kalıcı Veritabanı ve Sunucu Katmanı (Persistence & Backend Storage):**
   - Şu anda `localStorage` + `.synapdraw.json` paket dışa/içe aktarma ile çalışan proje grafiğinin (`SDLCProject`, `WorkspaceDocument`, `ProjectTask`, `TDDScenario`, `TeamMember`, çizim sahneleri ve DesignCanvas artboard'ları) SQLite / PostgreSQL tabanlı bir arka uç API'sine bağlanması.
2. **Gerçek Zamanlı Çok Kullanıcılı ve Çoklu Agent Eşitlemesi (WebSocket / CRDT):**
   - Yazılımcı, PM, PO, QA ve harici MCP Agent'larının aynı proje üzerinde eşzamanlı yaptığı değişikliklerin anlık senkronizasyonu.
3. **Canlı Test Koşucu (Test Runner) Köprüsü:**
   - TDD Stüdyosunda üretilen `Vitest` / `Playwright` testlerinin yerel geliştirme ortamında (`synapdraw-mcp` üzerinden) koşturulup test sonuçlarının (`Red` / `Green`) otomatik olarak kartlara yansıtılması.
