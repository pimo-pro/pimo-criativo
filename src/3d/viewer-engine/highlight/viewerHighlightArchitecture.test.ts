import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { findForbiddenHighlightPatterns } from "./viewerHighlightGuard";

const VIEWER_ENGINE_ROOT = join(process.cwd(), "src/3d/viewer-engine");

function collectTsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (name === "highlight") continue;
      collectTsFiles(full, out);
    } else if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("viewerHighlightArchitecture — proteção contra sistemas paralelos", () => {
  it("viewer-engine (excepto highlight/) não contém caminhos legados de outline", () => {
    const files = collectTsFiles(VIEWER_ENGINE_ROOT);
    const violations: Array<{ file: string; patterns: string[] }> = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      const patterns = findForbiddenHighlightPatterns(source);
      if (patterns.length > 0) {
        violations.push({ file, patterns });
      }
    }

    expect(violations).toEqual([]);
  });

  it("apenas highlight/ cria flags SSOT de overlay", () => {
    const files = collectTsFiles(VIEWER_ENGINE_ROOT);
    const offenders: string[] = [];
    const allowedReaders = ["ViewerPanelVisibility.ts", "InternalSelectionResolver.ts"];

    for (const file of files) {
      if (file.includes(`${join("3d", "viewer-engine", "highlight")}`)) continue;
      const base = file.split(/[/\\]/).pop() ?? "";
      if (allowedReaders.includes(base)) continue;
      const source = readFileSync(file, "utf8");
      if (
        source.includes("stampPanelContourOverlay") ||
        source.includes("stampHoleHighlightOverlay") ||
        source.includes("createPanelContourGeometry") ||
        source.includes("createHoleCircleGeometry")
      ) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
