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
  h1 { font-size: 26px; font-weight: 700; margin-bottom: 12px; color: #1e293b; }
  h2 { font-size: 20px; font-weight: 700; margin-bottom: 10px; color: #1e293b; }
  h3 { font-size: 16px; font-weight: 600; margin-bottom: 8px; color: #1e293b; }
  h4 { font-size: 14px; font-weight: 600; margin-bottom: 6px; color: #334155; }
  p { font-size: 13px; line-height: 1.5; color: #475569; margin-bottom: 8px; }
  small { font-size: 11px; color: #64748b; }
  
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
    border-radius: 10px;
    padding: 20px;
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
    display: inline-block;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    border-radius: 9999px;
    background-color: #e0e7ff;
    color: #3730a3;
  }
  .badge-warning { background-color: #fef3c7; color: #b45309; }
  .badge-error { background-color: #fee2e2; color: #b91c1c; }
  .badge-info { background-color: #e0f2fe; color: #0369a1; }
  .badge-success { background-color: #dcfce7; color: #15803d; }

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

  /* Flex & Grid layouts */
  .flex { display: flex; }
  .flex-col { flex-direction: column; }
  .flex-1 { flex: 1; }
  .items-center { align-items: center; }
  .justify-between { justify-content: space-between; }
  .justify-center { justify-content: center; }
  .gap-2 { gap: 8px; }
  .gap-4 { gap: 16px; }
  .gap-6 { gap: 24px; }
  .grid { display: grid; }
  .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
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
          width: width,
          height: height,
          backgroundColor: bg !== "transparent" ? bg : "#3b82f6",
          strokeColor: stroke !== "transparent" ? stroke : "#2563eb",
          fillStyle: "solid",
          strokeWidth: 1,
          roundness: borderRadius > 2 ? { type: 3 } : null,
          roughness: 1,
          label: {
            text: textContent,
            strokeColor: textColor !== "transparent" && textColor !== "#000000" ? textColor : "#ffffff",
            fontSize: Math.min(Math.max(parseFloat(style.fontSize) || 14, 12), 24),
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
          roughness: 1,
          label: placeholder
            ? {
                text: placeholder,
                strokeColor: "#94a3b8",
                fontSize: 13,
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
          roughness: 1,
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
          width: width,
          height: height,
          backgroundColor: bg !== "transparent" ? bg : "#e0e7ff",
          strokeColor: stroke !== "transparent" ? stroke : "#c7d2fe",
          fillStyle: "solid",
          strokeWidth: 1,
          roundness: { type: 3 },
          roughness: 1,
          label: {
            text: textContent,
            strokeColor: textColor !== "transparent" ? textColor : "#3730a3",
            fontSize: 12,
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
            if (tagName === "h1") fontSize = 26;
            else if (tagName === "h2") fontSize = 20;
            else if (tagName === "h3") fontSize = 16;
            else if (tagName === "h4") fontSize = 14;
            else fontSize = 13;
          }

          pushElement({
            type: "text",
            id: generateId("text"),
            x: relX,
            y: relY,
            text: fullText,
            fontSize: Math.min(Math.max(fontSize, 11), 36),
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
          roughness: 1,
          label: cellText
            ? {
                text: cellText,
                strokeColor: isHeader ? "#1e293b" : "#334155",
                fontSize: 12,
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
      label: {
        text: `📦 [Container] ${frameTitle}${isLocked ? " 🔒" : ""}`,
        fontSize: 13,
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
