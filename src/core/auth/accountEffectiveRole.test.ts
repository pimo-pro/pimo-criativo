import { describe, expect, it } from "vitest";

import {
  isAccountApproved,
  isAccountPending,
  isEmailVerifiedForLogin,
  resolveEffectiveRole,
  userMustConfirmEmail,
  userRequiresEmailVerification,
} from "./accountEffectiveRole";

describe("accountEffectiveRole", () => {
  it("pending usa visitor como role efectivo", () => {
    expect(resolveEffectiveRole({ role: "pro", accountStatus: "pending" })).toBe("visitor");
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

  it("visitor orgânico não exige confirmação de email", () => {
    expect(userMustConfirmEmail({ accountCategory: "visitor" })).toBe(false);
    expect(userRequiresEmailVerification({ accountCategory: "visitor", emailVerified: false })).toBe(
      false
    );
    expect(isEmailVerifiedForLogin({ accountCategory: "visitor", emailVerified: false })).toBe(true);
  });

  it("pending / não-visitor exigem email até verificar", () => {
    expect(userMustConfirmEmail({ accountStatus: "pending", accountCategory: "fabricante" })).toBe(
      true
    );
    expect(
      userRequiresEmailVerification({
        accountStatus: "pending",
        accountCategory: "fabricante",
        emailVerified: false,
      })
    ).toBe(true);
    expect(
      isEmailVerifiedForLogin({
        accountStatus: "pending",
        accountCategory: "fabricante",
        emailVerified: true,
      })
    ).toBe(true);
  });

  it("approved via convite exige email até verificar", () => {
    expect(
      userMustConfirmEmail({
        accountStatus: "approved",
        accountCategory: "visitor",
        invitedViaCodeId: "abc",
      })
    ).toBe(true);
    expect(
      userRequiresEmailVerification({
        accountStatus: "approved",
        accountCategory: "visitor",
        invitedViaCodeId: "abc",
        emailVerified: false,
      })
    ).toBe(true);
    expect(
      isEmailVerifiedForLogin({
        accountStatus: "approved",
        invitedViaCodeId: "abc",
        accountCategory: "fabricante",
        emailVerified: true,
      })
    ).toBe(true);
  });
});
