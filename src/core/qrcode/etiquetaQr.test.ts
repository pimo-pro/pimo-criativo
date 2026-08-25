import { describe, expect, it } from "vitest";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule, CutListItemComPreco } from "../types";
import { attachQrCodesToCutlist } from "./qrcodeService";
import {
  resolveEtiquetaDisplayCodeV5,
  resolveUnifiedEtiquetaQrCode,
} from "../etiquetas/qr/etiquetaQr";

describe("resolveUnifiedEtiquetaQrCode", () => {
  const boxes: BoxModule[] = [
    {
      id: "box-1",
      nome: "CC4",
      dimensoes: { largura: 600, altura: 720, profundidade: 560 },
      espessura: 19,
      tipoBorda: "reta",
      tipoFundo: "integrado",
      models: [],
      prateleiras: 0,
      portaTipo: "sem_porta",
      gavetas: 0,
      alturaGaveta: 0,
      doorsLayer: [],
      drawersLayer: [],
      cutList: [],
      cutListComPreco: [],
      ferragens: [],
      precoTotalPecas: 0,
      estrutura3D: null,
    },
  ];

  const ctx = {
    projectName: "ANTONIO_NOVO_5",
    boxes,
    rules: defaultRulesConfig,
  };

  const item: CutListItemComPreco = {
    id: "remate-lb",
    nome: "Remate L B",
    tipo: "remate",
    quantidade: 1,
    dimensoes: { largura: 100, altura: 50, profundidade: 19 },
    espessura: 19,
    material: "mdf_branco",
    boxId: "box-1",
    precoUnitario: 0,
    precoTotal: 0,
    metadata: { industrialLabel: "ANTONIO_NOVO_5_CC4_REMATE_L_B_01" },
    pieceNumber: 6,
  };

  it("QR inclui nome industrial completo + número da etiqueta", () => {
    const qr = resolveUnifiedEtiquetaQrCode(item, ctx, new Map(), 0);
    expect(qr).toBe("ANTONIO_NOVO_5_CC4_REMATE_L_B_01-6");
  });

  it("código de display = buildIndustrialId do nome legado (sem NUM_CAIXA/-SEQ)", () => {
    const piecesPerSheet = new Map([["box-1::Remate L B", 4]]);
    const display = resolveEtiquetaDisplayCodeV5(item, ctx, piecesPerSheet, 0);
    // Label legado preservado → ID a partir de antonio_novo_5_cc4_remate_l_b_01
    expect(display).toBe("an5crlb01");
    expect(display).not.toMatch(/-/);
    expect(display).not.toBe(resolveUnifiedEtiquetaQrCode(item, ctx, piecesPerSheet, 0));
  });

  it("peça com attachQrCodes — QR ≠ shortCode", () => {
    const [withQr] = attachQrCodesToCutlist(
      [
        {
          ...item,
          metadata: undefined,
          nome: "Lateral esquerda",
          tipo: "lateral_esquerda",
        },
      ],
      ctx
    );
    const qr = resolveUnifiedEtiquetaQrCode(withQr!, ctx, new Map(), 0);
    expect(qr).toContain("-");
    expect(qr).not.toBe(withQr!.shortCode);
  });
});
