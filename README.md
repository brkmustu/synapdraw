<div align="center">
  <h1>
    <img src="./synapdraw-app/public/favicon.svg" alt="SynapDraw Logo" width="38" height="38" valign="middle" />
    &nbsp;SynapDraw
  </h1>
  <p>
    Çizim ve diyagram tuvalinin yanı sıra ekran tasarımı, görev takibi ve test senaryosu yönetimi sunan çalışma alanı.
  </p>
</div>

---

## Genel Bakış

**SynapDraw**, temel çizim ve diyagram oluşturma yeteneklerinin üzerine yazılım geliştirme yaşam döngüsü (SDLC) süreçlerine yardımcı olabilecek ek çalışma yüzeyleri kazandırmak amacıyla oluşturulmuştur.

Mevcut MCP (Model Context Protocol) yapısına ek araçlar kazandırılarak harici yapay zeka istemcileriyle (Claude Desktop, Gemini Antigravity vb.) birlikte çizim, ekran tasarımı ve proje verileri üzerinde doğrudan çalışılabilmesi sağlanmıştır.

---

## Özellikler

1. **✏️ Çizim & Diyagram Tuvali (`sketch`):**
   - Sonsuz 2B çizim alanı üzerinde iş akışı analizi, mimari şemalar, Mermaid diyagramları ve tel kafes (wireframe) çizimleri.
2. **🎨 Ekran Tasarım Tuvali (`design`):**
   - Shadow DOM izolasyonlu, HTML/CSS tabanlı ekran tasarım alanı.
   - İçeriğe göre esnek boyutlandırma (*Hug Contents*), Masaüstü (`1440×900`) ve Mobil (`390×844`) çerçeveler, katman görünümü ve temel CSS denetçisi.
3. **📋 Görev Panosu (`tasks`):**
   - Kanban ve liste görünümüyle proje görevlerinin takibi, görev kartlarının ilgili çizim veya tasarım tuvalleriyle ilişkilendirilmesi ve yan yana (`Split-Peek`) görüntüleme.
4. **🧪 TDD Test Senaryoları Alanı (`tdd`):**
   - `Given / When / Then` yapısında test senaryosu taslakları oluşturma, `Red / Green / Refactor` durum takibi ve temel test şablonu (`Vitest`, `Playwright`, `Cucumber`) çıktısı alma.
5. **🔌 MCP (Model Context Protocol) Desteği:**
   - Geliştirilen MCP sunucusu ve canlı SSE köprüsü sayesinde harici yapay zeka asistanlarından çizim tuvaline, tasarım tuvaline ve proje/görev verilerine doğrudan erişim ve aktarım imkânı.

---

## Hızlı Başlangıç

### 1. Docker ile Web Uygulaması ve MCP Sunucusunu Birlikte Ayağa Kaldırma (Önerilen)

Projeyi başka bir bilgisayara klonladıktan sonra makinede Node.js veya Yarn kurulu olmasına gerek kalmadan hem **SynapDraw Web Uygulamasını (`http://localhost:3000`)** hem de **Canlı MCP Sunucusunu (`http://localhost:3001`)** Docker üzerinden birlikte ayağa kaldırabilirsiniz:

```bash
# 1. Projeyi klonlayın ve dizine girin
git clone https://github.com/brkmustu/synapdraw.git
cd synapdraw
```

#### Seçenek A — Tek Komutla (`docker compose` ile Web + MCP birlikte)

`docker-compose.yml` dosyası hem web arayüzünü (`synapdraw-web` -> `3000`) hem de MCP sunucusunu (`synapdraw-mcp` -> `3001`) otomatik olarak derler ve başlatır:

```bash
docker compose up -d --build
```

#### Seçenek B — Tek Tek `docker build` & `docker run` ile

```bash
# 1. Web arayüzünü derleyin ve başlatın (http://localhost:3000)
docker build -t synapdraw-local:latest .
docker rm -f synapdraw-web 2>/dev/null || true
docker run -d --name synapdraw-web -p 3000:80 --restart unless-stopped synapdraw-local:latest

# 2. MCP sunucusunu derleyin ve başlatın (http://localhost:3001)
docker build -t synapdraw-mcp:latest ./synapdraw-mcp
docker rm -f synapdraw-mcp 2>/dev/null || true
docker run -d --name synapdraw-mcp -p 3001:3001 --restart unless-stopped synapdraw-mcp:latest
```

Kurulum tamamlandığında:
- **Web Çalışma Alanı:** `http://localhost:3000`
- **MCP Canlı SSE Köprüsü:** `http://localhost:3001/api/live-events` (Tarayıcıdaki SynapDraw sekmesi bu adrese otomatik bağlanır)
- **MCP HTTP Endpoint:** `http://localhost:3001/mcp`

Konteynerleri durdurmak için `docker compose down` (veya `docker stop synapdraw-web synapdraw-mcp`) komutunu kullanabilirsiniz.

---

### 2. Yapay Zeka İstemcilerini (Claude Desktop, Antigravity, Cursor vb.) MCP'ye Bağlama

Web uygulaması (`localhost:3000`) ve MCP sunucusu (`localhost:3001`) çalışırken yapay zeka asistanınızı iki farklı yöntemle bağlayabilirsiniz:

#### Yöntem 1: Streamable HTTP Üzerinden Bağlantı (Docker ile Doğrudan)
İstemciniz HTTP MCP bağlantısını destekliyorsa doğrudan Docker üzerinde çalışan `3001` portuna yönlendirebilirsiniz:
- **MCP Server URL:** `http://localhost:3001/mcp`

#### Yöntem 2: `stdio` Üzerinden Bağlantı (Claude Desktop / Antigravity `mcp_config.json`)
İstemciniz yerel `stdio` komutu bekliyorsa önce `synapdraw-mcp` paketini derleyin:

```bash
cd synapdraw-mcp
npm install
npm run build
```

Ardından yapay zeka istemcinizin MCP yapılandırma dosyasına (`mcp_config.json` veya `claude_desktop_config.json`) şu tanımı ekleyin:

```json
{
  "mcpServers": {
    "synapdraw": {
      "command": "node",
      "args": [
        "/tam/dizin/yolu/synapdraw/synapdraw-mcp/dist/index.js",
        "--stdio"
      ]
    }
  }
}
```

> **Not:** `--stdio` modunda başlatılan MCP süreci, `3001` portu boşsa canlı SSE köprüsünü kendisi otomatik başlatır; eğer `3001` portunda halihazırda Docker `synapdraw-mcp` konteyneri çalışıyorsa çizim ve tasarım güncellemelerini otomatik olarak o konteyner üzerinden tarayıcıya (`http://localhost:3000`) iletir.

---

### 3. Yerel Geliştirme Ortamı (Docker Olmadan Node.js & Yarn ile)

Docker kullanmadan doğrudan yerel ortamda geliştirmek ve çalıştırmak isterseniz:

```bash
# Terminal 1 — Web Uygulaması (http://localhost:3000)
yarn install
yarn start

# Terminal 2 — MCP Sunucusu (http://localhost:3001)
cd synapdraw-mcp
npm install
npm run build
npm run serve
```

---

## Dokümantasyon

- [SDLC Özellikleri ve Mimari Taslak Planı](./docs/sdlc_superapp_plan.md)
- [Oturum ve Geliştirme Özeti](./docs/session_summary.md)
- [Katkıda Bulunma Rehberi](./CONTRIBUTING.md)

---

## Lisans

Bu proje [MIT Lisansı](./LICENSE) altında lisanslanmıştır.

---

## Bilgilendirme

Proje — özellikle yazılım geliştirme yaşam döngüsü (SDLC) kapsamındaki görev yönetimi ve test senaryosu özellikleri — halen **aktif geliştirme aşamasındadır**.

> [!NOTE]
> **Bu uygulama bir Excalidraw türevidir.** SynapDraw, açık kaynaklı [Excalidraw](https://github.com/excalidraw/excalidraw) projesi temel alınarak geliştirilmekte olup; üzerine ekran tasarım tuvali, yazılım yaşam döngüsü (SDLC) araçları ve yapay zeka agent'larıyla birlikte kullanımı kolaylaştıran ek MCP özellikleri eklenmiştir.
