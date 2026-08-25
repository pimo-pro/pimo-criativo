import { describe, expect, it } from "vitest";
import { defaultRulesConfig } from "../rules/rulesConfig";
import type { BoxModule, CutListItemComPreco } from "../types";
import { attachLabelNumbersToCutlist, resolvePieceIndustrialId } from "./qrcodeService";
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

  it("QR listas = buildIndustrialId (igual à etiqueta / No ETQ)", () => {
    const qr = resolveUnifiedEtiquetaQrCode(item, ctx, new Map(), 0);
    expect(qr).toBe("an5crlb01");
    expect(qr).not.toMatch(/-/);
  });

  it("código de display = resolveUnifiedEtiquetaQrCode", () => {
    const piecesPerSheet = new Map([["box-1::Remate L B", 4]]);
    const display = resolveEtiquetaDisplayCodeV5(item, ctx, piecesPerSheet, 0);
    expect(display).toBe("an5crlb01");
    expect(display).toBe(resolveUnifiedEtiquetaQrCode(item, ctx, piecesPerSheet, 0));
  });

  it("attachLabelNumbers — pieceNumber + qrSvg; sem shortCode", () => {
    const [withQr] = attachLabelNumbersToCutlist(
      [
        {
          ...item,
          metadata: undefined,
          nome: "Lateral esquerda",
          tipo: "lateral_esquerda",
          pieceNumber: undefined,
        },
      ],
      ctx
    );
    expect(withQr!.pieceNumber).toBeGreaterThan(0);
    expect(withQr!.qrSvg).toBeTruthy();
    expect((withQr as { shortCode?: string }).shortCode).toBeUndefined();
    const id = resolvePieceIndustrialId(withQr!, ctx);
    expect(id).toBeTruthy();
    expect(id).not.toMatch(/-/);
  });
});
