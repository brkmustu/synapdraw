# Uygulama Planı: Tasarım Tuvali (DOM tabanlı, Seçenek C)

Önceki fizibilite raporu: [feasibility_design_canvas.md](file:///C:/Users/mburakmustu/.gemini/antigravity-ide/brain/db9e2a29-0784-42ef-9c0f-ab5f1dd21d6f/feasibility_design_canvas.md)

## Kararlar (sizin cevaplarınız)

| Konu | Karar |
|---|---|
| Tuval tipi kilidi | **Her belge ayrı çalışma alanı.** Tip belge oluşturulurken seçilir, o belge için değişmez. Yeni belgede yeniden seçilebilir. |
| MVP kapsamı | **AI ile üretilen tasarım.** Kullanıcı: seç, taşı, kilitle, incele. Sıfırdan çizim ve elle CSS düzenleme sonraki fazlarda. |
| Excalidraw mirası | Kolaylaştıran her şey alınır; entegrasyonu iş çıkaran her şey yeni motorda ayrı yazılır. |
| Yaklaşım | **C: DOM tabanlı motor** |

> [!IMPORTANT]
> **Yeni bulgu:** Uygulamada şu an "belge" kavramı yok. Tek sahne localStorage'da sabit
> anahtarlarla tutuluyor (`excalidraw`, `excalidraw-state` — bkz.
> [app_constants.ts](file:///c:/Users/mburakmustu/source/repos/excalidraw/excalidraw-app/app_constants.ts#L39-L53)).
> "Belge başına tip" kararı için önce hafif bir **çalışma alanı yöneticisi** gerekiyor
> (Faz 1). Mevcut sahne, ilk açılışta otomatik olarak "Çizim" tipinde ilk belgeye taşınır;
> veri kaybı olmaz.

---

## Excalidraw'dan Miras / Ayrım

| Parça | Karar | Gerekçe |
|---|---|---|
| Uygulama kabuğu, tema, CSS değişkenleri, ikonlar | ✅ Miras | Doğrudan import edilebilir, tutarlı görünüm |
| UI bileşenleri (Island, ToolButton, Popover, Dialog) | ✅ Miras | Bağımsız React bileşenleri |
| `MoveLockedIcon` / `MoveUnlockedIcon`, kilit popup stili | ✅ Miras | Artboard kilit modlarında aynen kullanılır |
| MCP sunucusu, SSE köprüsü, checkpoint store | ✅ Miras | Olay tipine göre yönlendirme eklenir |
| HTML sandbox + ölçüm kodu ([htmlToExcalidraw.ts](file:///c:/Users/mburakmustu/source/repos/excalidraw/excalidraw-app/utils/htmlToExcalidraw.ts)) | 🔶 Kısmi | Sanitize ve sandbox mantığı ortak yardımcıya çıkarılır |
| Akıllı yerleşim ([canvasContext.ts](file:///c:/Users/mburakmustu/source/repos/excalidraw/excalidraw-app/utils/canvasContext.ts)) | 🔶 Kısmi | Algoritma ortak, veri kaynağı motora göre |
| Viewport (pan/zoom) | ❌ Ayrı | Excalidraw'da `AppState` ve canvas render'a sıkı bağlı; DOM için ~200 satırlık basit transform |
| Seçim, sürükleme, hit-test | ❌ Ayrı | Excalidraw geometrisi Rough.js şekillerine göre; DOM'da tarayıcı hit-test'i var |
| Undo/redo (Store/History) | ❌ Ayrı | Excalidraw eleman şemasına bağlı; tasarım belgesi için basit komut yığını |
| Collab (Firebase) | ❌ Ayrı, sonra | Şema farklı; MVP'de tasarım belgelerinde kapalı |
| Mermaid, el çizimi araçları | ❌ Tasarım tuvalinde yok | Pixel-perfect hedefle çelişiyor; Çizim belgelerinde aynen kalıyor |

---

## Faz 0: Önceki Regresyonu Düzelt (0.5 gün)

#### [MODIFY] [typeChecks.ts](file:///c:/Users/mburakmustu/source/repos/excalidraw/packages/element/src/typeChecks.ts)
- `isContainerElement`: genel `isFrameLikeElement` dalı ve `📦` isim kontrolü kaldırılır.
  Yalnızca `customData.isContainerFrame/Card/Header` ve bu frame'lerin çocukları sayılır.
- Sonuç: kullanıcının elle oluşturduğu normal frame'ler yeniden boyutlandırılabilir.

#### [MODIFY] [htmlToExcalidraw.ts](file:///c:/Users/mburakmustu/source/repos/excalidraw/excalidraw-app/utils/htmlToExcalidraw.ts)
- HTML yolundan oluşturulan frame'e de `customData.isContainerFrame: true` eklenir
  (şu an yalnızca `containerHelper.ts` ekliyor).

#### [NEW] `scratch/test_container_no_resize.mjs` (yeniden yazım)
- Sürükleme container içinden başlar; **x/y değişti** ve **width/height aynı** iki ayrı
  kontrol. Normal frame için resize'ın hâlâ çalıştığını da test eder.

---

## Faz 1: Çalışma Alanı ve Tuval Tipi Soyutlaması (2-3 gün)

#### [NEW] `excalidraw-app/workspace/workspaceStore.ts`
- Belge listesi: `{ id, name, canvasType: "sketch" | "design", createdAt, updatedAt }`.
- Belge içeriği belge id'sine göre ayrı anahtarlarda (localStorage / IndexedDB).
- İlk açılışta mevcut sahneyi "Çizim" belgesine taşıyan migrasyon.

#### [NEW] `excalidraw-app/workspace/WorkspaceTabs.tsx` + `.scss`
- Ekranın en tepesinde kulakçık şeridi: açık belgeler + "Yeni" butonu.
- "Yeni" tıklanınca tip seçimi (**Çizim** / **Tasarım**). Oluşturulduktan sonra sekmede
  tip rozeti salt-okunur görünür; değiştirme seçeneği yoktur.

#### [NEW] `excalidraw-app/engine/CanvasEngine.ts`
- Arayüz: `applyEvent(evt)`, `getContext()`, `clear()`, `exportData()`, `supports(evtType)`.

#### [NEW] `excalidraw-app/engine/ExcalidrawEngine.ts`
- [LiveMcpBridge.tsx](file:///c:/Users/mburakmustu/source/repos/excalidraw/excalidraw-app/components/LiveMcpBridge.tsx) içindeki mevcut olay işleme kodu buraya **taşınır**, davranış değişmez.

#### [MODIFY] [LiveMcpBridge.tsx](file:///c:/Users/mburakmustu/source/repos/excalidraw/excalidraw-app/components/LiveMcpBridge.tsx)
- Olayları aktif belgenin motoruna yönlendiren dispatcher olur.
- Desteklenmeyen olay → rozet üzerinde açıklayıcı uyarı + MCP'ye hata bildirimi.

#### [MODIFY] [App.tsx](file:///c:/Users/mburakmustu/source/repos/excalidraw/excalidraw-app/App.tsx)
- Aktif belgenin tipine göre `<Excalidraw>` veya `<DesignCanvas>` render edilir.

---

## Faz 2: Tasarım Motoru MVP (5-7 gün)

Yeni klasör: `excalidraw-app/design/`

| Dosya | Sorumluluk |
|---|---|
| `model.ts` | `DesignDocument`, `Artboard`, `DesignNode` tipleri |
| `DesignCanvas.tsx` | Kök bileşen, viewport + overlay + paneller |
| `Viewport.tsx` | Pan (boşluk/orta tuş/el aracı), zoom (ctrl+tekerlek), CSS transform |
| `ArtboardHost.tsx` | Her artboard Shadow DOM içinde gerçek HTML/CSS render |
| `SelectionOverlay.tsx` | Hover çerçevesi, seçim kutusu, ölçü etiketleri (W×H, x/y) |
| `sanitize.ts` | DOMPurify: `script`, `on*` öznitelikleri, `javascript:` URL'leri yasak |
| `history.ts` | Komut tabanlı undo/redo (taşı, kilitle, MCP güncellemeleri) |
| `persistence.ts` | Belge id'sine göre kaydet/yükle |
| `DesignEngine.ts` | `CanvasEngine` uygulaması |

**MVP kullanıcı etkileşimleri:** artboard seç / taşı (resize yok), iç düğüm seç ve incele,
iki modlu kilit (tam kilit / sadece taşıma) — mevcut ikonlarla.

---

## Faz 3: MCP Araçları — Çekirdek (2-3 gün)

#### [MODIFY] [server.ts](file:///c:/Users/mburakmustu/source/repos/excalidraw/excalidraw-mcp/src/server.ts) + `main.ts`

| Araç | Açıklama |
|---|---|
| `get_canvas_type` | Aktif belgenin tipi ve id'si |
| `design_read_me` | Kurallar: izinli etiketler, token formatı, artboard boyut önerileri |
| `create_artboard` | Ad + boyut (ör. 1440×900, 390×844) |
| `render_design` | HTML + CSS → artboard'a **dönüşümsüz** |
| `get_design_tree` | Düğüm ağacı + computed style + piksel sınırları |
| `update_node_styles` | Düğüm id'sine göre CSS özelliklerini günceller |

- Mevcut araçlar (`render_mermaid`, `render_html` vb.) aynen kalır; aktif belge Tasarım
  ise anlamlı hata döner ("Bu belge tasarım tuvali, `render_design` kullanın").
- Canvas context sync, aktif motorun `getContext()` çıktısını gönderir.

---

## Faz 4: Katmanlar ve Inspector (salt-okunur) (2-3 gün)
- Sol: katman ağacı (artboard → düğümler), tıklayınca tuvalde seçer.
- Sağ: seçili düğümün computed CSS'i, kopyalanabilir (renk, tipografi, spacing, boyut).
- Düzenleme yok (sonraki fazlarda).

## Faz 5: Pixel-Perfect Döngüsü ve Export (3-4 gün)

| Araç | Açıklama |
|---|---|
| `screenshot_artboard` | Artboard PNG'si (1x/2x), `document.fonts.ready` sonrası |
| `compare_with_reference` | Referans görsel ile piksel farkı: yüzde + fark haritası |
| `set_design_tokens` | CSS custom properties (renk, font, spacing) |
| `export_design_code` | Artboard → temiz HTML/CSS dosyası |

---

## Sonraki Fazlar (kapsam dışı, kayıt altında)
- Kullanıcının sıfırdan çizimi (dikdörtgen, metin, görsel araçları)
- Inspector'dan CSS düzenleme, artboard resize, hizalama/dağıtma, snapping
- Auto-layout (flex) görsel düzenleme, component/variant sistemi
- Tasarım belgelerinde collab

---

## Doğrulama Planı

**Otomatik**
- Faz 0: düzeltilmiş Puppeteer testi (container taşınır + boyut sabit; normal frame resize olur).
- Mevcut vitest paketi: `packages/element` ve `packages/excalidraw` testleri regresyon için.
- Faz 1: belge oluştur → tip kilitli → sayfa yenile → tip ve içerik korunur; migrasyon testi.
- Faz 3: her MCP aracı için `curl` / script ile uçtan uca çağrı, Tasarım belgesinde mermaid reddi.
- Faz 5: `render_design` → `screenshot_artboard` → aynı HTML'in Puppeteer'da doğrudan
  render'ıyla `compare_with_reference` → fark ≈ %0 (pixel-perfect kanıtı).

**Manuel**
- Çizim belgesinde önceki tüm özellikler (container, iki modlu kilit, mermaid, HTML) aynı çalışıyor.
- Tasarım belgesinde AI'dan gelen bir landing page'in tarayıcıdaki haliyle birebir görünmesi.

---

## Takvim

| Faz | Süre | Çıktı |
|---|---|---|
| 0 | 0.5 gün | Regresyon düzeltildi, test güvenilir |
| 1 | 2-3 gün | Çalışma alanı sekmeleri, belge başına tip |
| 2 | 5-7 gün | Tasarım tuvali MVP |
| 3 | 2-3 gün | AI tasarımı tuvale aktarabiliyor (**ilk uçtan uca demo**) |
| 4 | 2-3 gün | Katmanlar + inspector |
| 5 | 3-4 gün | Pixel-perfect doğrulama döngüsü + export |

**Toplam ~3-4 hafta.** Her faz sonunda yerel commit (push yok) ve kısa rapor.
