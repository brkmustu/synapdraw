# SynapDraw MCP Server — Mimari Notlar

SynapDraw çalışma alanlarıyla hem `stdio` hem de canlı HTTP/SSE (`http://localhost:3001`) üzerinden iletişim kuran bağımsız MCP sunucusu.

## Mimari

```
server.ts          → Çizim, Tasarım ve SDLC araç tanımları + kontrol noktası (checkpoint) yönetimi
main.ts            → HTTP (Streamable + SSE `/api/live-events`) ve stdio aktarım katmanları
src/mcp-app.tsx    → Etkileşimli önizleme bileşeni
src/mcp-entry.tsx  → Üretim giriş noktası
src/global.css     → Çizim animasyonları ve otomatik boyutlandırma
```

## Derleme ve Geliştirme

```bash
npm install
npm run build
```

```bash
# HTTP + Canlı SSE sunucusu (http://localhost:3001)
npm run serve

# stdio modu (Claude Desktop / Antigravity için)
node dist/index.js --stdio
```
