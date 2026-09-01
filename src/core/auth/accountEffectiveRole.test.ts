import { describe, expect, it } from "vitest";

import {
  isAccountApproved,
  isAccountPending,
  isEmailVerifiedForLogin,
  resolveEffectiveRole,
  userMustConfirmEmail,
  userRequiresEmailVerification,
} from "./accountEffectiveRole";
import { PLATFORM_ADMIN_EMAIL } from "./platformAdmin";

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

  describe("exceções admin e legadas", () => {
    it("admin sem accountCategory nunca exige confirmação", () => {
      expect(
        userMustConfirmEmail({ role: "admin", email: "admin@example.com", emailVerified: false })
      ).toBe(false);
      expect(
        isEmailVerifiedForLogin({ role: "admin", email: "admin@example.com", emailVerified: false })
      ).toBe(true);
    });

    it("admin com accountCategory corrompido nunca exige confirmação", () => {
      expect(
        userMustConfirmEmail({
          role: "admin",
          accountCategory: "fabricante",
          emailVerified: false,
        })
      ).toBe(false);
    });

    it("email hardcoded admin exclui mesmo com role corrompido", () => {
      expect(
        userMustConfirmEmail({
          role: "visitor",
          email: PLATFORM_ADMIN_EMAIL,
          accountCategory: "fabricante",
          emailVerified: false,
        })
      ).toBe(false);
      expect(
        isEmailVerifiedForLogin({
          role: "",
          email: "SheCivara@Gmail.com",
          emailVerified: false,
        })
      ).toBe(true);
    });

    it("conta legada aprovada sem accountCategory não exige confirmação", () => {
      expect(
        userMustConfirmEmail({ role: "pro", accountStatus: "approved", emailVerified: false })
      ).toBe(false);
      expect(isEmailVerifiedForLogin({ role: "ultra+", emailVerified: false })).toBe(true);
    });

    it("conta legada pending sem accountCategory continua a exigir confirmação", () => {
      expect(userMustConfirmEmail({ accountStatus: "pending", emailVerified: false })).toBe(true);
    });
  });

  describe("confirmação única (Regra 2)", () => {
    it("utilizador já verificado nunca volta a exigir confirmação após mudança de role/categoria", () => {
      const verifiedUser = {
        emailVerified: true as const,
        accountStatus: "approved" as const,
        accountCategory: "fabricante",
        role: "pro",
      };
      expect(userMustConfirmEmail(verifiedUser)).toBe(false);
      expect(userRequiresEmailVerification(verifiedUser)).toBe(false);
      expect(isEmailVerifiedForLogin(verifiedUser)).toBe(true);

      expect(
        userMustConfirmEmail({
          ...verifiedUser,
          role: "ultra+",
          accountCategory: "lojista",
          invitedViaCodeId: "convite-antigo",
        })
      ).toBe(false);
    });
  });
});
