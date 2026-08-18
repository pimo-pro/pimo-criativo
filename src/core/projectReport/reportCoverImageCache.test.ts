import { describe, expect, it } from "vitest";
import {
  getReportCoverImage,
  resolveReportCoverImage,
  setReportCoverImage,
} from "./reportCoverImageCache";

describe("reportCoverImageCache", () => {
  it("guarda e resolve a captura HQ por chave de projeto", () => {
    const dataUrl = "data:image/png;base64,aaa";
    setReportCoverImage("proj-1", dataUrl);
    expect(getReportCoverImage("proj-1")).toBe(dataUrl);
    expect(resolveReportCoverImage([null, " ", "proj-1"])).toBe(dataUrl);
  });

  it("ignora dataUrl inválido", () => {
    setReportCoverImage("proj-2", "http://example.com/x.png");
    expect(getReportCoverImage("proj-2")).toBeNull();
  });
});
