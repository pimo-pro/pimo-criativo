import { useCallback, useEffect, useRef, useState } from "react";
import type { HoleTypeId } from "@/core/drill/holeCatalog";
import type { WorkspaceBox } from "@/core/types";
import { defaultRulesConfig } from "@/core/rules/rulesConfig";
import {
  applyAutoAdjustPanelToInnerSpace,
  createCustomIndustrialModelFromDesignBox,
  createIndustrialDesignBox,
  removeDesignDrillHole,
  type CreateCustomIndustrialModelResult,
  type DesignDrillHole,
  type DesignValidationIssue,
  type IndustrialDesignBox,
} from "@/core/industrialDesigner";
import { isViewerApiReady } from "@/core/viewer/viewerReadiness";
import { withIndustrialOutputAuthorization } from "@/core/industrial/industrialOutputGuard";
import type { PimoViewerApi } from "@/context/PimoViewerContextCore";

function buildDesignBoxTemplate(box: WorkspaceBox): IndustrialDesignBox {
  return createIndustrialDesignBox({
    id: box.id,
    nome: box.nome,
    outerWidthMm: box.dimensoes.largura,
    outerHeightMm: box.dimensoes.altura,
    outerDepthMm: box.dimensoes.profundidade,
    espessuraMm: box.espessura,
    materialId: box.material ?? "default",
  });
}

/**
 * Mapa ID sintético (${boxId}:cima, etc.) -> ID real da mesh (WorkspaceBox.panelIds),
 * por posição — createIndustrialDesignBox cria sempre [cima, fundo, lateral-le,
 * lateral-ld, costa] nesta ordem. Sem isto, o raycast do clique 3D nunca encontra o
 * painel: a mesh usa panelIds reais (ViewerPanelVisibility.ts), o designBox usava IDs
 * sintéticos inventados — nunca coincidiam.
 */
function buildRealPanelIdMap(
  template: IndustrialDesignBox,
  panelIds: WorkspaceBox["panelIds"]
): Map<string, string> {
  const map = new Map<string, string>();
  if (!panelIds) return map;
  const realIdsInOrder = [
    panelIds.cima,
    panelIds.fundo,
    panelIds.lateral_esquerda,
    panelIds.lateral_direita,
    panelIds.costa,
  ];
  template.panels.forEach((panel, index) => {
    const realId = realIdsInOrder[index];
    if (realId && realId.trim().length > 0) {
      map.set(panel.id, realId);
    }
  });
  return map;
}

/** Aplica um mapa de IDs a panels[].id e constraints[].panelAId/panelBId. */
function remapDesignBoxPanelIds(
  box: IndustrialDesignBox,
  idMap: Map<string, string>
): IndustrialDesignBox {
  if (idMap.size === 0) return box;
  const panels = box.panels.map((panel) => ({
    ...panel,
    id: idMap.get(panel.id) ?? panel.id,
  }));
  const constraints = box.constraints.map((constraint) => ({
    ...constraint,
    panelAId: idMap.get(constraint.panelAId) ?? constraint.panelAId,
    panelBId: idMap.get(constraint.panelBId) ?? constraint.panelBId,
  }));
  return { ...box, panels, constraints };
}

/**
 * designBox "ao vivo" com IDs de painel reais (para o clique 3D/overlay encontrarem o
 * painel certo) + o mapa sintético->real usado para reverter antes de gravar no
 * catálogo (createIndustrialModel), preservando o formato de sempre em customIndustrialModel.ts.
 */
function workspaceBoxToDesignBox(box: WorkspaceBox): {
  designBox: IndustrialDesignBox;
  realIdMap: Map<string, string>;
} {
  const template = buildDesignBoxTemplate(box);
  const realIdMap = buildRealPanelIdMap(template, box.panelIds);
  return { designBox: remapDesignBoxPanelIds(template, realIdMap), realIdMap };
}

export type UseIndustrialDesignWorkspaceOptions = {
  viewerApi: PimoViewerApi;
  workspaceBox: WorkspaceBox | undefined;
  enabled: boolean;
};

export type UseIndustrialDesignWorkspaceResult = {
  designBox: IndustrialDesignBox | null;
  selectedPanelId: string | null;
  selectedHoleTypeId: HoleTypeId | null;
  insertOnClick: boolean;
  validationIssues: DesignValidationIssue[];
  setSelectedHoleTypeId: (id: HoleTypeId | null) => void;
  setInsertOnClick: (active: boolean) => void;
  removeHole: (panelId: string, holeId: string) => void;
  autoAdjustSelectedPanel: () => void;
  panelWarnings: DesignValidationIssue[];
  canAutoAdjust: boolean;
  createIndustrialModel: (nome?: string) => CreateCustomIndustrialModelResult | null;
  lastCreatedModelId: string | null;
};

export function useIndustrialDesignWorkspace({
  viewerApi,
  workspaceBox,
  enabled,
}: UseIndustrialDesignWorkspaceOptions): UseIndustrialDesignWorkspaceResult {
  const [designBox, setDesignBox] = useState<IndustrialDesignBox | null>(null);
  const [selectedPanelId, setSelectedPanelId] = useState<string | null>(null);
  const [selectedHoleTypeId, setSelectedHoleTypeIdState] = useState<HoleTypeId | null>(null);
  const [insertOnClick, setInsertOnClickState] = useState(false);
  const [validationIssues, setValidationIssues] = useState<DesignValidationIssue[]>([]);
  const [lastCreatedModelId, setLastCreatedModelId] = useState<string | null>(null);
  const boxIdRef = useRef<string | null>(null);
  /** ID sintético -> ID real da mesh, para reverter antes de gravar no catálogo. */
  const panelIdMapRef = useRef<Map<string, string>>(new Map());

  const syncDesignBox = useCallback(
    (box: IndustrialDesignBox | null, targetBoxId?: string | null) => {
      setDesignBox(box);
      if (!isViewerApiReady(viewerApi)) return;
      viewerApi.setIndustrialDesignBox?.(box, targetBoxId ?? box?.id ?? null);
    },
    [viewerApi]
  );

  const setSelectedHoleTypeId = useCallback((id: HoleTypeId | null) => {
    setSelectedHoleTypeIdState(id);
  }, []);

  const setInsertOnClick = useCallback(
    (active: boolean) => {
      setInsertOnClickState(active);
      if (!isViewerApiReady(viewerApi)) return;
      viewerApi.setIndustrialDesignWorkspaceEnabled?.(active);
      if (!active) {
        viewerApi.setIndustrialDesignActiveHoleType?.(null);
        return;
      }
      viewerApi.setPanelRenderingEnabled?.(true);
      viewerApi.setPanelEdgesVisible?.(true);
    },
    [viewerApi]
  );

  useEffect(() => {
    if (!insertOnClick || !isViewerApiReady(viewerApi)) return;
    viewerApi.setIndustrialDesignActiveHoleType?.(selectedHoleTypeId);
  }, [insertOnClick, selectedHoleTypeId, viewerApi]);

  /**
   * Auto-reparação por polling: insertOnClick (intenção do utilizador) é a
   * única fonte de verdade. Um useEffect normal, gatilhado por array de
   * dependências, não chega a correr de novo se nenhuma das dependências
   * muda de referência (confirmado: o modo pode ficar enabled=false sem
   * insertOnClick/selectedHoleTypeId/viewerApi mudarem). Por isso corrigimos
   * por leitura periódica do estado real do viewer, não por reação a uma
   * mudança que pode nunca ser detetada pelo React.
   */
  useEffect(() => {
    if (!insertOnClick) return;
    const id = setInterval(() => {
      if (!isViewerApiReady(viewerApi)) return;
      if (viewerApi.getIndustrialDesignWorkspaceEnabled?.() === false) {
        viewerApi.setIndustrialDesignWorkspaceEnabled?.(true);
        viewerApi.setPanelRenderingEnabled?.(true);
        viewerApi.setPanelEdgesVisible?.(true);
        viewerApi.setIndustrialDesignActiveHoleType?.(selectedHoleTypeId);
      }
    }, 300);
    return () => clearInterval(id);
  }, [insertOnClick, selectedHoleTypeId, viewerApi]);

  const viewerReady = isViewerApiReady(viewerApi);

  useEffect(() => {
    if (!viewerApi || !viewerReady) {
      viewerApi?.setIndustrialDesignWorkspaceEnabled?.(false);
      viewerApi?.setIndustrialDesignActiveHoleType?.(null);
      return;
    }

    if (!enabled || !workspaceBox) {
      viewerApi.setIndustrialDesignWorkspaceEnabled?.(false);
      viewerApi.setIndustrialDesignActiveHoleType?.(null);
      return;
    }

    const boxId = workspaceBox.id;
    boxIdRef.current = boxId;

    const { designBox: templateDesignBox, realIdMap } = workspaceBoxToDesignBox(workspaceBox);
    panelIdMapRef.current = realIdMap;

    const existing = viewerApi.getIndustrialDesignBox?.();
    if (existing?.id === boxId) {
      setDesignBox(existing);
      viewerApi.setIndustrialDesignBox?.(existing, boxId);
    } else {
      setDesignBox(templateDesignBox);
      viewerApi.setIndustrialDesignBox?.(templateDesignBox, boxId);
    }

    setValidationIssues(viewerApi.getIndustrialDesignValidationIssues?.() ?? []);

    viewerApi.setOnIndustrialDesignPanelSelected?.((panelId) => {
      setSelectedPanelId(panelId);
    });
    viewerApi.setOnIndustrialDesignChanged?.((box) => {
      if (boxIdRef.current === box.id) setDesignBox(box);
    });
    viewerApi.setOnIndustrialDesignHolePlaced?.(() => {
      const current = viewerApi.getIndustrialDesignBox?.();
      if (current) setDesignBox(current);
    });
    viewerApi.setOnIndustrialDesignValidationChanged?.((issues) => {
      setValidationIssues(issues);
    });

    setSelectedPanelId(viewerApi.getIndustrialDesignSelectedPanelId?.() ?? null);

    return () => {
      if (!viewerApi) return;
      viewerApi.setOnIndustrialDesignPanelSelected?.(null);
      viewerApi.setOnIndustrialDesignChanged?.(null);
      viewerApi.setOnIndustrialDesignHolePlaced?.(null);
      viewerApi.setOnIndustrialDesignValidationChanged?.(null);
      viewerApi.setOnIndustrialDesignValidationFailed?.(null);
      viewerApi.setIndustrialDesignWorkspaceEnabled?.(false);
      viewerApi.setIndustrialDesignActiveHoleType?.(null);
      // Não repor insertOnClick aqui: é a intenção do utilizador, não estado
      // derivado do viewer. Repor a false nesta cleanup apagava-a sempre que
      // este efeito reexecutava (mesmo sem ação do utilizador), sem nada a
      // restaurar depois — o polling de auto-reparação abaixo trata de
      // reativar o enabled do viewer; insertOnClick só muda por ação directa
      // do utilizador (setInsertOnClick).
    };
  }, [enabled, viewerApi, viewerReady, workspaceBox]);

  const removeHole = useCallback(
    (panelId: string, holeId: string) => {
      if (!designBox || !isViewerApiReady(viewerApi)) return;
      const updated = removeDesignDrillHole(designBox, panelId, holeId);
      syncDesignBox(updated, workspaceBox?.id);
      setValidationIssues(viewerApi.refreshIndustrialDesignValidation?.() ?? []);
    },
    [designBox, syncDesignBox, viewerApi, workspaceBox?.id]
  );

  const autoAdjustSelectedPanel = useCallback(() => {
    if (!designBox || !selectedPanelId || !isViewerApiReady(viewerApi)) return;
    const updated = applyAutoAdjustPanelToInnerSpace(designBox, selectedPanelId);
    syncDesignBox(updated, workspaceBox?.id);
    setValidationIssues(viewerApi.refreshIndustrialDesignValidation?.() ?? []);
  }, [designBox, selectedPanelId, syncDesignBox, viewerApi, workspaceBox?.id]);

  const panelWarnings = validationIssues.filter(
    (issue) => issue.panelId === selectedPanelId && issue.severity === "warning"
  );

  const canAutoAdjust =
    panelWarnings.some((issue) =>
      issue.code === "PANEL_EXCEEDS_INNER_WIDTH" ||
      issue.code === "PANEL_EXCEEDS_INNER_HEIGHT" ||
      issue.code === "PANEL_EXCEEDS_INNER_DEPTH"
    ) && Boolean(selectedPanelId);

  const createIndustrialModel = useCallback(
    (nome?: string): CreateCustomIndustrialModelResult | null => {
      if (!designBox) return null;
      try {
        return withIndustrialOutputAuthorization("all", () => {
          const reverseIdMap = new Map(
            Array.from(panelIdMapRef.current.entries()).map(([syntheticId, realId]) => [
              realId,
              syntheticId,
            ])
          );
          const storageDesignBox = remapDesignBoxPanelIds(designBox, reverseIdMap);
          const result = createCustomIndustrialModelFromDesignBox({
            designBox: storageDesignBox,
            nome,
            project: {
              projectName: workspaceBox?.nome ?? "MODELO_INDUSTRIAL",
              boxes: [],
              rules: defaultRulesConfig,
            },
            rules: defaultRulesConfig,
          });
          setLastCreatedModelId(result.record.id);
          return result;
        });
      } catch {
        return null;
      }
    },
    [designBox, workspaceBox?.nome]
  );

  return {
    designBox,
    selectedPanelId,
    selectedHoleTypeId,
    insertOnClick,
    validationIssues,
    setSelectedHoleTypeId,
    setInsertOnClick,
    removeHole,
    autoAdjustSelectedPanel,
    panelWarnings,
    canAutoAdjust,
    createIndustrialModel,
    lastCreatedModelId,
  };
}

export function formatDesignHoleLabel(hole: DesignDrillHole): string {
  return `${hole.holeTypeId} @ (${hole.xMm.toFixed(0)}, ${hole.yMm.toFixed(0)}) mm`;
}
