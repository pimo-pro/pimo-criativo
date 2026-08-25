import { describe, expect, it } from "vitest";
import {
  buildIndustrialPieceName,
  buildCutLayoutProPartName,
  piecePrefixForCutLayoutPro,
  resolveIndustrialPieceRef,
} from "../cutlayout/cutLayoutProPieceNaming";
import { resolveNomeIndustrialForEtiqueta } from "../etiquetas/industrialDisplayName";
import { buildIndustrialId, buildFullIndustrialName } from "../naming/industrialNaming";
import { getPieceLabel } from "../manufacturing/boxManufacturing";
import { cutlistComPrecoFromBox } from "../manufacturing/cutlistFromBoxes";
import { defaultRulesConfig } from "../rules/rulesConfig";
import {
  buildDrawerScenario,
  minimalBoxWithDrawers,
} from "../../validation/drawerCertificationTestHelpers";

describe("Etiquetas industriais — naming unificado (sem inversão L/R)", () => {
  const projectName = "ProjTest";
  const boxNome = "C1 Armario 1";

  it("SSOT / Viewer / cutlist PRO: nomes correctos (sem inversão)", () => {
    expect(getPieceLabel("lateral_esquerda")).toBe("Lateral esquerda");
    expect(getPieceLabel("lateral_direita")).toBe("Lateral direita");
    expect(piecePrefixForCutLayoutPro({ tipo: "lateral_esquerda" })).toBe("lat_esq");
    expect(piecePrefixForCutLayoutPro({ tipo: "lateral_direita" })).toBe("lat_dir");
    expect(
      buildCutLayoutProPartName({ tipo: "lateral_esquerda" }, boxNome, projectName)
    ).toMatch(/_lat_esq$/i);
    expect(
      buildCutLayoutProPartName({ tipo: "lateral_direita" }, boxNome, projectName)
    ).toMatch(/_lat_dir$/i);
  });

  it("etiqueta: lateral_esquerda → lat_esq; lateral_direita → lat_dir (sem troca)", () => {
    expect(
      resolveNomeIndustrialForEtiqueta({ tipo: "lateral_esquerda" }, projectName, boxNome)
    ).toBe(buildFullIndustrialName(projectName, boxNome, "lateral_esquerda"));
    expect(
      resolveNomeIndustrialForEtiqueta({ tipo: "lateral_direita" }, projectName, boxNome)
    ).toBe(buildFullIndustrialName(projectName, boxNome, "lateral_direita"));

    const esq = resolveNomeIndustrialForEtiqueta(
      { tipo: "lateral_esquerda" },
      projectName,
      boxNome
    );
    const dir = resolveNomeIndustrialForEtiqueta(
      { tipo: "lateral_direita" },
      projectName,
      boxNome
    );
    expect(esq).toContain("lat_esq");
    expect(dir).toContain("lat_dir");
    expect(esq).not.toContain("lat_dir");
    expect(dir).not.toContain("lat_esq");
  });

  it("REF / buildIndustrialPieceName (ainda legado noutros artefactos) mantém inversão até Passo 3", () => {
    expect(buildIndustrialPieceName({ tipo: "lateral_esquerda" }, boxNome, projectName)).toMatch(
      /_lat_dir$/i
    );
    expect(buildIndustrialPieceName({ tipo: "lateral_direita" }, boxNome, projectName)).toMatch(
      /_lat_esq$/i
    );
    expect(resolveIndustrialPieceRef({ tipo: "lateral_esquerda" }, boxNome, projectName)).toMatch(
      /LAT_DIR$/
    );
    expect(resolveIndustrialPieceRef({ tipo: "lateral_direita" }, boxNome, projectName)).toMatch(
      /LAT_ESQ$/
    );
  });

  it.each([1, 3] as const)(
    "módulo com %i gaveta(s): cutlist correcto; etiqueta sem inversão",
    (drawerCount) => {
      const { layers } = buildDrawerScenario({
        boxWidth: 600,
        boxHeight: 720,
        boxDepth: 560,
        drawerCount,
      });
      const box = minimalBoxWithDrawers(layers, { nome: boxNome });
      const cutlist = cutlistComPrecoFromBox(box, defaultRulesConfig);

      const latEsq = cutlist.find((p) => p.tipo === "lateral_esquerda");
      const latDir = cutlist.find((p) => p.tipo === "lateral_direita");
      expect(latEsq).toBeDefined();
      expect(latDir).toBeDefined();

      expect(latEsq!.nome).toBe("Lateral esquerda");
      expect(latDir!.nome).toBe("Lateral direita");
      expect(getPieceLabel(latEsq!.tipo)).toBe("Lateral esquerda");
      expect(getPieceLabel(latDir!.tipo)).toBe("Lateral direita");

      expect(Array.isArray(latEsq!.drillHoles)).toBe(true);
      expect(Array.isArray(latDir!.drillHoles)).toBe(true);

      expect(resolveNomeIndustrialForEtiqueta(latEsq!, projectName, box.nome)).toContain(
        "lat_esq"
      );
      expect(resolveNomeIndustrialForEtiqueta(latDir!, projectName, box.nome)).toContain(
        "lat_dir"
      );
      expect(buildIndustrialId(resolveNomeIndustrialForEtiqueta(latEsq!, projectName, box.nome))).toBeTruthy();
    }
  );

  it("metadata.industrialLabel legado não é recalculado", () => {
    const legacy = "Armario_Test_DIV_01";
    expect(
      resolveNomeIndustrialForEtiqueta(
        { tipo: "DIV", metadata: { industrialLabel: legacy } },
        projectName,
        boxNome
      )
    ).toBe(legacy);
  });
});
