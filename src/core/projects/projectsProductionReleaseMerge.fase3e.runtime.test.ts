/**
 * Fase 3E — diagnóstico H2: productionRelease sobrevive a um save normal posterior?
 *
 * Cenário simulado (sem SSH, sem PHP real):
 * 1) Servidor já tem settings.productionRelease (pós «Gerar arquivo completo»).
 * 2) Cliente faz save normal → buildPimoProjectDataFromRequest (sem productionRelease).
 * 3) API PHP aplica merge defensivo (~513-528) antes de gravar.
 *
 * Pass = H2 refutado para o caminho «POST omitido» (ausência benigna na amostra SSH).
 * Fail = H2 confirmado — merge não restaura o release.
 */
import { describe, expect, it } from "vitest";
import type { ProductionRelease } from "../industrial/productionRelease";
import { extractProductionReleaseFromPimoData } from "../industrial/productionReleasePersist";
import {
  applyPhpDefensiveSettingsMerge,
  PHP_DEFENSIVE_SETTINGS_KEYS,
} from "./projectsPhpSettingsMerge";
import { buildPimoProjectDataFromRequest } from "./projectsMappers";
import type { PimoProjectData, SaveProjectRequest } from "./types";

function sampleRelease(projectId = "pimo-h2-harness-001"): ProductionRelease {
  return {
    version: 1,
    generatedAt: "2026-09-01T14:00:00.000Z",
    projectId,
    chapas: {
      totalSheets: 2,
      totalWasteMm2: 1200,
      totalWastePct: 4.5,
      sheets: [{ id: "sheet-a", materialId: "mdf-19", qty: 1 }],
      mode: "oficial_pro",
      diagnostics: ["origem=oficial_pro", "harness=fase3e"],
    },
    ferragens: {
      totalEur: 42.5,
      totalQty: 3,
      lines: [{ id: "fer-1", label: "Dobradiça", qty: 2, unitEur: 5, totalEur: 10 }],
    },
    custosOrigem: "estimado_fallback",
  };
}

function minimalProjectState(workspaceLabel: string): Record<string, unknown> {
  return {
    projectName: "Harness H2",
    workspaceBoxes: [
      {
        id: "box-1",
        label: workspaceLabel,
        x_mm: 0,
        y_mm: 0,
        z_mm: 0,
        largura_mm: 600,
        altura_mm: 720,
        profundidade_mm: 560,
      },
    ],
    cutList: [],
    industrialPieceEdits: {},
  };
}

function existingServerProject(release: ProductionRelease): PimoProjectData {
  const projectState = minimalProjectState("antes-do-save-normal");
  return {
    id: release.projectId,
    name: "Harness H2",
    ownerId: "owner-h2",
    ownerName: "Owner H2",
    createdAt: "2026-08-01T10:00:00.000Z",
    updatedAt: "2026-09-01T13:00:00.000Z",
    room: null,
    boxes: projectState.workspaceBoxes,
    shelves: [],
    dividers: [],
    centerDisplay: { thumbnailDataUrl: null, projectName: "Harness H2" },
    holes: [],
    drillMarkers: [],
    materials: { materialId: null, material: null },
    viewerSnapshot: null,
    settings: {
      projectState,
      productionRelease: release,
      projectReport: { version: 1, updatedAt: "2026-09-01T12:00:00.000Z" },
    },
    thumbnailDataUrl: null,
  };
}

function normalSaveRequest(release: ProductionRelease): SaveProjectRequest {
  const projectState = minimalProjectState("depois-do-save-normal");
  return {
    name: "Harness H2",
    ownerId: "owner-h2",
    ownerName: "Owner H2",
    remoteProjectId: release.projectId,
    snapshot: {
      projectState,
      viewerSnapshot: null,
      roomSnapshot: null,
    },
    thumbnailDataUrl: null,
  };
}

describe("Fase 3E — H2 productionRelease vs save normal + merge PHP", () => {
  it("passo 2: save normal (buildPimoProjectDataFromRequest) não inclui productionRelease", () => {
    const release = sampleRelease();
    const postBody = buildPimoProjectDataFromRequest(normalSaveRequest(release));
    const settings = postBody.settings as Record<string, unknown>;

    expect(settings).toBeTruthy();
    expect(Object.prototype.hasOwnProperty.call(settings, "productionRelease")).toBe(false);
    expect(extractProductionReleaseFromPimoData(postBody)).toBeNull();
  });

  it("passo 3: merge PHP restaura productionRelease quando o POST o omite (H2 refutado neste caminho)", () => {
    const release = sampleRelease();
    const onDisk = existingServerProject(release);
    const incoming = buildPimoProjectDataFromRequest(normalSaveRequest(release));

    const merged = applyPhpDefensiveSettingsMerge(onDisk, incoming) as PimoProjectData;
    const preserved = extractProductionReleaseFromPimoData(merged);

    expect(preserved).not.toBeNull();
    expect(preserved?.projectId).toBe(release.projectId);
    expect(preserved?.generatedAt).toBe(release.generatedAt);
    expect(preserved?.chapas.totalSheets).toBe(release.chapas.totalSheets);
    expect(preserved?.ferragens.totalEur).toBe(release.ferragens.totalEur);
  });

  it("passo 3: merge PHP também restaura projectReport omitido (controlo positivo)", () => {
    const release = sampleRelease();
    const onDisk = existingServerProject(release);
    const incoming = buildPimoProjectDataFromRequest(normalSaveRequest(release));

    const merged = applyPhpDefensiveSettingsMerge(onDisk, incoming) as PimoProjectData;
    const settings = merged.settings as Record<string, unknown>;

    expect(settings.projectReport).toEqual(
      (onDisk.settings as Record<string, unknown>).projectReport
    );
  });

  it("controlo: projecto novo (sem ficheiro existente) — merge no-op; ausência de release é esperada", () => {
    const release = sampleRelease();
    const incoming = buildPimoProjectDataFromRequest(normalSaveRequest(release));

    const merged = applyPhpDefensiveSettingsMerge(null, incoming);

    expect(extractProductionReleaseFromPimoData(merged)).toBeNull();
  });

  it("diagnóstico limite H2: POST com productionRelease:null NÃO dispara merge (PHP array_key_exists)", () => {
    const release = sampleRelease();
    const onDisk = existingServerProject(release);
    const incoming = buildPimoProjectDataFromRequest(normalSaveRequest(release));
    const incomingWithNull = {
      ...incoming,
      settings: {
        ...(incoming.settings as Record<string, unknown>),
        productionRelease: null,
      },
    };

    const merged = applyPhpDefensiveSettingsMerge(onDisk, incomingWithNull);

    expect(extractProductionReleaseFromPimoData(merged)).toBeNull();
  });

  it("documentação: chaves espelhadas do PHP", () => {
    expect(PHP_DEFENSIVE_SETTINGS_KEYS).toEqual(["projectReport", "productionRelease"]);
  });
});
