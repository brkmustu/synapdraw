# SynapDraw — AI-Native SDLC Super-App

<div align="center">
  <h3>
    Analiz, Sistem Mimarisi, Pixel-Perfect UI/UX Tasarım, Görev Yönetimi ve TDD Test Stüdyosunu tek çatı altında birleştiren uçtan uca yazılım geliştirme çalışma alanı.
  </h3>
</div>

---

## Genel Bakış

**SynapDraw**, yazılım ekiplerinin ve bireysel geliştiricilerin bir projenin **Analiz → Sistem Mimarisi → UI/UX Ekran Tasarımı → Görev Yönetimi (Kanban) → TDD & BDD Test Senaryoları** yaşam döngüsünü kaos yaratmadan tek bir arayüzden yönetmesini sağlar.

Yerleşik **AI Agent Orkestrasyonu** (OpenRouter, Lokal Ollama, OpenAI uyumlu ağ geçitleri) ve **Canlı MCP (Model Context Protocol) Köprüsü** sayesinde hem uygulama içinden hem de harici yapay zeka istemcilerinden (Claude Desktop, Gemini Antigravity, Cursor, VS Code) tüm proje yüzeyleri canlı olarak yönetilebilir.

---

## Temel Çalışma Yüzeyleri

1. **✏️ Analiz & Mimari Çizim Tuvali (`sketch`):**
   - Sonsuz 2B çizim alanı üzerinde iş akışı analizi, sistem mimarisi, ER şemaları, Mermaid diyagramları ve el çizimi tel kafes (wireframe) modelleme.
   - Diyagram düğümlerini doğrudan proje görevlerine (`ProjectTask`) ve TDD senaryolarına derin pinleme.
2. **🎨 UI/UX Tasarım Tuvali (`design`):**
   - **Shadow DOM** izolasyonlu, gerçek HTML/CSS tabanlı pixel-perfect ekran tasarım motoru.
   - Doğal içerik boyutlandırma (**Hug Contents**) ile birlikte Masaüstü (`1440×900`) ve Mobil (`390×844`) artboard çerçeveleri, katman ağacı (Layers) ve CSS Denetçisi (Inspector).
3. **📋 Proje & Görev Yönetimi Panosu (`tasks`):**
   - `Backlog & Analiz`, `Tasarım & Mimari`, `Geliştirmede`, `TDD & Doğrulama` ve `Tamamlandı` aşamalarından oluşan Kanban ve Liste görünümü.
   - Görev kartları üzerinden bağlı analiz çizimlerine, tasarım artboard'larına ve TDD testlerine tek tıkla veya **Yan Yana (`Split-Peek`)** bölünmüş ekranla geçiş.
4. **🧪 TDD & BDD Test Senaryoları Stüdyosu (`tdd`):**
   - Yapılandırılmış **Given (Ön Koşul) / When (Eylem) / Then (Beklenen Sonuç)** kartları ve `Red → Green → Refactor` durum takibi.
   - Görev kabul kriterlerinden otomatik test senaryosu üretimi ve tek tıkla çalıştırılabilir **`Vitest (.test.ts)`**, **`Playwright E2E (.spec.ts)`** ve **`Cucumber BDD (.feature)`** kod dışa aktarımı.
5. **🤖 İnsan + AI Agent Hibrit Ekip Kadrosu:**
   - Proje bazlı özelleştirilebilir AI Agent profilleri (*Analist & PO Agent*, *Sistem Mimarı Agent*, *UI/UX Tasarımcı Agent*, *TDD & QA Agent*).
   - Görev karmaşıklığına göre (`high` / `standard` / `fast`) yerel modeller (**Ollama**) veya bulut ağ geçitleri (**OpenRouter**, **OpenAI**) arasında esnek model yönlendirme ve projeler arası ekip aktarımı.

---

## Hızlı Başlangıç

### 1. Geliştirme Ortamı

```bash
yarn install
yarn start
```

### 2. Docker ile Çalıştırma (`http://localhost:3000`)

```bash
docker build -t synapdraw-local:latest .
docker rm -f synapdraw-web
docker run -d --name synapdraw-web -p 3000:80 synapdraw-local:latest
```

### 3. Canlı MCP Sunucusu (`synapdraw-mcp`)

```bash
cd synapdraw-mcp
npm install
npm run build
npm run serve
```

MCP sunucusu varsayılan olarak `http://localhost:3001` üzerinde çalışır ve aktif çalışma alanı ile gerçek zamanlı SSE (Server-Sent Events) senkronizasyonu sağlar.

---

## Proje Mimarisi ve Dokümantasyon

- [SDLC Super-App UI/UX ve Mimari Yol Haritası](./docs/sdlc_superapp_plan.md)
- [Genel Oturum ve Geliştirme Özeti](./docs/session_summary.md)
- [Katkıda Bulunma Rehberi](./CONTRIBUTING.md)

---

## Lisans

Bu proje [MIT Lisansı](./LICENSE) altında lisanslanmıştır.

---

## Bilgilendirme

> [!NOTE]
> **Bu uygulama bir Excalidraw türevidir.** SynapDraw, açık kaynaklı [Excalidraw](https://github.com/excalidraw/excalidraw) çizim motoru temel alınarak geliştirilmiş; üzerine DOM tabanlı UI/UX Tasarım Tuvali, Proje Görev Yönetimi, TDD Test Stüdyosu, AI Agent Ekip Orkestrasyonu ve Canlı MCP Köprüsü inşa edilmiştir.
