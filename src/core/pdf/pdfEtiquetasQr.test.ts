import { describe, expect, it } from "vitest";
import { resolveV5QrImageCode } from "./pdfEtiquetas";

describe("resolveV5QrImageCode", () => {
  it("usa o mesmo código impresso na faixa inferior da etiqueta", () => {
    const displayCode = "kcnc1ld";
    expect(resolveV5QrImageCode(displayCode)).toBe(displayCode);
  });

  it("não transforma nem encurta o código visível", () => {
    const displayCode = "an5crlb01";
    const qrImageCode = resolveV5QrImageCode(displayCode);
    expect(qrImageCode).toBe(displayCode);
    expect(qrImageCode).not.toContain("_");
  });
});
