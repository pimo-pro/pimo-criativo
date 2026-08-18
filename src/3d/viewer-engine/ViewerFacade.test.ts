import { describe, expect, it } from "vitest";
import { ViewerCore } from "./ViewerCore";
import { ViewerFacade } from "./ViewerFacade";

describe("ViewerFacade (Z-01.2.7 E)", () => {
  it("mantém o construtor público ViewerCore até ao fim da fase", () => {
    expect(ViewerFacade).toBe(ViewerCore);
  });
});
