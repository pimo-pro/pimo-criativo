import type { ProjectLoadInput } from "./normalizedProject";

export function resolveJson(input: ProjectLoadInput): unknown {
  if (input.json !== undefined) return input.json;
  if (typeof input.text === "string" && input.text.trim()) {
    try {
      return JSON.parse(input.text) as unknown;
    } catch {
      return null;
    }
  }
  return null;
}
