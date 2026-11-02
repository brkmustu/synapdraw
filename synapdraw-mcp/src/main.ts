/**
 * Entry point for running the Excalidraw Live MCP server.
 * Run with: node dist/index.js [--stdio]
 * Provides both MCP tools and a Live Sync SSE Hub for Excalidraw web app (port 3000).
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express from "express";
import type { Request, Response, NextFunction } from "express";
import { FileCheckpointStore } from "./checkpoint-store.js";
import { createServer, type BroadcastEvent } from "./server.js";

const DEFAULT_PORT = 3001;
const sseClients = new Set<Response>();
let latestEvent: BroadcastEvent | null = null;

/**
 * Broadcasts an event to all connected browser tabs via SSE.
 */
export function broadcastToBrowserClients(event: BroadcastEvent) {
  latestEvent = event;
  const payload = `data: ${JSON.stringify(event)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(payload);
    } catch {
      sseClients.delete(client);
    }
  }
}

/**
 * Sends broadcast event locally or to a running HTTP sync server on port 3001.
 */
async function dispatchBroadcast(event: BroadcastEvent) {
  // 1. Broadcast to our own in-process clients
  broadcastToBrowserClients(event);

  // 2. Also forward to port 3001 if another process is hosting the SSE server
  try {
    const port = process.env.PORT ?? DEFAULT_PORT;
    await fetch(`http://localhost:${port}/api/broadcast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(event),
    });
  } catch {
    // Port 3001 might not be listening in external process, which is totally normal
  }
}

/**
 * Builds the Express app with MCP transport and Live Sync SSE Hub endpoints.
 */
function buildApp(factory: () => McpServer) {
  const app = express();
  app.use(cors());
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // SSE Live stream for browser tabs
  app.get("/api/live-events", (req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    // Handshake
    res.write(`data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`);
    sseClients.add(res);

    req.on("close", () => {
      sseClients.delete(res);
    });
  });

  // Broadcast endpoint
  app.post("/api/broadcast", (req: Request, res: Response) => {
    if (req.body && req.body.type) {
      broadcastToBrowserClients(req.body);
    }
    res.json({ ok: true, clientCount: sseClients.size });
  });

  // Status endpoint
  app.get("/api/status", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      clientCount: sseClients.size,
      latestEventType: latestEvent?.type ?? null,
      timestamp: Date.now(),
    });
  });

  // Latest event endpoint
  app.get("/api/latest", (_req: Request, res: Response) => {
    res.json(latestEvent ?? { type: "none" });
  });

  // Live Canvas Context cache
  let latestCanvasContext: any = { totalElements: 0, nodes: [] };

  app.post("/api/canvas-context", (req: Request, res: Response) => {
    latestCanvasContext = req.body;
    res.json({ ok: true });
  });

  app.get("/api/canvas-context", (_req: Request, res: Response) => {
    res.json(latestCanvasContext);
  });

  // MCP Streamable HTTP endpoint
  app.all("/mcp", async (req: Request, res: Response) => {
    const server = factory();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP error:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  return app;
}

/**
 * Starts an MCP server with Streamable HTTP transport and Live Sync endpoints.
 */
export async function startStreamableHTTPServer(
  factory: () => McpServer,
): Promise<void> {
  const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
  const app = buildApp(factory);

  const httpServer = app.listen(port, () => {
    console.log(`[Excalidraw Live MCP] Server listening on http://localhost:${port}/mcp`);
    console.log(`[Excalidraw Live Sync] SSE stream active at http://localhost:${port}/api/live-events`);
  });

  httpServer.on("error", (err: any) => {
    if (err.code === "EADDRINUSE") {
      console.warn(`[Excalidraw Live MCP] Port ${port} is already in use by another instance.`);
    } else {
      console.error("[Excalidraw Live MCP] Server error:", err);
    }
  });

  const shutdown = () => {
    console.log("\nShutting down...");
    httpServer.close(() => process.exit(0));
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

/**
 * Starts an MCP server with stdio transport while launching the Live Sync hub in background.
 */
export async function startStdioServer(
  factory: () => McpServer,
): Promise<void> {
  // In stdio mode, start background HTTP server for the browser if port is available
  try {
    const port = parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
    const app = buildApp(factory);
    const server = app.listen(port, () => {
      // Suppress stdout logging in stdio mode so as not to corrupt JSON-RPC stream
    });
    server.on("error", () => {
      // Already running in another process, no problem
    });
  } catch {}

  const server = factory();
  await server.connect(new StdioServerTransport());
}

async function main() {
  const store = new FileCheckpointStore();
  const factory = () => createServer(store, dispatchBroadcast);

  if (process.argv.includes("--stdio")) {
    await startStdioServer(factory);
  } else {
    await startStreamableHTTPServer(factory);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

