import {
  sanitizeAndTagDesignHtml,
  sanitizeDesignBackground,
  sanitizeDesignCss,
} from "../design/sanitize";
import { sanitizeHtml } from "../utils/htmlToExcalidraw";

describe("sanitizeAndTagDesignHtml", () => {
  it("removes executable elements", () => {
    const out = sanitizeAndTagDesignHtml(
      `<div><script>alert(1)</script><iframe src="x"></iframe><object></object><form action="/x"></form></div>`,
      document,
    );
    expect(out).not.toMatch(/<script/i);
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toMatch(/<object/i);
    expect(out).not.toMatch(/<form/i);
  });

  it("strips event handlers and dangerous URLs", () => {
    const out = sanitizeAndTagDesignHtml(
      `<div onclick="alert(1)"><a href=" java\tscript:alert(1)">a</a><img src="ok.png" srcdoc="<script>x</script>" /></div>`,
      document,
    );
    expect(out).not.toMatch(/onclick/i);
    expect(out).not.toMatch(/javascript:/i);
    expect(out).not.toMatch(/srcdoc/i);
  });

  it("tags elements with stable node ids", () => {
    const out = sanitizeAndTagDesignHtml(
      `<div id="hero"></div><span></span>`,
      document,
    );
    expect(out).toContain('data-node-id="id_hero"');
    expect(out).toContain('data-node-id="node_2"');
  });

  it("prevents style tag breakout", () => {
    const out = sanitizeAndTagDesignHtml(
      `<style>.a{}</style><b>x</b>`,
      document,
    );
    expect(out).not.toMatch(/<\/style><b>/i);
  });
});

describe("sanitizeDesignCss", () => {
  it("escapes closing style tags", () => {
    expect(sanitizeDesignCss(".a{}</style><script>")).not.toContain("</style>");
  });

  it("handles empty input", () => {
    expect(sanitizeDesignCss(undefined)).toBe("");
  });
});

describe("sanitizeDesignBackground", () => {
  it("removes declaration breaking characters", () => {
    const out = sanitizeDesignBackground("red;}</style>");
    expect(out).not.toMatch(/[;{}<>"'`\\]/);
  });

  it("falls back to transparent", () => {
    expect(sanitizeDesignBackground(undefined)).toBe("transparent");
    expect(sanitizeDesignBackground("transparent")).toBe("transparent");
  });
});

describe("sanitizeHtml", () => {
  it("removes scripts, handlers and dangerous URLs when a document is provided", () => {
    const out = sanitizeHtml(
      `<html><body><script>alert(1)</script><div onmouseover="x()"></div><a href="javascript:1">a</a></body></html>`,
      document,
    );
    expect(out).not.toMatch(/script/i);
    expect(out).not.toMatch(/onmouseover/i);
    expect(out).not.toMatch(/javascript:/i);
  });

  it("swaps remote image sources for an inline placeholder", () => {
    const out = sanitizeHtml(
      `<img src="https://example.com/a.png" />`,
      document,
    );
    expect(out).toContain("data:image/gif");
    expect(out).not.toContain("https://example.com/a.png");
  });
});
