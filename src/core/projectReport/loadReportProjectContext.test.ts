import { describe, expect, it } from "vitest";
import {
  pickFresherReportContext,
  type ReportProjectContext,
} from "./loadReportProjectContext";
import type { ProjectState } from "@/context/projectTypes";

function ctx(
  partial: Partial<ReportProjectContext> & { updatedAt: string; hasState?: boolean }
): ReportProjectContext {
  const hasState = partial.hasState !== false;
  return {
    state: hasState ? ({ projectName: "x" } as ProjectState) : null,
    name: partial.name ?? "n",
    ownerName: partial.ownerName ?? "",
    createdAt: partial.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: partial.updatedAt,
  };
}

describe("pickFresherReportContext (R1)", () => {
  it("null + valor → valor", () => {
    const b = ctx({ updatedAt: "2026-08-01T00:00:00.000Z" });
    expect(pickFresherReportContext(null, b)).toBe(b);
    expect(pickFresherReportContext(b, null)).toBe(b);
  });

  it("prefere quem tem state", () => {
    const withState = ctx({
      updatedAt: "2026-01-01T00:00:00.000Z",
      hasState: true,
    });
    const noState = ctx({
      updatedAt: "2026-12-01T00:00:00.000Z",
      hasState: false,
    });
    expect(pickFresherReportContext(withState, noState)).toBe(withState);
    expect(pickFresherReportContext(noState, withState)).toBe(withState);
  });

  it("entre dois com state, updatedAt mais recente ganha", () => {
    const older = ctx({ updatedAt: "2026-08-01T10:00:00.000Z" });
    const newer = ctx({ updatedAt: "2026-08-27T10:00:00.000Z" });
    expect(pickFresherReportContext(older, newer)).toBe(newer);
    expect(pickFresherReportContext(newer, older)).toBe(newer);
  });

  it("empate de updatedAt → mantém o primeiro arg (remoto/fresco primeiro)", () => {
    const a = ctx({ updatedAt: "2026-08-27T10:00:00.000Z", name: "remoto" });
    const b = ctx({ updatedAt: "2026-08-27T10:00:00.000Z", name: "offline" });
    expect(pickFresherReportContext(a, b)?.name).toBe("remoto");
  });
});
