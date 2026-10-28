# SynapDraw — Genel Oturum Özeti (Session Summary)

**Tarih:** 28 Ekim 2026  
**Aktif Branch (Ana Depo & Alt Depo):** `feature/super-app`  
**İlgili Mimari Plan:** [`docs/sdlc_superapp_plan.md`](./sdlc_superapp_plan.md)

Bu doküman, başka bir bilgisayardan veya yeni bir AI Agent oturumundan geliştirmeye devam edildiğinde **şimdiye kadar yapılan tüm mimari, tasarımsal ve yapısal çalışmaları** eksiksiz aktarmak amacıyla hazırlanmıştır.

---

## 1. Git & Depo Yapılandırması (Kronolojik Özet)

1. **`master` Branch'ının Temizlenmesi:**
   - Tasarım tuvali (`DesignCanvas`) geliştirmelerinin başladığı commit (`2eb2f4f8`) tespit edildi.
   - `master` branch'ı, bu geliştirmelerin hemen öncesindeki kararlı commit olan `27eb1a81` (*"feat: rename project to SynapDraw and finalize containerization"*) noktasına çekildi ve uzak depoya (`origin/master`) aktarıldı.
2. **`features/design-canvas` Branch'ı ve Alt Depo Yeniden Adlandırması:**
   - Tasarım tuvali çalışmaları `features/design-canvas` branch'ına taşındı.
   - Alt depo dizini `excalidraw-mcp` yerine **`synapdraw-mcp`** olarak yeniden adlandırıldı ve `.gitmodules` ile uygulama içi referansları (`AIIntegrationsModal.tsx`, `package.json`) güncellendi.
3. **`feature/super-app` Branch'ı:**
   - SynapDraw'ı uçtan uca bir yazılım yaşam döngüsü (**SDLC Super-App**) aracına dönüştüren çalışmalar, hem ana depoda (`synapdraw`) hem de MCP alt deposunda (`synapdraw-mcp`) **`feature/super-app`** branch'ı altında toplandı.

---

## 2. Tamamlanan Çalışmalar

### Aşama A: Excalidraw Tasarım Sistemi Uyumluluğu (`DesignCanvas` & `WorkspaceTabs`)
Excalidraw türevi olan uygulamada sonradan eklenen bileşenlerin (sekme çubuğu, yeni tuval modalı, tasarım tuvali araç çubuğu, artboard çerçeve başlıkları, katmanlar ve denetçi panelleri) Excalidraw'ın kendi tasarım diliyle %100 uyumlu olması sağlandı:

- **Kullanılan Excalidraw Tasarım Token'ları:**
  - Yüzey ve Paneller: `var(--island-bg-color)`, `var(--shadow-island)`, `var(--default-border-color)`, `var(--border-radius-lg)`
  - Buton ve Kontroller: `var(--color-surface-low)`, `var(--color-surface-mid)`, `var(--button-hover-bg)`
  - Seçili / Aktif Durumlar: `var(--color-surface-primary-container)`, `var(--color-on-primary-container)`, `var(--color-primary)`
  - Yazı Tipi: `var(--ui-font)` (`Assistant`, system-ui)
- **Önemli CSS İzolasyonu Notu:**
  - `packages/excalidraw/css/styles.scss` içerisindeki `.excalidraw input[type="text"]` ve `.excalidraw textarea:not(.excalidraw-wysiwyg)` seçicileri yüksek özgüllüğe (specificity) sahiptir ve global olarak `white-space: nowrap; padding: 0.75rem;` uygular.
  - Bu nedenle `WorkspaceTabs.scss`, `DesignCanvas.scss` ve `sdlc.scss` içerisindeki özel form elemanlarında `input.sinif-adi` ve `textarea.sinif-adi` seçicileriyle `padding`, `height`, `border` ve `white-space: pre-wrap` özellikleri korunmuştur.
- **Tasarım Tuvali (`DesignCanvas`) Yetenekleri:**
  - Bileşenlerin sabit `1440x900` çerçeveye zorlanmadan kendi doğal CSS boyutlarında (**`Hug Contents`**) veya isteğe bağlı Masaüstü (`1440×900`) / Mobil (`390×844`) çerçevelerde **Shadow DOM** izolasyonuyla render edilmesi.
  - Sol üstte **Katmanlar (Layers)**, sağda **Tasarım Denetçisi (Inspector)** ve alt ortada Excalidraw zoom barıyla uyumlu yakınlaştırma kontrolleri.

---

### Aşama B: SDLC Super-App Dönüşümü (`feature/super-app`)

Bir yazılımcının (veya PM, PO, QA ve AI Agent'lardan oluşan hibrit bir ekibin) analizden tasarıma, görev yönetiminden TDD test senaryolarına kadar tüm süreci **kaos yaşamadan** tek arayüzden yürütebilmesi için aşağıdaki mimari inşa edildi:

#### 1. Veri ve Durum Katmanı ([`excalidraw-app/workspace/workspaceStore.ts`](../excalidraw-app/workspace/workspaceStore.ts))
- **Çoklu Proje (`SDLCProject`):** Her proje kendi dokümanlarını, görevlerini, TDD senaryolarını ve ekip kadrosunu barındırır.
- **5 Doküman Kategorisi (`DocumentCategory`) ve 4 Yüzey Motoru (`CanvasType`):**
  1. `analysis` (`sketch` - Excalidraw): İş akışı ve analiz diyagramları
  2. `architecture` (`sketch` - Excalidraw): Sistem mimarisi, servis sınırları, ER diyagramları
  3. `ui_design` (`design` - DesignCanvas): Pixel-perfect CSS/HTML ekran tasarımları
  4. `task_board` (`tasks` - TaskBoardSurface): Proje görev ve koordinasyon panosu
  5. `tdd_suite` (`tdd` - TDDStudioSurface): TDD & BDD test senaryoları stüdyosu
- **Açık Sekmeler vs. Proje Ağacı (`openTabIds`):** Üst barda yalnızca açık sekmeler gösterilir; bir sekmeyi kapatmak (`closeWorkspaceTab`) dokümanı projeden silmez, yalnızca üst bardan kaldırır.
- **Otomatik Migrasyon ve Başlangıç Verisi (Seeding):** Mevcut `localStorage` verileri korunarak örnek görevler (`TASK-1..3`), TDD senaryoları (`TEST-1..3`) ve İnsan + AI Agent ekip kadrosu otomatik oluşturulur.

#### 2. Proje Gezgini ve Üst Navigasyon ([`excalidraw-app/workspace/WorkspaceTabs.tsx`](../excalidraw-app/workspace/WorkspaceTabs.tsx))
- **Sol Üst Proje Gezgini Çekmecesi (`Project Explorer Island`):**
  - Aktif projeyi değiştirme veya yeni proje oluşturma.
  - Proje altındaki tüm analiz, mimari, tasarım, görev panosu ve TDD paketlerini evrelere göre gruplanmış ağaç yapısında görüntüleme ve filtreleme.
- **Üst Bar Aksiyonları:**
  - **Yan Yana (`Split-Peek`):** Aktif ekranın yanına ikinci bir çalışma yüzeyi açma.
  - **Bağlam (`G · T`):** Aktif tuvale bağlı görev ve TDD testlerini sağ çekmecede açma.
  - **Ekip & Agent:** İnsan ve AI Agent ekip kadrosunu yönetme.

#### 3. Proje & Görev Yönetimi Yüzeyi ([`excalidraw-app/sdlc/TaskBoardSurface.tsx`](../excalidraw-app/sdlc/TaskBoardSurface.tsx))
- **Kanban & Liste Görünümü:** `Backlog`, `Yapılacak`, `Geliştirmede`, `TDD / Doğrulama`, `Tamamlandı` sütunları.
- **Çapraz Bağlantı Rozetleri (Cross-Artifact Chips):** Görev kartlarının üzerinde bağlı Analiz/Mimari/Tasarım tuvalleri ve TDD test geçiş oranları (`2/3 Green`) doğrudan tıklanabilir rozetler halinde yer alır.
- **Sağ Görev Detay & Koordinasyon Çekmecesi:**
  - Kabul Kriterleri (Acceptance Criteria) kontrol listesi.
  - **"Kabul Kriterlerinden TDD Üret"** butonu ile görevdeki kriterleri tek tıkla `TDDStudioSurface` altında Given/When/Then test senaryolarına dönüştürme.
  - Bağlı dokümanları tek tıkla tam ekran veya **Yan Yana (`Split-Peek`)** açma.
  - Ekip üyeleri (PM, PO, Dev, QA) ve AI Agent'lar adına koordinasyon notu/yorum ekleme.

#### 4. TDD & BDD Test Senaryoları Stüdyosu ([`excalidraw-app/sdlc/TDDStudioSurface.tsx`](../excalidraw-app/sdlc/TDDStudioSurface.tsx))
- **TDD Döngüsü:** `🔴 Red (Geçmiyor)`, `🟢 Green (Geçti)`, `🟣 Refactor`, `⚪ Draft (Taslak)` durum filtreleri ve canlı kapsama (pass-rate) çubuğu.
- **Yapılandırılmış BDD Blokları:** Her test kartında **GIVEN (Ön Koşul)**, **WHEN (Tetiklenen Eylem)** ve **THEN (Beklenen Sonuç)** blokları ile etkileşimli **Alt Doğrulamalar (Assertions)** listesi bulunur.
- **Görevlerle Çift Yönlü Senkronizasyon:** "Görev Kriterlerinden Senkronize Et" butonuyla projedeki görevlerin kabul kriterlerinden eksik TDD senaryoları otomatik üretilir.

#### 5. Yan Yana Görünüm (`Split-Peek`), Bağlam Çekmecesi & Ekip Kadrosu ([`excalidraw-app/sdlc/ContextAndTeamDrawers.tsx`](../excalidraw-app/sdlc/ContextAndTeamDrawers.tsx), [`excalidraw-app/App.tsx`](../excalidraw-app/App.tsx))
- **Akıllı `Split-Peek` Mimarisi:** `<Excalidraw>` bileşeni uygulama genelinde tekil (singleton) olduğundan, bir `sketch` (Analiz/Mimari) tuvali ile `design` / `tasks` / `tdd` yüzeyi yan yana açıldığında `setSplitWorkspaceId` otomatik olarak `sketch` tuvalini sol ana bölmeye, diğer yüzeyi sağ bölünmüş bölmeye yerleştirir; böylece her iki ekran da aynı anda %100 canlı ve etkileşimli çalışır.
- **`SDLCContextDrawer`:** Çizim veya tasarım tuvalinden ayrılmadan, o tuvale bağlı görevleri ve TDD testlerini sağ kenarda yüzen bir Excalidraw `.Island` çekmecesinde gösterir ve durumlarını değiştirmeye izin verir.
- **`TeamRosterModal`:** Projeye insan ekip arkadaşları veya özelleştirilmiş sistem prompt'una sahip **AI Agent**'lar (*PO & Analist Agent*, *Sistem Mimarı Agent*, *UI/UX Tasarımcı Agent*, *TDD & QA Agent*) ekleme/çıkarma imkânı sunar.

#### 6. Canlı MCP Araçları ([`synapdraw-mcp/src/server.ts`](../synapdraw-mcp/src/server.ts), [`excalidraw-app/components/LiveMcpBridge.tsx`](../excalidraw-app/components/LiveMcpBridge.tsx))
Harici AI Agent'ların ve IDE'lerin projedeki tüm SDLC verileriyle canlı etkileşime girebilmesi için 3 yeni MCP aracı eklendi:
- `get_project_sdlc_overview`: Aktif projenin tüm tuvallerini, görevlerini, TDD senaryolarını ve ekip kadrosunu JSON olarak döner.
- `upsert_project_task`: Kanban panosuna yeni görev ekler veya mevcut görevi (durum, öncelik, bağlı tuvaller) günceller.
- `upsert_tdd_scenario`: TDD stüdyosuna yeni Given/When/Then test senaryosu ekler veya durumunu (`red` / `green` / `refactor`) günceller.

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
   docker build -t excalidraw-local:latest .
   docker rm -f excalidraw-web
   docker run -d --name excalidraw-web -p 3000:80 excalidraw-local:latest
   ```
3. **MCP Sunucusunu Derleme (`synapdraw-mcp`):**
   ```bash
   bun run --cwd synapdraw-mcp build
   ```

---

## 4. Sıradaki Potansiyel Geliştirme Adımları (Next Steps)

Başka bilgisayarda oturuma devam ederken odaklanılabilecek bir sonraki adımlar:
1. **Eleman / Artboard Bazlı Derin Pinleme (Deep-Linking):**
   - Şu anda görevler ve TDD testleri doküman (`WorkspaceDocument`) düzeyinde bağlanabiliyor; bir sonraki adımda çizim tuvalindeki belirli bir `Frame` ID'sine veya tasarım tuvalindeki belirli bir `Artboard` ID'sine tıklandığında kameranın doğrudan o koordinata zoom yapması (`scrollToContent` / `focusArtboard`).
2. **AI Agent Görev Orkestrasyonu ("Agent ile Çalıştır" Aksiyonu):**
   - Görev kartı üzerinde atanan kişi bir `ai_agent` olduğunda, kart üzerindeki **"🤖 Agent'ı Çalıştır"** butonuyla ilgili AI Agent'ın sistem promptu + görev bağlamını kullanarak doğrudan bağlı tuvale çizim/tasarım veya TDD senaryosu üretmesi.
3. **Proje Dışa/İçe Aktarma (JSON Bundle Export/Import):**
   - Tüm projenin (Analiz çizimleri + Mimari diyagramlar + Tasarım Artboard'ları + Görevler + TDD Senaryoları + Ekip Kadrosu) tek bir `.synapdraw.json` paketi olarak dışa ve içe aktarılabilmesi.
