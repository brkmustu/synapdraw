import type { DesignNodeSummary } from "./model";

const FORBIDDEN_TAGS = new Set([
  "SCRIPT",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "APPLET",
  "META",
  "BASE",
  "ANIMATE",
  "SET",
  "ANIMATEMOTION",
  "ANIMATETRANSFORM",
  "FOREIGNOBJECT",
  "FORM",
  "NOSCRIPT",
  "TEMPLATE",
]);

/**
 * Sanitizes a CSS stylesheet string to prevent `</style>` tag breakout when
 * interpolated inside a `<style>` element.
 */
export function sanitizeDesignCss(rawCss?: string): string {
  if (!rawCss) {
    return "";
  }
  return rawCss.replace(/<\/style/gi, "<\\/style");
}

/**
 * Sanitizes a CSS background value to prevent declaration or `<style>` breakout.
 */
export function sanitizeDesignBackground(rawBg?: string): string {
  if (!rawBg || rawBg === "transparent") {
    return "transparent";
  }
  const cleaned = rawBg.replace(/[;{}<>"'`\\]/g, "").trim();
  return cleaned || "transparent";
}

/**
 * Sanitizes HTML markup for safe rendering inside an Artboard Shadow DOM
 * and ensures every element has a stable `data-node-id` attribute for
 * inspection and style updates.
 */
export function sanitizeAndTagDesignHtml(
  rawHtml: string,
  ownerDocument: Document,
): string {
  if (!rawHtml || !rawHtml.trim()) {
    return "";
  }

  const cleaned = rawHtml
    .replace(/^```(?:html|xml)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  const template = ownerDocument.createElement("template");
  template.innerHTML = cleaned;

  let counter = 1;

  const walk = (root: ParentNode) => {
    const children = Array.from(root.childNodes);
    for (const child of children) {
      if (child.nodeType === 1) {
        const el = child as Element;
        const upperTag = el.tagName.toUpperCase();
        if (FORBIDDEN_TAGS.has(upperTag)) {
          el.remove();
          continue;
        }

        if (upperTag === "STYLE" && el.textContent) {
          el.textContent = sanitizeDesignCss(el.textContent);
        }

        // Strip dangerous attributes (on*, srcdoc, and normalized javascript:/vbscript:/data:text/html URLs)
        const attrs = Array.from(el.attributes);
        for (const attr of attrs) {
          const name = attr.name.toLowerCase();
          // Strip control characters and whitespace before checking so that
          // obfuscated schemes like "java\tscript:" are still detected.
          const normalizedVal = Array.from(attr.value)
            .filter((char) => char.charCodeAt(0) > 0x20)
            .join("")
            .toLowerCase();
          const hasDangerousScheme =
            normalizedVal.includes("javascript:") ||
            normalizedVal.includes("vbscript:") ||
            normalizedVal.includes("data:text/html");
          if (
            name.startsWith("on") ||
            name === "srcdoc" ||
            hasDangerousScheme
          ) {
            el.removeAttribute(attr.name);
          }
        }

        // Assign deterministic data-node-id for inspector & MCP targeting
        if (upperTag !== "STYLE" && upperTag !== "LINK") {
          if (!el.getAttribute("data-node-id")) {
            const existingId = el.getAttribute("id");
            el.setAttribute(
              "data-node-id",
              existingId ? `id_${existingId}` : `node_${counter}`,
            );
          }
          counter++;
        }

        walk(el);
      }
    }
  };

  walk(template.content);
  return template.innerHTML;
}

/**
 * Updates inline styles (and optionally text content) on a target node
 * inside an Artboard's HTML string by `nodeId` or CSS selector.
 */
export function updateNodeInHtml(
  html: string,
  targetSelectorOrNodeId: string,
  styles: Record<string, string>,
  ownerDocument: Document,
  textContent?: string,
): { html: string; updatedCount: number } {
  const template = ownerDocument.createElement("template");
  template.innerHTML = sanitizeAndTagDesignHtml(html, ownerDocument);

  let targets: Element[] = [];
  const byNodeId = template.content.querySelector(
    `[data-node-id="${CSS.escape(targetSelectorOrNodeId)}"]`,
  );
  if (byNodeId) {
    targets = [byNodeId];
  } else {
    try {
      targets = Array.from(
        template.content.querySelectorAll(targetSelectorOrNodeId),
      );
    } catch {
      const byId = template.content.querySelector(
        `#${CSS.escape(targetSelectorOrNodeId.replace(/^#/, ""))}`,
      );
      if (byId) {
        targets = [byId];
      }
    }
  }

  for (const el of targets) {
    const htmlEl = el as HTMLElement;
    for (const [prop, val] of Object.entries(styles)) {
      const kebabProp = prop.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
      if (val === "" || val === null || val === undefined) {
        htmlEl.style.removeProperty(kebabProp);
      } else {
        htmlEl.style.setProperty(kebabProp, String(val));
      }
    }
    if (typeof textContent === "string") {
      htmlEl.textContent = textContent;
    }
  }

  return {
    html: template.innerHTML,
    updatedCount: targets.length,
  };
}

/**
 * Extracts a hierarchical summary of DOM nodes inside an Artboard's ShadowRoot,
 * including bounding rects (in unscaled artboard coordinates) and key computed styles.
 */
export function extractShadowDomTree(
  shadowRoot: ShadowRoot,
  zoom: number = 1,
): DesignNodeSummary[] {
  const container = shadowRoot.querySelector(".artboard-inner-content");
  if (!container) {
    return [];
  }

  const ownerWin = shadowRoot.ownerDocument.defaultView;
  const hostRect = container.getBoundingClientRect();
  const safeZoom = zoom > 0 ? zoom : 1;

  const buildNode = (el: Element, depth: number): DesignNodeSummary | null => {
    const tag = el.tagName.toLowerCase();
    if (tag === "style" || tag === "link" || tag === "script") {
      return null;
    }

    const nodeId = el.getAttribute("data-node-id") || tag;
    const rect = el.getBoundingClientRect();
    const relRect = {
      x: Math.round((rect.left - hostRect.left) / safeZoom),
      y: Math.round((rect.top - hostRect.top) / safeZoom),
      width: Math.round(rect.width / safeZoom),
      height: Math.round(rect.height / safeZoom),
    };

    let computedStyles: Record<string, string> | undefined;
    if (ownerWin) {
      const cs = ownerWin.getComputedStyle(el);
      computedStyles = {
        display: cs.display,
        color: cs.color,
        backgroundColor: cs.backgroundColor,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
        fontFamily: cs.fontFamily,
        padding: cs.padding,
        margin: cs.margin,
        borderRadius: cs.borderRadius,
        border: cs.border,
        gap: cs.gap,
      };
    }

    // Direct text preview (without child element text)
    let directText = "";
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 3) {
        directText += child.textContent || "";
      }
    }
    directText = directText.trim().slice(0, 60);

    const children: DesignNodeSummary[] = [];
    if (depth < 8) {
      for (const childEl of Array.from(el.children)) {
        const summary = buildNode(childEl, depth + 1);
        if (summary) {
          children.push(summary);
        }
      }
    }

    return {
      nodeId,
      tagName: tag,
      id: el.id || undefined,
      className:
        typeof el.className === "string" && el.className.trim()
          ? el.className.trim()
          : undefined,
      textPreview: directText || undefined,
      rect: relRect,
      computedStyles,
      children,
    };
  };

  const roots: DesignNodeSummary[] = [];
  for (const child of Array.from(container.children)) {
    const node = buildNode(child, 0);
    if (node) {
      roots.push(node);
    }
  }
  return roots;
}
