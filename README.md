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

### 1. Docker ile Lokal Kurulum ve Çalıştırma (Önerilen)

Projeyi başka bir bilgisayara klonladıktan sonra makinede Node.js veya Yarn kurulu olmasına gerek kalmadan doğrudan **Docker** üzerinden `http://localhost:3000` adresinde ayağa kaldırabilirsiniz:

```bash
# 1. Projeyi klonlayın ve dizine girin
git clone https://github.com/brkmustu/synapdraw.git
cd synapdraw
```

**Seçenek A — Tek komutla (`docker compose`):**

```bash
docker compose up -d --build
```

**Seçenek B — Doğrudan `docker build` & `docker run` ile:**

```bash
# İmajı derleyin
docker build -t synapdraw-local:latest .

# Varsa eski konteyneri kaldırıp yenisini başlatın
docker rm -f synapdraw-web 2>/dev/null || true
docker run -d --name synapdraw-web -p 3000:80 --restart unless-stopped synapdraw-local:latest
```

Kurulum tamamlandığında tarayıcınızdan **`http://localhost:3000`** adresine giderek uygulamayı kullanabilirsiniz. Konteyneri durdurmak için `docker stop synapdraw-web` (veya `docker compose down`) komutunu çalıştırabilirsiniz.

### 2. Yerel Geliştirme Ortamı (Node.js & Yarn)

```bash
yarn install
yarn start
```

### 3. MCP Sunucusu (`synapdraw-mcp`)

```bash
cd synapdraw-mcp
npm install
npm run build
npm run serve
```

MCP sunucusu varsayılan olarak `http://localhost:3001` üzerinde çalışır ve açık çalışma alanıyla SSE (Server-Sent Events) üzerinden haberleşir.

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
