# SynapDraw MCP Server

Yapay zeka agent'ları ve MCP destekli istemcilerle (Claude Desktop, Gemini Antigravity vb.) birlikte kullanılabilmesi için mevcut MCP altyapısına ek çizim, tasarım ve SDLC araçları eklenerek geliştirilmiş Model Context Protocol (MCP) sunucusu.

## Kurulum ve Derleme

```bash
cd synapdraw-mcp
npm install
npm run build
```

## Çalıştırma

### HTTP / SSE Köprüsü (`http://localhost:3001`)

```bash
npm run serve
```

### Claude Desktop / Gemini Antigravity Yapılandırması (`stdio`)

```json
{
  "mcpServers": {
    "synapdraw": {
      "command": "node",
      "args": ["/path/to/synapdraw/synapdraw-mcp/dist/index.js", "--stdio"]
    }
  }
}
```

## Sunulan MCP Araçları

- **Çizim & Diyagram (`sketch`):** `read_me`, `render_mermaid`, `render_html`, `create_view`, `get_canvas_context`, `clear_canvas`
- **Ekran Tasarımı (`design`):** `get_canvas_type`, `render_design`, `get_design_tree`, `update_node_styles`, `export_design_code`
- **Geliştirme Aşamasındaki SDLC Araçları:** `get_project_sdlc_overview`, `upsert_project_task`, `upsert_tdd_scenario`, `generate_tdd_from_task`

## Lisans

MIT
