import { useMemo } from "react";
import type { ProjectActions } from "../projectTypes";
import { appendChangelog } from "../projectState";
import { ensureBoxPanelIds, createStableId } from "../../core/box/panelIds";
import { getSelectedOrFirstWorkspaceBox } from "../projectHelpers";
import {
  clampDivisorPosition,
  clampSeparadorPosition,
} from "../../core/divSep/dimensions";
import {
  applyDivisorLinkUpdate,
  applySeparadorAncoraUpdate,
  autoLinkDivisorsToSeparador,
  buildAutoDivisorItem,
  buildAutoSeparadorItem,
  refreshSeparadorWidthsAfterDivChange,
} from "../../core/divSep/autoLink";
import type { ProjectActionsExecutionContext } from "./projectActionsDeps";

export type DivSepActions = Pick<
  ProjectActions,
  | "addSeparador"
  | "addDivisor"
  | "removeSeparador"
  | "removeDivisor"
  | "updateSeparador"
  | "updateDivisor"
>;

export function useDivSepActions(ctx: ProjectActionsExecutionContext): DivSepActions {
  const { updateProject, recomputeState: recompute } = ctx;

  return useMemo(
    () => ({
      addSeparador: () => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const newItem = buildAutoSeparadorItem(selected, createStableId());
            const separadores = [...(selected.separadores ?? []), newItem];
            const divisores = autoLinkDivisorsToSeparador(
              selected.divisores ?? [],
              newItem.id
            );
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? {
                    ...box,
                    separadores,
                    divisores,
                    panelIds: ensureBoxPanelIds(box.panelIds, {
                      prateleiras: box.prateleiras,
                      portaTipo: box.portaTipo,
                      gavetas: box.gavetas,
                      divisoresCount: divisores.length,
                      separadoresCount: separadores.length,
                    }),
                  }
                : box
            );
            return recompute(
              prev,
              {
                workspaceBoxes,
                changelog: appendChangelog(prev.changelog, {
                  timestamp: new Date(),
                  type: "box",
                  message: "Separador horizontal adicionado",
                }),
              },
              true
            );
          },
          true
        );
      },

      addDivisor: () => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const newItem = buildAutoDivisorItem(selected, createStableId());
            const divisores = [...(selected.divisores ?? []), newItem];
            const separadores = refreshSeparadorWidthsAfterDivChange(
              { ...selected, divisores },
              selected.separadores ?? []
            );
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? {
                    ...box,
                    divisores,
                    separadores,
                    panelIds: ensureBoxPanelIds(box.panelIds, {
                      prateleiras: box.prateleiras,
                      portaTipo: box.portaTipo,
                      gavetas: box.gavetas,
                      divisoresCount: divisores.length,
                      separadoresCount: separadores.length,
                    }),
                  }
                : box
            );
            return recompute(
              prev,
              {
                workspaceBoxes,
                changelog: appendChangelog(prev.changelog, {
                  timestamp: new Date(),
                  type: "box",
                  message: "Divisório vertical adicionado",
                }),
              },
              true
            );
          },
          true
        );
      },

      removeSeparador: (id) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const separadores = (selected.separadores ?? []).filter((s) => s.id !== id);
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? {
                    ...box,
                    separadores,
                    divisores: (box.divisores ?? []).map((div) =>
                      div.linkedSeparadorId === id
                        ? {
                            ...div,
                            linkedSeparadorId: undefined,
                            posicaoRelativaAoSep: undefined,
                          }
                        : div
                    ),
                    panelIds: ensureBoxPanelIds(box.panelIds, {
                      prateleiras: box.prateleiras,
                      portaTipo: box.portaTipo,
                      gavetas: box.gavetas,
                      divisoresCount: box.divisores?.length ?? 0,
                      separadoresCount: separadores.length,
                    }),
                  }
                : box
            );
            return recompute(prev, { workspaceBoxes }, true);
          },
          true
        );
      },

      removeDivisor: (id) => {
        updateProject(
          (prev) => {
            const selected = getSelectedOrFirstWorkspaceBox(prev);
            if (!selected) return prev;
            const divisores = (selected.divisores ?? []).filter((d) => d.id !== id);
            const boxAfter = { ...selected, divisores };
            const separadores = refreshSeparadorWidthsAfterDivChange(
              boxAfter,
              selected.separadores ?? []
            );
            const workspaceBoxes = prev.workspaceBoxes.map((box) =>
              box.id === selected.id
                ? {
                    ...box,
                    divisores,
                    separadores,
                    panelIds: ensureBoxPanelIds(box.panelIds, {
                      prateleiras: box.prateleiras,
                      portaTipo: box.portaTipo,
                      gavetas: box.gavetas,
                      divisoresCount: divisores.length,
                      separadoresCount: separadores.length,
                    }),
                  }
                : box
            );
            return recompute(prev, { workspaceBoxes }, true);
          },
          true
        );
      },

      updateSeparador: (id, partial) => {
        updateProject(
          (prev) => {
            const owner = prev.workspaceBoxes.find((box) =>
              (box.separadores ?? []).some((item) => item.id === id)
            );
            if (!owner) return prev;
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== owner.id) return box;
              const separadores = (box.separadores ?? []).map((item) => {
                if (item.id !== id) return item;
                const merged = applySeparadorAncoraUpdate(item, partial);
                if (partial.positionMm != null) {
                  merged.positionMm = clampSeparadorPosition(box, merged, partial.positionMm);
                }
                return merged;
              });
              return { ...box, separadores };
            });
            return recompute(prev, { workspaceBoxes }, true);
          },
          true
        );
      },

      updateDivisor: (id, partial) => {
        updateProject(
          (prev) => {
            const owner = prev.workspaceBoxes.find((box) =>
              (box.divisores ?? []).some((item) => item.id === id)
            );
            if (!owner) return prev;
            const workspaceBoxes = prev.workspaceBoxes.map((box) => {
              if (box.id !== owner.id) return box;
              const divisores = (box.divisores ?? []).map((item) => {
                if (item.id !== id) return item;
                const merged = applyDivisorLinkUpdate(item, partial);
                if (partial.positionMm != null) {
                  merged.positionMm = clampDivisorPosition(box, merged, partial.positionMm);
                }
                return merged;
              });
              const nextBox = { ...box, divisores };
              const separadores =
                partial.positionMm != null || partial.referenceEdge != null
                  ? refreshSeparadorWidthsAfterDivChange(nextBox, box.separadores ?? [])
                  : box.separadores ?? [];
              return { ...box, divisores, separadores };
            });
            return recompute(prev, { workspaceBoxes }, true);
          },
          true
        );
      },
    }),
    [updateProject, recompute]
  );
}
