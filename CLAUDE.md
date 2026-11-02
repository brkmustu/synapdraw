# CLAUDE.md

## Proje Yapısı

SynapDraw, çekirdek çizim/geometri paketleri ile web uygulamasını barındıran bir **monorepo** yapısındadır:

- **`synapdraw-app/`** — Ana SynapDraw web uygulaması (Çizim Tuvali, HTML/CSS Tasarım Tuvali ve geliştirme aşamasındaki Görev Panosu, TDD Test Senaryoları ile MCP bağlantı bileşenleri)
- **`synapdraw-mcp/`** — Yapay zeka istemcileriyle birlikte kullanımı desteklemek üzere genişletilmiş Model Context Protocol (MCP) sunucusu
- **`packages/`** — Çekirdek çizim, matematik, eleman ve yardımcı kütüphane paketleri
- **`docs/`** — Mimari taslak planı ve geliştirme özet dokümanları

## Geliştirme İş Akışı

1. **Uygulama Geliştirme**: SDLC yüzeyleri, tasarım tuvali ve çalışma alanı yönetimi için `synapdraw-app/` dizininde (`workspace/`, `sdlc/`, `design/`, `engine/`) çalışın.
2. **Çekirdek Paketler**: Temel tuval ve geometri özellikleri için `packages/*` dizinini kullanın.
3. **Testler**: Taahhüt (commit) öncesinde `yarn test:update` veya `yarn test:app` çalıştırın.
4. **Tip Güvenliği**: TypeScript doğrulaması için `yarn test:typecheck` komutunu kullanın.

## Geliştirme Komutları

```bash
yarn test:typecheck  # TypeScript tip kontrolü
yarn test:update     # Tüm testleri çalıştır (snapshot güncellemesi ile)
yarn fix             # Biçimlendirme ve lint sorunlarını otomatik düzelt
```

## Mimari Notlar

- Monorepo yönetimi için Yarn workspaces kullanılır.
- Paket derlemeleri için esbuild, web uygulaması için Vite kullanılır.
- Tüm kod tabanında katı (strict) TypeScript yapılandırması geçerlidir.
