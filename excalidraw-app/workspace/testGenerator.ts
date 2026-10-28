import type { TDDScenario, TestExportFramework } from "./types";

export function generateExecutableTestSpec(
  scenarios: TDDScenario[],
  framework: TestExportFramework,
  suiteTitle = "SynapDraw SDLC Test Suite",
): { code: string; filename: string } {
  const safeSlug = suiteTitle
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/gi, "-")
    .replace(/^-|-$/g, "");

  if (framework === "gherkin") {
    const blocks = scenarios.map((sc) => {
      const assertionsAnd = sc.assertions
        .map((a) => `    And ${a.text}`)
        .join("\n");
      return `  @${sc.category} @${sc.status}
  Scenario: [${sc.key}] ${sc.title}
    Given ${sc.given}
    When ${sc.when}
    Then ${sc.then}${assertionsAnd ? `\n${assertionsAnd}` : ""}`;
    });

    return {
      filename: `${safeSlug || "sdlc-scenarios"}.feature`,
      code: `Feature: ${suiteTitle}
  # SynapDraw TDD Studio tarafından otomatik üretilmiştir

${blocks.join("\n\n")}
`,
    };
  }

  if (framework === "playwright") {
    const tests = scenarios.map((sc) => {
      const checks =
        sc.assertions.length > 0
          ? sc.assertions
              .map(
                (a) =>
                  `    // Doğrulama (${a.passed ? "GEÇTİ" : "BEKLİYOR"}): ${
                    a.text
                  }\n    await expect(page.locator("body")).toBeVisible();`,
              )
              .join("\n")
          : `    await expect(page.locator("body")).toBeVisible();`;

      return `  test("${sc.key}: ${sc.title.replace(/"/g, '\\"')}", async ({ page }) => {
    // GIVEN: ${sc.given}
    await page.goto("http://localhost:3000");

    // WHEN: ${sc.when}
    // TODO: İlgili kullanıcı etkileşimini tetikleyin

    // THEN: ${sc.then}
${checks}
  });`;
    });

    return {
      filename: `${safeSlug || "sdlc-e2e"}.spec.ts`,
      code: `import { test, expect } from "@playwright/test";

test.describe("${suiteTitle.replace(/"/g, '\\"')}", () => {
${tests.join("\n\n")}
});
`,
    };
  }

  // Default: Vitest / Jest (.test.ts)
  const unitTests = scenarios.map((sc) => {
    const asserts =
      sc.assertions.length > 0
        ? sc.assertions
            .map(
              (a) =>
                `    // Assertion: ${a.text}\n    expect(${
                  a.passed ? "true" : "true /* TODO: implement */"
                }).toBe(true);`,
            )
            .join("\n")
        : `    expect(true).toBe(true);`;

    return `  it("${sc.key}: ${sc.title.replace(/"/g, '\\"')} [${sc.status.toUpperCase()}]", async () => {
    // GIVEN: ${sc.given}
    // WHEN:  ${sc.when}
    // THEN:  ${sc.then}
${asserts}
  });`;
  });

  return {
    filename: `${safeSlug || "sdlc-suite"}.test.ts`,
    code: `import { describe, it, expect } from "vitest";

describe("${suiteTitle.replace(/"/g, '\\"')}", () => {
${unitTests.join("\n\n")}
});
`,
  };
}
