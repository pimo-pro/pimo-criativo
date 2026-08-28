import { describe, expect, it } from "vitest";

import {
  isAccountApproved,
  isAccountPending,
  isEmailVerifiedForLogin,
  resolveEffectiveRole,
  userRequiresEmailVerification,
} from "./accountEffectiveRole";

describe("accountEffectiveRole", () => {
  it("pending usa visitor como role efectivo", () => {
    expect(
      resolveEffectiveRole({ role: "pro", accountStatus: "pending" })
    ).toBe("visitor");
  });

  it("approved mantém role real", () => {
    expect(resolveEffectiveRole({ role: "ultra+", accountStatus: "approved" })).toBe("ultra+");
    expect(resolveEffectiveRole({ role: "pro" })).toBe("pro");
  });

  it("helpers pending/approved", () => {
    expect(isAccountPending({ accountStatus: "pending" })).toBe(true);
    expect(isAccountApproved({ accountStatus: "pending" })).toBe(false);
    expect(isAccountApproved({ accountStatus: "approved" })).toBe(true);
    expect(isAccountApproved({})).toBe(true);
  });

  it("verificação de email só para pending", () => {
    expect(userRequiresEmailVerification({ accountStatus: "pending" })).toBe(true);
    expect(userRequiresEmailVerification({ accountStatus: "approved" })).toBe(false);
    expect(isEmailVerifiedForLogin({ accountStatus: "approved" })).toBe(true);
    expect(isEmailVerifiedForLogin({ accountStatus: "pending", emailVerified: false })).toBe(false);
    expect(isEmailVerifiedForLogin({ accountStatus: "pending", emailVerified: true })).toBe(true);
  });
});
