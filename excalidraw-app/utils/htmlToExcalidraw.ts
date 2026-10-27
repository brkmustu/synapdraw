import type { ExcalidrawElementSkeleton } from "@excalidraw/element";

export interface HtmlToExcalidrawOptions {
  ownerDocument?: Document;
  ownerWindow?: Window;
  originX?: number;
  originY?: number;
  canvasWidth?: number;
  createFrame?: boolean;
  frameName?: string;
  createContainerCard?: boolean;
  locked?: boolean;
  groupId?: string;
}

export interface HtmlToExcalidrawResult {
  elements: ExcalidrawElementSkeleton[];
  width: number;
  height: number;
  containerGroupId: string;
  frameId?: string;
}

/**
 * Normalizes CSS color values (rgb, rgba, hex, named colors).
 */
function normalizeColor(colorStr: string): string {
  if (!colorStr || colorStr === "transparent" || colorStr === "rgba(0, 0, 0, 0)") {
    return "transparent";
  }

  // Parse rgba(r, g, b, a) where a === 0
  const rgbaMatch = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    if (a !== undefined && parseFloat(a) === 0) {
      return "transparent";
    }
    const hex = (n: string) => parseInt(n, 10).toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  return colorStr;
}

/**
 * Extracts clean HTML if LLM wrapped it in markdown codeblocks.
 */
export function sanitizeHtml(rawHtml: string): string {
  let cleaned = rawHtml.trim();
  // Strip markdown code fences like ```html ... ```
  cleaned = cleaned.replace(/^```(?:html|xml)?\s*/i, "").replace(/\s*```$/i, "").trim();

  // Strip script and link tags completely so external resources do not block
  cleaned = cleaned.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
  cleaned = cleaned.replace(/<link\b[^>]*\/?>/gi, "");

  // If there's an outer <html><body>, extract body contents
  const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) {
    cleaned = bodyMatch[1].trim();
  }

  return cleaned;
}

/**
 * Base wireframe styling injected into the sandbox for crisp, modern UI rendering.
 */
const WIREFRAME_BASE_CSS = `
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  body, div, p, span, h1, h2, h3, h4, h5, h6, ul, ol, li, form, input, button, table, th, td {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }
  h1 { font-size: 24px; font-weight: 700; margin-bottom: 12px; color: #1e293b; line-height: 1.3; }
  h2 { font-size: 18px; font-weight: 700; margin-bottom: 10px; color: #1e293b; line-height: 1.3; }
  h3 { font-size: 15px; font-weight: 600; margin-bottom: 8px; color: #1e293b; line-height: 1.3; }
  h4 { font-size: 13px; font-weight: 600; margin-bottom: 6px; color: #334155; line-height: 1.3; }
  p { font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 8px; }
  ul, ol { padding-left: 20px; margin-bottom: 10px; }
  li { font-size: 13px; line-height: 1.6; color: #475569; margin-bottom: 4px; }
  code { font-family: monospace; font-size: 12px; background: #f1f5f9; padding: 2px 5px; border-radius: 4px; color: #0f172a; }
  small { font-size: 11px; color: #64748b; }

  /* DaisyUI Collapse Components */
  .collapse {
    position: relative;
    display: grid;
    overflow: hidden;
    grid-template-rows: auto auto;
    border-radius: 12px;
    margin-bottom: 16px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
  }
  .collapse > input[type="checkbox"],
  .collapse > input[type="radio"] {
    display: none !important;
  }
  .collapse-title {
    padding: 14px 18px;
    font-weight: 700;
    font-size: 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    background: #f8fafc;
    border-bottom: 1px solid #f1f5f9;
    min-height: 48px;
  }
  .collapse-content {
    padding: 16px 20px;
    display: block;
  }

  /* Tailwind Spacing Utilities */
  .space-y-1 > * + * { margin-top: 4px; }
  .space-y-2 > * + * { margin-top: 8px; }
  .space-y-3 > * + * { margin-top: 12px; }
  .space-y-4 > * + * { margin-top: 16px; }
  .space-y-6 > * + * { margin-top: 24px; }

  .gap-1 { gap: 4px; }
  .gap-2 { gap: 8px; }
  .gap-3 { gap: 12px; }
  .gap-4 { gap: 16px; }
  .gap-6 { gap: 24px; }

  .p-1 { padding: 4px; }
  .p-2 { padding: 8px; }
  .p-3 { padding: 12px; }
  .p-4 { padding: 16px; }
  .p-6 { padding: 24px; }
  .px-2 { padding-left: 8px; padding-right: 8px; }
  .px-3 { padding-left: 12px; padding-right: 12px; }
  .px-4 { padding-left: 16px; padding-right: 16px; }
  .py-1 { padding-top: 4px; padding-bottom: 4px; }
  .py-2 { padding-top: 8px; padding-bottom: 8px; }
  .py-3 { padding-top: 12px; padding-bottom: 12px; }

  .mb-1 { margin-bottom: 4px; }
  .mb-2 { margin-bottom: 8px; }
  .mb-3 { margin-bottom: 12px; }
  .mb-4 { margin-bottom: 16px; }

  /* Flex & Grid */
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .flex-1 { flex: 1; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .justify-center { justify-content: center; }
  .grid { display: grid; }
  .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
  .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

  /* Buttons */
  button, .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 16px;
    border-radius: 6px;
    border: 1px solid #3b82f6;
    background-color: #3b82f6;
    color: #ffffff;
    cursor: pointer;
    text-align: center;
  }
  .btn-secondary { background-color: #f1f5f9; color: #334155; border-color: #cbd5e1; }
  .btn-outline { background-color: #ffffff; color: #3b82f6; border-color: #3b82f6; }
  .btn-danger { background-color: #ef4444; color: #ffffff; border-color: #ef4444; }
  .btn-success { background-color: #10b981; color: #ffffff; border-color: #10b981; }

  /* Inputs */
  input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="search"], select, textarea {
    display: block;
    width: 100%;
    padding: 8px 12px;
    font-size: 13px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background-color: #ffffff;
    color: #1e293b;
    margin-bottom: 10px;
  }
  label {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 4px;
  }

  /* Cards & Containers */
  .card, .panel {
    background-color: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 18px;
    margin-bottom: 16px;
  }
  .hero {
    background-color: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 24px;
    margin-bottom: 20px;
  }
  .navbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    border-bottom: 1px solid #cbd5e1;
    margin-bottom: 20px;
  }

  /* Badges & Pills */
  .badge, .pill, .tag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 4px 10px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 9999px;
    white-space: nowrap;
    background-color: #e0e7ff;
    color: #3730a3;
    border: 1px solid transparent;
    line-height: 1.4;
  }
  .badge-info { background-color: #e0f2fe; color: #0369a1; border-color: #bae6fd; }
  .badge-error { background-color: #fee2e2; color: #b91c1c; border-color: #fecaca; }
  .badge-warning { background-color: #fef3c7; color: #b45309; border-color: #fde68a; }
  .badge-primary { background-color: #dbeafe; color: #1d4ed8; border-color: #bfdbfe; }
  .badge-accent { background-color: #f3e8ff; color: #7e22ce; border-color: #e9d5ff; }
  .badge-success { background-color: #dcfce7; color: #15803d; border-color: #bbf7d0; }

  /* Alerts */
  .alert { display: flex; align-items: center; gap: 10px; padding: 12px 16px; border-radius: 8px; margin-bottom: 10px; font-size: 12px; }
  .alert-info { background-color: #f0f9ff; color: #0369a1; border: 1px solid #bae6fd; }
  .alert-warning { background-color: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
  .alert-error { background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; }

  /* Dividers */
  hr {
    border: none;
    border-top: 1px solid #e2e8f0;
    margin: 14px 0;
  }

  /* Tables */
  table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 12px;
  }
  th, td {
    padding: 8px 12px;
    font-size: 12px;
    border: 1px solid #e2e8f0;
    text-align: left;
  }
  th {
    background-color: #f8fafc;
    font-weight: 600;
    color: #1e293b;
  }

  .rounded-xl { border-radius: 10px; }
  .rounded-2xl { border-radius: 14px; }
`;

/**
 * Parses an HTML/CSS wireframe snippet into Excalidraw element skeletons
 * using a live browser DOM sandbox.
 */
export function parseHtmlToExcalidraw(
  html: string,
  options: HtmlToExcalidrawOptions = {},
): HtmlToExcalidrawResult {
  const doc = options.ownerDocument || (typeof document !== "undefined" ? document : null);
  const win = options.ownerWindow || (doc ? doc.defaultView || (typeof window !== "undefined" ? window : null) : null);

  if (!doc || !win) {
    throw new Error("parseHtmlToExcalidraw requires a browser Document and Window environment.");
  }

  const cleanedHtml = sanitizeHtml(html);
  const originX = options.originX ?? 100;
  const originY = options.originY ?? 100;
  const canvasWidth = options.canvasWidth ?? 960;

  // 1. Create off-screen sandbox container attached to ownerDocument
  const sandbox = doc.createElement("div");
  sandbox.id = "excalidraw-html-wireframe-sandbox";
  sandbox.style.position = "fixed";
  sandbox.style.left = "-99999px";
  sandbox.style.top = "0px";
  sandbox.style.width = `${canvasWidth}px`;
  sandbox.style.opacity = "0";
  sandbox.style.pointerEvents = "none";
  sandbox.style.zIndex = "-99999";

  const styleEl = doc.createElement("style");
  styleEl.textContent = WIREFRAME_BASE_CSS;
  sandbox.appendChild(styleEl);

  const contentWrapper = doc.createElement("div");
  contentWrapper.innerHTML = cleanedHtml;
  sandbox.appendChild(contentWrapper);

  doc.body.appendChild(sandbox);

  const elements: ExcalidrawElementSkeleton[] = [];
  const processedElementIds = new Set<string>();

  try {
    const rootRect = contentWrapper.getBoundingClientRect();
    const consumedNodes = new Set<Node>();

    let nextElementId = 1;
    const generateId = (prefix: string = "wireframe") => `${prefix}_${Date.now()}_${nextElementId++}`;

    const isLocked = options.locked ?? true;
    const shouldCreateFrame = options.createFrame ?? true;
    const shouldCreateCard = options.createContainerCard ?? true;
    const containerGroupId = options.groupId || generateId("group_container");
    const frameId = generateId("frame_container");
    const frameTitle = options.frameName || "UI Wireframe Container";

    const CONTENT_OFFSET_X = shouldCreateCard ? 24 : 0;
    const CONTENT_OFFSET_Y = shouldCreateCard ? 52 : 0;

    const pushElement = (el: ExcalidrawElementSkeleton) => {
      elements.push({
        ...el,
        locked: isLocked,
        groupIds: [containerGroupId],
        ...(shouldCreateFrame ? { frameId } : {}),
      } as unknown as ExcalidrawElementSkeleton);
    };

    /**
     * Traverses the DOM hierarchy and transforms visible elements.
     */
    const traverse = (node: Element, parentFrameId?: string) => {
      if (consumedNodes.has(node)) return;

      const style = win.getComputedStyle(node);
      if (style.display === "none" || style.visibility === "hidden" || parseFloat(style.opacity || "1") === 0) {
        return;
      }

      const rect = node.getBoundingClientRect();
      // Skip completely empty zero-dimension elements (unless hr or divider)
      if (rect.width === 0 && rect.height === 0 && node.tagName.toLowerCase() !== "hr") {
        return;
      }

      const relX = Math.round(originX + CONTENT_OFFSET_X + (rect.left - rootRect.left));
      const relY = Math.round(originY + CONTENT_OFFSET_Y + (rect.top - rootRect.top));
      const width = Math.max(Math.round(rect.width), 10);
      const height = Math.max(Math.round(rect.height), 10);

      const tagName = node.tagName.toLowerCase();
      const role = node.getAttribute("role") || "";
      const isButton =
        tagName === "button" ||
        role === "button" ||
        node.classList.contains("btn") ||
        (tagName === "input" && (node.getAttribute("type") === "button" || node.getAttribute("type") === "submit"));

      const isInput =
        (tagName === "input" && !["checkbox", "radio", "button", "submit", "hidden"].includes(node.getAttribute("type") || "")) ||
        tagName === "textarea" ||
        tagName === "select";

      const isCheckboxOrRadio = tagName === "input" && ["checkbox", "radio"].includes(node.getAttribute("type") || "");
      const isDivider = tagName === "hr";

      // 1. Divider line
      if (isDivider) {
        pushElement({
          type: "line",
          id: generateId("divider"),
          x: relX,
          y: relY,
          width: width,
          height: 0,
          strokeColor: normalizeColor(style.borderTopColor) !== "transparent" ? normalizeColor(style.borderTopColor) : "#e2e8f0",
          strokeWidth: 1,
        });
        consumedNodes.add(node);
        return;
      }

      // 2. Buttons: Container + Centered Text Label
      if (isButton) {
        const textContent = (node.textContent || (node as HTMLInputElement).value || "Buton").trim();
        const bg = normalizeColor(style.backgroundColor);
        const stroke = normalizeColor(style.borderColor);
        const textColor = normalizeColor(style.color);
        const borderRadius = parseFloat(style.borderRadius) || 0;

        const buttonId = generateId("btn");
        pushElement({
          type: "rectangle",
          id: buttonId,
          x: relX,
          y: relY,
          width: Math.max(width + 12, 60),
          height: Math.max(height, 32),
          backgroundColor: bg !== "transparent" ? bg : "#3b82f6",
          strokeColor: stroke !== "transparent" ? stroke : "#2563eb",
          fillStyle: "solid",
          strokeWidth: 1,
          roundness: borderRadius > 2 ? { type: 3 } : null,
          roughness: 0,
          label: {
            text: textContent,
            strokeColor: textColor !== "transparent" && textColor !== "#000000" ? textColor : "#ffffff",
            fontSize: Math.min(Math.max(parseFloat(style.fontSize) || 14, 12), 24),
            fontFamily: 2,
            textAlign: "center",
            verticalAlign: "middle",
          },
        });

        // Mark all children of button as consumed so their text isn't duplicated
        node.querySelectorAll("*").forEach((child) => consumedNodes.add(child));
        consumedNodes.add(node);
        return;
      }

      // 3. Form Inputs: Container + Placeholder / Value
      if (isInput) {
        const placeholder =
          (node as HTMLInputElement).placeholder ||
          (node as HTMLInputElement).value ||
          node.getAttribute("data-placeholder") ||
          "";
        const bg = normalizeColor(style.backgroundColor);
        const stroke = normalizeColor(style.borderColor);
        const borderRadius = parseFloat(style.borderRadius) || 0;

        const inputId = generateId("input");
        pushElement({
          type: "rectangle",
          id: inputId,
          x: relX,
          y: relY,
          width: width,
          height: height,
          backgroundColor: bg !== "transparent" ? bg : "#ffffff",
          strokeColor: stroke !== "transparent" ? stroke : "#cbd5e1",
          fillStyle: "solid",
          strokeWidth: 1,
          roundness: borderRadius > 2 ? { type: 3 } : null,
          roughness: 0,
          label: placeholder
            ? {
                text: placeholder,
                strokeColor: "#94a3b8",
                fontSize: 13,
                fontFamily: 2,
                textAlign: "left",
                verticalAlign: "middle",
              }
            : undefined,
        });

        consumedNodes.add(node);
        return;
      }

      // 4. Checkbox / Radio
      if (isCheckboxOrRadio) {
        // Skip hidden or collapse-toggle inputs (like DaisyUI invisible checkboxes)
        if (
          node.closest(".collapse") ||
          node.parentElement?.classList.contains("collapse") ||
          style.display === "none" ||
          style.visibility === "hidden"
        ) {
          consumedNodes.add(node);
          return;
        }

        const isRadio = node.getAttribute("type") === "radio";
        const isChecked = (node as HTMLInputElement).checked;
        const boxSize = Math.max(Math.min(width, height), 16);

        pushElement({
          type: isRadio ? "ellipse" : "rectangle",
          id: generateId("check"),
          x: relX,
          y: relY,
          width: boxSize,
          height: boxSize,
          backgroundColor: isChecked ? "#3b82f6" : "#ffffff",
          strokeColor: isChecked ? "#3b82f6" : "#94a3b8",
          fillStyle: "solid",
          strokeWidth: 1,
          roundness: isRadio ? null : { type: 3 },
          roughness: 0,
        });

        consumedNodes.add(node);
        return;
      }

      // 5. Badges / Pills
      if (node.classList.contains("badge") || node.classList.contains("pill") || node.classList.contains("tag")) {
        const textContent = node.textContent?.trim() || "Tag";
        const bg = normalizeColor(style.backgroundColor);
        const stroke = normalizeColor(style.borderColor);
        const textColor = normalizeColor(style.color);

        pushElement({
          type: "rectangle",
          id: generateId("badge"),
          x: relX,
          y: relY,
          width: Math.max(width + 24, 75),
          height: Math.max(height, 22),
          backgroundColor: bg !== "transparent" ? bg : "#e0e7ff",
          strokeColor: stroke !== "transparent" ? stroke : "#c7d2fe",
          fillStyle: "solid",
          strokeWidth: 1,
          roundness: { type: 3 },
          roughness: 0,
          label: {
            text: textContent,
            strokeColor: textColor !== "transparent" ? textColor : "#3730a3",
            fontSize: 11,
            fontFamily: 2,
            textAlign: "center",
            verticalAlign: "middle",
          },
        });

        node.querySelectorAll("*").forEach((child) => consumedNodes.add(child));
        consumedNodes.add(node);
        return;
      }

      // 6. Text Elements (Headings, Paragraphs, Standalone Labels, Spans)
      const isHeading = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tagName);
      const isParagraphOrLabel = ["p", "label", "span", "strong", "b", "em", "small", "li", "code", "a"].includes(tagName);

      const isInlineChild = (el: Element) =>
        ["span", "strong", "b", "em", "small", "code", "a", "i", "u"].includes(el.tagName.toLowerCase());
      const hasOnlyInlineChildren =
        node.children.length === 0 || Array.from(node.children).every(isInlineChild);

      if ((isHeading || isParagraphOrLabel) && hasOnlyInlineChildren) {
        const fullText = (node.textContent || "").trim().replace(/\s+/g, " ");
        if (fullText && fullText.length > 0) {
          const textColor = normalizeColor(style.color);
          const parsedFontSize = parseFloat(style.fontSize) || 14;

          let fontSize = Math.round(parsedFontSize);
          if (isHeading) {
            if (tagName === "h1") fontSize = 24;
            else if (tagName === "h2") fontSize = 18;
            else if (tagName === "h3") fontSize = 15;
            else if (tagName === "h4") fontSize = 13;
            else fontSize = 12;
          }

          pushElement({
            type: "text",
            id: generateId("text"),
            x: relX,
            y: relY,
            text: fullText,
            fontSize: Math.min(Math.max(fontSize, 11), 32),
            fontFamily: 2,
            strokeColor: textColor !== "transparent" ? textColor : "#1e293b",
            textAlign: (style.textAlign as any) || "left",
          });

          node.querySelectorAll("*").forEach((child) => consumedNodes.add(child));
          consumedNodes.add(node);
          return;
        }
      }

      // Table Cells: th and td
      if (tagName === "th" || tagName === "td") {
        const cellText = (node.textContent || "").trim().replace(/\s+/g, " ");
        const bg = normalizeColor(style.backgroundColor);
        const stroke = normalizeColor(style.borderColor);
        const isHeader = tagName === "th";

        pushElement({
          type: "rectangle",
          id: generateId(isHeader ? "th" : "td"),
          x: relX,
          y: relY,
          width: width,
          height: height,
          backgroundColor: bg !== "transparent" ? bg : isHeader ? "#f8fafc" : "#ffffff",
          strokeColor: stroke !== "transparent" ? stroke : "#cbd5e1",
          fillStyle: "solid",
          strokeWidth: 1,
          roundness: null,
          roughness: 0,
          label: cellText
            ? {
                text: cellText,
                strokeColor: isHeader ? "#1e293b" : "#334155",
                fontSize: 12,
                fontFamily: 2,
                textAlign: "left",
                verticalAlign: "middle",
              }
            : undefined,
        });

        node.querySelectorAll("*").forEach((child) => consumedNodes.add(child));
        consumedNodes.add(node);
        return;
      }


      // 7. Containers / Cards / Divs / Tables / Table Rows
      const bg = normalizeColor(style.backgroundColor);
      const stroke = normalizeColor(style.borderColor);
      const borderWidth = parseFloat(style.borderWidth) || 0;
      const borderRadius = parseFloat(style.borderRadius) || 0;

      const hasVisibleBg = bg !== "transparent" && bg !== "#ffffff00";
      const hasVisibleBorder = borderWidth > 0 && stroke !== "transparent" && style.borderStyle !== "none";
      const isCardOrPanel =
        node.classList.contains("card") ||
        node.classList.contains("panel") ||
        tagName === "table" ||
        tagName === "th" ||
        tagName === "td";

      if (hasVisibleBg || hasVisibleBorder || isCardOrPanel) {
        const containerId = generateId(isCardOrPanel ? "card" : "container");
        pushElement({
          type: "rectangle",
          id: containerId,
          x: relX,
          y: relY,
          width: width,
          height: height,
          backgroundColor: hasVisibleBg ? bg : isCardOrPanel ? "#ffffff" : "transparent",
          strokeColor: hasVisibleBorder ? stroke : isCardOrPanel ? "#e2e8f0" : "transparent",
          fillStyle: "solid",
          strokeWidth: borderWidth > 0 ? Math.min(borderWidth, 2) : 1,
          roundness: borderRadius > 2 ? { type: 3 } : null,
          roughness: 1,
        });
      }

      // Recurse into child elements
      Array.from(node.children).forEach((child) => {
        traverse(child, parentFrameId);
      });

      consumedNodes.add(node);
    };

    // Begin traversal from the wrapper
    Array.from(contentWrapper.children).forEach((child) => {
      traverse(child);
    });

    if (elements.length === 0) {
      return {
        elements: [],
        width: 0,
        height: 0,
        containerGroupId,
      };
    }

    // 8. Calculate bounding box of all created elements
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const el of elements) {
      const elX = el.x ?? originX;
      const elY = el.y ?? originY;
      const elW = (el as any).width ?? 0;
      const elH = (el as any).height ?? 0;
      minX = Math.min(minX, elX);
      minY = Math.min(minY, elY);
      maxX = Math.max(maxX, elX + elW);
      maxY = Math.max(maxY, elY + elH);
    }

    const PADDING_X = 24;
    const PADDING_BOTTOM = 28;
    const containerX = Math.round(originX);
    const containerY = Math.round(originY);
    const containerWidth = Math.round(Math.max(maxX - originX + PADDING_X, canvasWidth));
    const containerHeight = Math.round(Math.max(maxY - originY + PADDING_BOTTOM, 180));

    const containerCardId = generateId("container_card");
    const containerHeaderId = generateId("container_header");

    const containerCard: ExcalidrawElementSkeleton = {
      type: "rectangle",
      id: containerCardId,
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: containerHeight,
      backgroundColor: "#ffffff",
      strokeColor: "#94a3b8", // crisp slate-400 border
      strokeWidth: 2,
      strokeStyle: "solid",
      roundness: { type: 3 },
      roughness: 0,
      fillStyle: "solid",
      opacity: 100,
      locked: isLocked,
      groupIds: [containerGroupId],
      frameId: shouldCreateFrame ? frameId : undefined,
      customData: { isContainerCard: true },
    };

    const headerHeight = 36;
    const containerHeader: ExcalidrawElementSkeleton = {
      type: "rectangle",
      id: containerHeaderId,
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: headerHeight,
      backgroundColor: "#f8fafc",
      strokeColor: "#cbd5e1",
      strokeWidth: 1,
      strokeStyle: "solid",
      roundness: { type: 3 },
      roughness: 0,
      fillStyle: "solid",
      opacity: 100,
      locked: isLocked,
      groupIds: [containerGroupId],
      frameId: shouldCreateFrame ? frameId : undefined,
      customData: { isContainerHeader: true },
      label: {
        text: `📦 [Container] ${frameTitle}${isLocked ? " 🔒" : ""}`,
        fontSize: 13,
        fontFamily: 2,
        strokeColor: "#1e293b",
        textAlign: "left",
        verticalAlign: "middle",
      },
    };

    const childIds: string[] = [
      ...(shouldCreateCard ? [containerCardId, containerHeaderId] : []),
      ...(elements.map((el) => el.id).filter(Boolean) as string[]),
    ];

    const frameElement: ExcalidrawElementSkeleton = {
      type: "frame",
      id: frameId,
      name: `📦 ${frameTitle}`,
      children: childIds,
      x: containerX,
      y: containerY,
      width: containerWidth,
      height: containerHeight,
      locked: isLocked,
      groupIds: [containerGroupId],
      customData: { isContainerFrame: true },
    } as any;

    const finalizedElements: ExcalidrawElementSkeleton[] = [];
    if (shouldCreateFrame) {
      finalizedElements.push(frameElement);
    }
    if (shouldCreateCard) {
      finalizedElements.push(containerCard);
      finalizedElements.push(containerHeader);
    }
    finalizedElements.push(...elements);

    return {
      elements: finalizedElements,
      width: containerWidth,
      height: containerHeight,
      containerGroupId,
      frameId: shouldCreateFrame ? frameId : undefined,
    };
  } finally {
    // Clean up sandbox from DOM
    if (sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox);
    }
  }
}
