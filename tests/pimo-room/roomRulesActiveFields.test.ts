import { describe, expect, it } from "vitest";
import { ROOM_RULES_DEFAULTS } from "../../src/admin/rules/roomRules/rulesDefaults";
import { ROOMRULES_FIELDS } from "../../src/admin/rules/roomRules/rulesSchema";

describe("roomRules active fields (M9-A)", () => {
  it("só wallOffsetMm permanece no defaults e schema", () => {
    expect(Object.keys(ROOM_RULES_DEFAULTS).sort()).toEqual(["wallOffsetMm"]);
    expect(ROOMRULES_FIELDS.map((f) => f.key)).toEqual(["wallOffsetMm"]);
    expect(ROOM_RULES_DEFAULTS.wallOffsetMm).toBe(50);
  });
});
