import { describe, expect, it } from "vitest";
import {
  coerceSafeProjectThumbName,
  isValidThumbnailBlob,
  isValidThumbnailDataUrl,
  resolveProjectThumbnailSrc,
} from "./projectThumbnail";

describe("coerceSafeProjectThumbName", () => {
  it("aceita nomes com espacos e acentos", () => {
    expect(coerceSafeProjectThumbName("Antunes Novo Cozinha")).toBe("Antunes Novo Cozinha");
    expect(coerceSafeProjectThumbName("  Projeto  ")).toBe("Projeto");
  });

  it("substitui caracteres ilegais em vez de falhar", () => {
    expect(coerceSafeProjectThumbName("Projeto: A/B|C")).toBe("Projeto_ A_B_C");
  });

  it("rejeita vazio", () => {
    expect(coerceSafeProjectThumbName("")).toBeNull();
    expect(coerceSafeProjectThumbName("   ")).toBeNull();
    expect(coerceSafeProjectThumbName("...")).toBeNull();
  });
});

describe("isValidThumbnailBlob / dataUrl", () => {
  it("rejeita blob vazio ou demasiado pequeno", () => {
    expect(isValidThumbnailBlob(new Blob([]))).toBe(false);
    expect(isValidThumbnailBlob(new Blob([new Uint8Array(10)], { type: "image/jpeg" }))).toBe(false);
  });

  it("aceita blob de imagem com tamanho suficiente", () => {
    expect(
      isValidThumbnailBlob(new Blob([new Uint8Array(128)], { type: "image/jpeg" }))
    ).toBe(true);
  });

  it("valida dataUrl", () => {
    expect(isValidThumbnailDataUrl(null)).toBe(false);
    expect(isValidThumbnailDataUrl("")).toBe(false);
    expect(isValidThumbnailDataUrl("data:text/plain,abc")).toBe(false);
    const b64 = "A".repeat(100);
    expect(isValidThumbnailDataUrl(`data:image/jpeg;base64,${b64}`)).toBe(true);
  });
});

describe("resolveProjectThumbnailSrc (B1 sync)", () => {
  it("usa dataUrl directamente", () => {
    const b64 = "A".repeat(100);
    const dataUrl = `data:image/jpeg;base64,${b64}`;
    expect(resolveProjectThumbnailSrc("Proj", dataUrl)).toBe(dataUrl);
  });

  it("não devolve path /api/projects/thumbs para <img> sem Bearer", () => {
    expect(
      resolveProjectThumbnailSrc("Proj", "/api/projects/thumbs/Proj.jpg")
    ).toBeNull();
    expect(resolveProjectThumbnailSrc("Proj", null)).toBeNull();
  });
});
