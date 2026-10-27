import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";

import "../excalidraw-app/sentry";

import ExcalidrawApp from "./App";

window.__EXCALIDRAW_SHA__ = import.meta.env.VITE_APP_GIT_SHA;
const rootElement = document.getElementById("root")!;
const root = createRoot(rootElement);
registerSW({
  immediate: true,
  onNeedRefresh() {
    console.info("[PWA] Yeni sürüm mevcut, sayfa yenileniyor...");
    window.location.reload();
  },
});
root.render(
  <StrictMode>
    <ExcalidrawApp />
  </StrictMode>,
);
