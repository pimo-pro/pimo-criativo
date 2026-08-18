import { useCallback, useEffect, useRef } from "react";
import type { BoxModule, WorkspaceBox } from "../core/types";
import { convertWorkspaceToBox } from "../context/projectState";
import { getProfundidadeInternaUtilMm } from "../core/box/boxDepthHelpers";
import { resolveCostaThicknessMm } from "../core/materials/materials.api";
import { resolveCostaAtivaForBox, resolveNoBackPanel } from "../core/box/backPanelFlags";
import { doorLayerItemsForViewer } from "../core/box/doorLayerItemsForViewer";
import type { DoorLayerItem } from "../models/BoxLayers";
import { isPiBaseCabinetId } from "../data/moveisUnificados/pi/models";
import { isCadOnlyWorkspaceBox } from "../core/viewer/isCadOnlyWorkspaceBox";
import { getSettings } from "../core/settings/settingsService";
import type { BoxOptions } from "../3d/objects/BoxBuilder";
import { mmToM } from "../utils/units";
import { devLogger } from "../utils/devLogger";
import { getViewerMaterialId } from "../core/materials/service";
import { resolveDrawerFrontMaterialId } from "../core/drawers/drawerFrontMaterial";
import {
  resolveActiveDrawersLayer,
} from "../core/drawers";
import { syncDrawerFrontMaterialToViewer } from "../industrial/viewerIntegration";
import { buildViewerDrillMarkersByPanel } from "../modules/drilling/drillingAdapter";
import { cutlistComPrecoFromBox } from "../core/manufacturing/cutlistFromBoxes";
import { buildCornerDoorLayerItems, getCornerCabinetConfig, isCornerLayoutSsotModel, migrateCornerDireitaInferiorBoxToV2, syncCornerWorkspaceBoxDoorsLayer } from "../core/cornerCabinet";
import { isIndustrialFileGenerationActive } from "../core/fabrication/industrialGenerationSuspend";
import type { RulesConfig } from "../core/rules/rulesConfig";

type ViewerApi = {
  addBox: (_id: string, _options?: BoxOptions) => boolean;
  removeBox: (_id: string) => boolean;
  updateBox: (_id: string, _options: Partial<BoxOptions>) => boolean;
  setBoxIndex: (_id: string, _index: number) => boolean;
  setBoxGap: (_gap: number) => void;
  updateDrawerMaterial?: (_boxId: string, _drawerLayerId: string, _materialId: string) => void;
};

type BoxState = { index: number };

/** Fingerprint da estrutura da caixa (dimensões, portas, gavetas, etc.) para evitar updateBox completo quando só posição/rotação mudou (ex.: após drag). */
function getStructureFingerprint(
  wsBox: WorkspaceBox,
  piLateralDrillCountSig?: string | null,
  viewerDebug?: { showDrawerDrilling?: boolean }
): string {
  const d = wsBox.dimensoes;
  const doors = wsBox.doorsLayer ?? [];
  const drawers = resolveActiveDrawersLayer(wsBox);
  const doorSig = doors.map((door) => ({
    id: door.id,
    width: door.width,
    height: door.height,
    thickness: door.thickness,
    posX: door.posX,
    posY: door.posY,
    posZ: door.posZ,
    rotY: door.rotY,
    isOpen: door.isOpen,
    openDirection: door.openDirection,
    hingeSide: door.hingeSide,
    pivot: door.pivot,
    material: door.material,
    materialId: door.materialId,
  }));
  if (import.meta.env.DEV && doors.length > 0) {
    devLogger.debug("[DOOR-MAT] getStructureFingerprint doorSig", { boxId: wsBox.id, doorSig });
  }
  const drawerSig = drawers.map((drawer) => ({
    id: drawer.id,
    width: drawer.width,
    height: drawer.height,
    depth: drawer.depth,
    bodyHeight: drawer.bodyHeight,
    frontThickness: drawer.frontThickness,
    posX: drawer.posX,
    posY: drawer.posY,
    posZ: drawer.posZ,
    rotY: drawer.rotY,
    isOpen: drawer.isOpen,
    pullDistanceMm: drawer.pullDistanceMm,
    material: drawer.material,
    materialId: drawer.materialId,
    frontMaterial: drawer.metadata?.frontMaterial,
    frontHeightMm: drawer.metadata?.frontHeightMm,
    slideType: drawer.slideType ?? drawer.metadata?.slideType,
    metalBoxType: drawer.metalBoxType ?? drawer.metadata?.metalBoxType,
    metalBoxProfileId: drawer.metadata?.metalBoxProfileId,
    metalBoxHeightMm: drawer.metadata?.metalBoxHeightMm,
    softClose: drawer.softClose,
    handleType: drawer.handleType ?? drawer.metadata?.handleType,
    handlePosition: drawer.handlePosition ?? drawer.metadata?.handlePosition,
    handleOffsetMm: drawer.handleOffsetMm ?? drawer.metadata?.handleOffsetMm,
    handleProfileId: drawer.metadata?.handleProfileId,
    handleCenterDistanceMm: drawer.metadata?.handleCenterDistanceMm,
    handleOffsetXMm: drawer.metadata?.handleOffsetXMm,
    handleOffsetYMm: drawer.metadata?.handleOffsetYMm,
    handlePositionPercent: drawer.metadata?.handlePositionPercent,
    nominalDepth: drawer.metadata?.nominalDepth,
    drawerType: drawer.type ?? drawer.drawerType,
    hardwareSource: drawer.metadata?.hardwareSource,
    drawerGroupName: drawer.metadata?.drawerGroupName,
    frontPieceName: drawer.metadata?.frontExtPieceName ?? drawer.metadata?.frontPieceName,
    frontIntPieceName: drawer.metadata?.frontIntPieceName,
  }));
  const divSig = (wsBox.divisores ?? []).map((d) => ({
    id: d.id,
    positionMm: d.positionMm,
    referenceEdge: d.referenceEdge,
    alturaMm: d.alturaMm,
    profundidadeMm: d.profundidadeMm,
    linkedSeparadorId: d.linkedSeparadorId,
    posicaoRelativaAoSep: d.posicaoRelativaAoSep,
    prateleiraLado: d.prateleiraLado,
    prateleiraYsMm: d.prateleiraYsMm,
  }));
  const sepSig = (wsBox.separadores ?? []).map((s) => ({
    id: s.id,
    positionMm: s.positionMm,
    referenceEdge: s.referenceEdge,
    larguraMm: s.larguraMm,
    profundidadeMm: s.profundidadeMm,
    ancoraHorizontal: s.ancoraHorizontal,
  }));
  const m = getSettings().modeloPI;
  const piDrillSig =
    isPiBaseCabinetId(wsBox.baseCabinetId) && m
      ? {
          ativarFuracaoPrateleiras: m.ativarFuracaoPrateleiras,
          ativarFuracaoDobradicas: m.ativarFuracaoDobradicas,
          ativarFuracaoGavetas: m.ativarFuracaoGavetas,
          comprimentoCorredicaMm: m.comprimentoCorredicaMm,
        }
      : null;

  return JSON.stringify({
    w: d?.largura,
    h: d?.altura,
    p: d?.profundidade,
    shelves: wsBox.prateleiras,
    portaTipo: wsBox.portaTipo,
    drawerHeightMode: wsBox.drawerHeightMode,
    baseCabinetId: wsBox.baseCabinetId,
    orientation: wsBox.orientation ?? "direita",
    piHideDrawerHoles: wsBox.piHideDrawerHoles === true,
    piDrillSig,
    /** Evita update só posRot quando o cutlist/view ficou com furação lateral PI atrasada (ex. box ainda não existia em project.boxes). */
    piLateralDrillCountSig: piLateralDrillCountSig ?? null,
    doors: doorSig,
    drawers: drawerSig,
    divisores: divSig,
    separadores: sepSig,
    shelfOptions: wsBox.shelfOptions ?? null,
    material: wsBox.material,
    espessura: wsBox.espessura,
    cabinetType: wsBox.cabinetType,
    feetEnabled: wsBox.feetEnabled,
    pe_cm: wsBox.pe_cm,
    feetHeight: wsBox.feetHeight,
    feetOffsetFront: wsBox.feetOffsetFront,
    noBackPanel: resolveNoBackPanel(wsBox),
    costaMaterialId: wsBox.costaMaterialId,
    costaThicknessMm: wsBox.costaThicknessMm,
    separadorMaterialId: wsBox.separadorMaterialId,
    ...optionalFrenteFixaMaterialOpts(wsBox),
    profundidadeExterna: wsBox.profundidadeExterna,
    viewerDebug: viewerDebug ?? null,
  });
}

function optionalFrenteFixaMaterialOpts(wsBox: WorkspaceBox): { frenteFixaMaterialId?: string } {
  const id =
    typeof wsBox.frenteFixaMaterialId === "string" ? wsBox.frenteFixaMaterialId.trim() : "";
  return id ? { frenteFixaMaterialId: id } : {};
}

/** Material das frentes de gaveta (independente do corpo) — sync imediato sem rebuild estrutural. */
function getDrawerFrontMaterialsFingerprint(
  wsBox: WorkspaceBox,
  _fallbackMaterialId: string
): string {
  void _fallbackMaterialId;
  return JSON.stringify(
    (wsBox.drawersLayer ?? []).map((drawer) => ({
      id: drawer.id,
      // Só matéria explícita — nunca herdar a do módulo no fingerprint/sync.
      materialId: resolveDrawerFrontMaterialId(drawer, "") || null,
    }))
  );
}

/**
 * Portas enviadas ao Viewer: compensar Z quando a carcaça usa P útil (centrada).
 * @deprecated import from core/box/doorLayerItemsForViewer
 */
function doorLayerItemsForViewerLocal(
  items: DoorLayerItem[],
  profundidadeExternaMm: number,
  profundidadeInternaUtilMm: number
): DoorLayerItem[] {
  return doorLayerItemsForViewer(items, profundidadeExternaMm, profundidadeInternaUtilMm);
}

/** Posição/rotação da caixa no viewer (metros / radianos). Reutilizado pelo showroom para alinhar a pré-visualização ao Workspace. */
export function getBoxPositionAndRotation(workspaceBox: WorkspaceBox | undefined): Partial<BoxOptions> {
  if (!workspaceBox) return {};
  const opts: Partial<BoxOptions> = {};
  const isLower = workspaceBox.cabinetType === "lower";
  const feetOn = workspaceBox.feetEnabled !== false && isLower;
  const shouldSendPosition =
    workspaceBox.manualPosition === true ||
    (workspaceBox.feetEnabled === true && workspaceBox.posicaoY_mm != null && workspaceBox.posicaoY_mm > 0) ||
    isLower; // sempre enviar posição para módulos de chão, para nunca resetar Y/Z
  if (shouldSendPosition) {
    const x = mmToM(workspaceBox.posicaoX_mm ?? 0);
    const z = mmToM(workspaceBox.posicaoZ_mm ?? 0);
    const alturaMm = workspaceBox.dimensoes?.altura ?? 0;
    const feetHeight = Math.max(40, workspaceBox.feetHeight ?? (workspaceBox.pe_cm ?? 10) * 10);
    const yMm =
      feetOn && (workspaceBox.posicaoY_mm == null || workspaceBox.posicaoY_mm <= 0)
        ? feetHeight + alturaMm / 2
        : workspaceBox.posicaoY_mm != null && workspaceBox.posicaoY_mm > 0
          ? workspaceBox.posicaoY_mm
          : alturaMm / 2;
    const y = mmToM(yMm);
    opts.position = { x, y, z };
    if (workspaceBox.rotacaoX != null && Number.isFinite(workspaceBox.rotacaoX)) {
      opts.rotationX = workspaceBox.rotacaoX;
    }
    if (workspaceBox.rotacaoY != null && Number.isFinite(workspaceBox.rotacaoY)) {
      opts.rotationY = workspaceBox.rotacaoY;
    }
    if (workspaceBox.rotacaoZ != null && Number.isFinite(workspaceBox.rotacaoZ)) {
      opts.rotationZ = workspaceBox.rotacaoZ;
    }
    if (workspaceBox.costaRotationY != null && Number.isFinite(workspaceBox.costaRotationY)) {
      opts.costaRotationY = workspaceBox.costaRotationY;
    }
  }
  if (workspaceBox.manualPosition !== undefined) {
    opts.manualPosition = workspaceBox.manualPosition;
  }
  return opts;
}

export const useCalculadoraSync = (
  boxes: BoxModule[],
  workspaceBoxes: WorkspaceBox[],
  viewerApi: ViewerApi,
  gap?: number,
  materialName?: string,
  /** Quando true, o viewer está montado e pronto para receber caixas. */
  viewerReady?: boolean,
  /** Id do material do projeto (CRUD); usado quando a caixa não tem material próprio. */
  projectMaterialId?: string,
  /** Regras do projeto; usadas para gerar cutlist com drillHoles quando box.cutList não está populado. */
  rules?: RulesConfig,
  /** Debug viewer — marcadores de furação nas gavetas. */
  showDrawerDrilling?: boolean
) => {
  const boxesRef = useRef<BoxModule[]>(boxes);
  const workspaceBoxesRef = useRef<WorkspaceBox[]>(workspaceBoxes);
  const viewerApiRef = useRef(viewerApi);
  const projectMaterialIdRef = useRef<string | undefined>(projectMaterialId);
  const showDrawerDrillingRef = useRef<boolean>(showDrawerDrilling === true);
  const stateRef = useRef<Map<string, BoxState>>(new Map());
  const prevViewerReadyRef = useRef<boolean | undefined>(false);
  /** Última estrutura conhecida por box id; quando igual, só enviamos position/rotation para evitar rebuild no Viewer. */
  const lastStructureFingerprintRef = useRef<Map<string, string>>(new Map());
  const lastDrawerFrontMaterialsFingerprintRef = useRef<Map<string, string>>(new Map());

  // Atualizar refs durante o render para que o effect de sync use sempre boxes/workspaceBoxes mais recentes
  // (evita condição de corrida em que o effect roda antes dos refs serem atualizados).
  /* eslint-disable react-hooks/refs -- intencional: atualizar refs no render para o sync ver sempre o último estado antes do efeito (evita corrida; ver comentário acima). */
  boxesRef.current = boxes;
  workspaceBoxesRef.current = workspaceBoxes;
  viewerApiRef.current = viewerApi;
  projectMaterialIdRef.current = projectMaterialId;
  showDrawerDrillingRef.current = showDrawerDrilling === true;
  /* eslint-enable react-hooks/refs */

  useEffect(() => {
    projectMaterialIdRef.current = projectMaterialId;
  }, [projectMaterialId]);

  useEffect(() => {
    showDrawerDrillingRef.current = showDrawerDrilling === true;
  }, [showDrawerDrilling]);

  useEffect(() => {
    viewerApiRef.current = viewerApi;
  }, [viewerApi]);

  const syncFromCalculator = useCallback(() => {
    if (isIndustrialFileGenerationActive()) return;
    const api = viewerApiRef.current;
    if (!api) return;
    const syncDrawerFrontMaterialsIfNeeded = (wsBox: WorkspaceBox, resolvedMat: string) => {
      const drawerMatFp = getDrawerFrontMaterialsFingerprint(wsBox, resolvedMat);
      const lastDrawerMatFp = lastDrawerFrontMaterialsFingerprintRef.current.get(wsBox.id);
      if (lastDrawerMatFp === drawerMatFp) return;
      for (const drawer of wsBox.drawersLayer ?? []) {
        // Sem fallback ao módulo: só sincronizar matéria de frente explícita.
        const matId = resolveDrawerFrontMaterialId(drawer, "").trim();
        if (!matId) continue;
        syncDrawerFrontMaterialToViewer(wsBox.id, drawer.id, matId);
      }
      lastDrawerFrontMaterialsFingerprintRef.current.set(wsBox.id, drawerMatFp);
    };
    const currentBoxes = boxesRef.current ?? [];
    const wsBoxes = workspaceBoxesRef.current ?? [];
    const viewerDebug = { showDrawerDrilling: showDrawerDrillingRef.current };
    if (import.meta.env.DEV && wsBoxes.length > 0) {
      devLogger.debug("[DOOR-MAT] syncFromCalculator INÍCIO — wsBoxes (ref) door materials", {
        wsBoxesCount: wsBoxes.length,
        porBox: wsBoxes.map((ws) => ({
          boxId: ws.id,
          doors: (ws.doorsLayer ?? []).map((d) => ({ id: d.id, material: d.material, materialId: d.materialId })),
        })),
      });
    }
    const boxById = new Map(currentBoxes.map((box) => [box.id, box]));
    const nextState = new Map<string, BoxState>();
    const currentIds = new Set<string>();

    wsBoxes.forEach((wsBox, index) => {
      const box = boxById.get(wsBox.id);
      currentIds.add(wsBox.id);
      const posRot = getBoxPositionAndRotation(wsBox);

      const widthMm = Number.isFinite(wsBox.dimensoes?.largura) ? wsBox.dimensoes.largura : undefined;
      const heightMm = Number.isFinite(wsBox.dimensoes?.altura) ? wsBox.dimensoes.altura : undefined;
      const depthMm = Number.isFinite(wsBox.dimensoes?.profundidade)
        ? wsBox.dimensoes.profundidade
        : undefined;
      const width = widthMm !== undefined ? mmToM(widthMm) : undefined;
      const height = heightMm !== undefined ? mmToM(heightMm) : undefined;
      const depth = depthMm !== undefined ? mmToM(depthMm) : undefined;

      let layoutDepthM: number | undefined;
      let carcassDepthM: number | undefined;
      const wsBoxSynced = migrateCornerDireitaInferiorBoxToV2(syncCornerWorkspaceBoxDoorsLayer(wsBox));
      let doorLayerItems: DoorLayerItem[] = wsBoxSynced.doorsLayer ?? [];
      const cornerCfg = getCornerCabinetConfig(wsBoxSynced.baseCabinetId);
      if (cornerCfg && wsBoxSynced.portaTipo === "porta_simples") {
        doorLayerItems = buildCornerDoorLayerItems(wsBoxSynced, wsBoxSynced.doorsLayer);
      } else if (isCornerLayoutSsotModel(wsBoxSynced.baseCabinetId)) {
        doorLayerItems = [];
      }
      if (depthMm !== undefined && Number.isFinite(depthMm)) {
        const profundidadeExternaMm = Number(wsBox.profundidadeExterna ?? depthMm) || 0;
        const espessuraCostaMm = resolveCostaThicknessMm(wsBox);
        const profundidadeInternaUtilMm = getProfundidadeInternaUtilMm(
          {
            dimensoes: { profundidade: profundidadeExternaMm },
            espessura: wsBox.espessura,
            portaTipo: wsBox.portaTipo,
            doorsLayer: wsBox.doorsLayer,
            drawersLayer: resolveActiveDrawersLayer(wsBox),
            gavetas: wsBox.gavetas,
            costaAtiva: resolveCostaAtivaForBox(wsBox),
          },
          espessuraCostaMm
        );
        layoutDepthM = mmToM(profundidadeExternaMm);
        carcassDepthM = mmToM(profundidadeInternaUtilMm);
        doorLayerItems = doorLayerItemsForViewerLocal(wsBox?.doorsLayer ?? [], profundidadeExternaMm, profundidadeInternaUtilMm);
      }

      const thicknessMm = Number.isFinite(wsBox.espessura) ? wsBox.espessura : undefined;
      const thickness = thicknessMm !== undefined ? mmToM(thicknessMm) : undefined;
      const effectiveMaterial =
        wsBox.material ??
        box?.material ??
        projectMaterialIdRef.current ??
        materialName ??
        "mdf_branco";
      const resolvedMaterialName = getViewerMaterialId(effectiveMaterial);
      const cadOnly = isCadOnlyWorkspaceBox(wsBox);

      const shelves = Number.isFinite(wsBox.prateleiras) ? Math.max(0, wsBox.prateleiras) : undefined;
      const cabinetType = wsBox?.cabinetType === "lower" || wsBox?.cabinetType === "upper" ? wsBox.cabinetType : undefined;
      const feetHeight = Math.max(40, wsBox?.feetHeight ?? ((wsBox?.pe_cm ?? 10) * 10));
      const feetOffsetFront = Math.max(0, wsBox?.feetOffsetFront ?? 100);
      const pe_cm = feetHeight / 10;
      const feetEnabled = wsBox?.feetEnabled ?? (cabinetType === "lower");
      const autoRotateEnabled = wsBox?.autoRotateEnabled;
      const drawerLayerItems = resolveActiveDrawersLayer(wsBox ?? {});
      if (import.meta.env.DEV && doorLayerItems.length > 0) {
        devLogger.debug("[DOOR-MAT] useCalculadoraSync doorLayerItems por box", {
          boxId: wsBox.id,
          doorLayerItems: doorLayerItems.map((d) => ({ id: d.id, material: d.material, materialId: d.materialId })),
        });
      }
      const useCabinetLock = cabinetType === "lower" && feetEnabled;
      const cabinetOpts: Partial<BoxOptions> = useCabinetLock
        ? { cabinetType, pe_cm, feetEnabled, feetHeight, feetOffsetFront }
        : { cabinetType: null, pe_cm, feetEnabled, feetHeight, feetOffsetFront };
      const rotateOpts = autoRotateEnabled === false ? { autoRotateEnabled: false } : {};
      const locked = wsBox.locked === true;
      // [CORRIGIDO 2026-03] Sempre recalcular cutlist a partir do box atual (dimensões + layers) para furações paramétricas.
      // drillMarkersByPanel deve SEMPRE ser recalculado e passado explicitamente para updateBox.
      // Nunca usar valor antigo/cached: isso garante atualização 100% paramétrica e elimina furos congelados.
      const effectiveBox = box ?? convertWorkspaceToBox(syncCornerWorkspaceBoxDoorsLayer(wsBox));
      const cutListForBox = rules ? cutlistComPrecoFromBox(effectiveBox, rules) : [];
      const drillMarkersByPanel = buildViewerDrillMarkersByPanel(cutListForBox);
      const piLateralDrillCountSig = isPiBaseCabinetId(wsBox.baseCabinetId)
        ? `${drillMarkersByPanel.lateral_esquerda?.length ?? 0}|${drillMarkersByPanel.lateral_direita?.length ?? 0}`
        : null;
      if (!stateRef.current.has(wsBox.id)) {
        const added = api.addBox(wsBox.id, {
          width,
          height,
          depth: layoutDepthM ?? depth,
          layoutDepthM,
          carcassDepthM,
          thickness,
          panelIds: wsBox.panelIds,
          shelves,
          materialName: resolvedMaterialName,
          index,
          cadOnly,
          baseCabinetId: wsBox.baseCabinetId,
          orientation: wsBox.orientation ?? "direita",
          ...cabinetOpts,
          ...rotateOpts,
          locked,
          doorLayerItems,
          drawerLayerItems,
          divisores: wsBox.divisores ?? [],
          separadores: wsBox.separadores ?? [],
          shelfOptions: wsBox.shelfOptions,
          drillMarkersByPanel,
          showDrawerDrilling: viewerDebug.showDrawerDrilling,
          noBackPanel: resolveNoBackPanel(wsBox),
          costaAtiva: resolveCostaAtivaForBox(wsBox),
          portaTipo: wsBox.portaTipo,
          gavetas: wsBox.gavetas,
          bodyMaterialId: wsBox.material,
          costaMaterialId: wsBox.costaMaterialId,
          separadorMaterialId: wsBox.separadorMaterialId,
          ...optionalFrenteFixaMaterialOpts(wsBox),
          ...posRot,
        });
        if (!added) {
          if (import.meta.env.DEV) {
            devLogger.debug("[useCalculadoraSync] addBox falhou — retry no próximo sync", {
              boxId: wsBox.id,
            });
          }
          return;
        }
        nextState.set(wsBox.id, { index });
        lastStructureFingerprintRef.current.set(
          wsBox.id,
          getStructureFingerprint(wsBox, piLateralDrillCountSig, viewerDebug)
        );
        lastDrawerFrontMaterialsFingerprintRef.current.set(
          wsBox.id,
          getDrawerFrontMaterialsFingerprint(wsBox, resolvedMaterialName)
        );
      } else {
        nextState.set(wsBox.id, { index });
        const structureFingerprint = getStructureFingerprint(wsBox, piLateralDrillCountSig, viewerDebug);
        const lastFingerprint = lastStructureFingerprintRef.current.get(wsBox.id);
        if (lastFingerprint === structureFingerprint) {
          if (import.meta.env.DEV && (wsBox?.doorsLayer?.length ?? 0) > 0) {
            devLogger.debug("[DOOR-MAT] useCalculadoraSync SKIP full update (fingerprint igual) — só posRot", {
              boxId: wsBox.id,
              doorMaterials: wsBox.doorsLayer?.map((d) => ({ id: d.id, material: d.material })),
            });
          }
          // Apenas posição/rotação mudaram (ex.: drag no viewer). Só atualizar transform para não disparar rebuild (updateBoxGroup/createDoorObject).
          api.updateBox(wsBox.id, { ...posRot, locked });
          syncDrawerFrontMaterialsIfNeeded(wsBox, resolvedMaterialName);
        } else {
          if (import.meta.env.DEV) {
            devLogger.debug("[DOOR-MAT] useCalculadoraSync FULL updateBox (fingerprint mudou)", {
              boxId: wsBox.id,
              doorLayerItems: (wsBox.doorsLayer ?? []).map((d) => ({ id: d.id, material: d.material, materialId: d.materialId })),
            });
            devLogger.debug("[useCalculadoraSync] estrutura mudou, chamando updateBox com dimensões", {
              boxId: wsBox.id,
              width,
              height,
              depth,
            });
          }
          api.updateBox(wsBox.id, {
            width,
            height,
            depth: layoutDepthM ?? depth,
            layoutDepthM,
            carcassDepthM,
            thickness,
            panelIds: wsBox.panelIds,
            shelves,
            materialName: resolvedMaterialName,
            index,
            baseCabinetId: wsBox.baseCabinetId,
            orientation: wsBox.orientation ?? "direita",
            ...cabinetOpts,
            ...rotateOpts,
            locked,
            doorLayerItems,
            drawerLayerItems,
            divisores: wsBox.divisores ?? [],
            separadores: wsBox.separadores ?? [],
            shelfOptions: wsBox.shelfOptions,
            drillMarkersByPanel,
            showDrawerDrilling: viewerDebug.showDrawerDrilling,
            noBackPanel: resolveNoBackPanel(wsBox),
            costaAtiva: resolveCostaAtivaForBox(wsBox),
            portaTipo: wsBox.portaTipo,
            gavetas: wsBox.gavetas,
            bodyMaterialId: wsBox.material,
            costaMaterialId: wsBox.costaMaterialId,
            separadorMaterialId: wsBox.separadorMaterialId,
            ...optionalFrenteFixaMaterialOpts(wsBox),
            ...posRot,
          });
          lastStructureFingerprintRef.current.set(wsBox.id, structureFingerprint);
          syncDrawerFrontMaterialsIfNeeded(wsBox, resolvedMaterialName);
        }
      }
    });

    Array.from(stateRef.current.keys()).forEach((id) => {
      if (!currentIds.has(id)) {
        api.removeBox(id);
        lastStructureFingerprintRef.current.delete(id);
        lastDrawerFrontMaterialsFingerprintRef.current.delete(id);
      }
    });

    stateRef.current = nextState;
  }, [materialName, rules, showDrawerDrilling]);

  useEffect(() => {
    // Só sincronizar quando o viewer estiver explicitamente pronto
    if (viewerReady !== true) return;
    // Ao passar a true, limpar estado para forçar addBox em todas as caixas (viewer pode ter sido recriado)
    if (prevViewerReadyRef.current !== true) {
      stateRef.current = new Map();
      prevViewerReadyRef.current = true;
    }
    syncFromCalculator();
  }, [boxes, workspaceBoxes, syncFromCalculator, viewerReady, showDrawerDrilling]);

  useEffect(() => {
    const api = viewerApiRef.current;
    if (gap !== undefined && Number.isFinite(gap) && api && typeof api.setBoxGap === "function") {
      api.setBoxGap(gap);
    }
  }, [gap]);

  return { syncFromCalculator };
};
