/**
 * Contexto para a barra de informação inferior (BottomInfoToolbar).
 * P3.6 — Financeiro sem tabs legadas; secção única `unificado`.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type BottomInfoGroupId = "financeiro" | "industriais" | "operacoes";

/** IDs legados (sub-secções) — mantidos para compatibilidade de deep-links. */
export type BottomInfoLegacySectionId =
  | "resumo"
  | "totais"
  | "custos"
  | "pecasTotais"
  | "ferragensTotais"
  | "resumoIndustriais"
  | "operacoesIndustriais"
  | "consumoMateriais"
  | "chapasReal";

export type BottomInfoPanelId = BottomInfoGroupId | BottomInfoLegacySectionId | null;

/** P3.7 — Painel Unificado | Financeiro peças | Editar. */
export type FinanceiroSectionId = "unificado" | "pecas" | "editar";
export type IndustriaisSectionId =
  | "pecasTotais"
  | "ferragensTotais"
  | "consumoMateriais"
  | "chapasReal"
  | "resumoIndustriais"
  | "enviarFabrica";
export type OperacoesSectionId =
  | "todas"
  | "NESTING"
  | "CNC"
  | "DRILL"
  | "ORLAR"
  | "MONTAGEM"
  | "EMBALAGEM";

export type BottomInfoSectionId = FinanceiroSectionId | IndustriaisSectionId | OperacoesSectionId;

const DEFAULT_SECTION: Record<BottomInfoGroupId, BottomInfoSectionId> = {
  financeiro: "unificado",
  industriais: "pecasTotais",
  operacoes: "todas",
};

const LEGACY_TO_GROUP: Record<
  BottomInfoLegacySectionId,
  { group: BottomInfoGroupId; section: BottomInfoSectionId }
> = {
  // P3.6 — tabs financeiras antigas → Painel Unificado
  resumo: { group: "financeiro", section: "unificado" },
  totais: { group: "financeiro", section: "unificado" },
  custos: { group: "financeiro", section: "unificado" },
  pecasTotais: { group: "industriais", section: "pecasTotais" },
  ferragensTotais: { group: "industriais", section: "ferragensTotais" },
  consumoMateriais: { group: "industriais", section: "consumoMateriais" },
  chapasReal: { group: "industriais", section: "chapasReal" },
  resumoIndustriais: { group: "industriais", section: "resumoIndustriais" },
  operacoesIndustriais: { group: "operacoes", section: "todas" },
};

function resolveOpenTarget(id: Exclude<BottomInfoPanelId, null>): {
  group: BottomInfoGroupId;
  section: BottomInfoSectionId;
} {
  if (id === "financeiro" || id === "industriais" || id === "operacoes") {
    return { group: id, section: DEFAULT_SECTION[id] };
  }
  return LEGACY_TO_GROUP[id];
}

type BottomInfoContextValue = {
  /** Grupo aberto (null = fechado). */
  openPanel: BottomInfoGroupId | null;
  activeSection: BottomInfoSectionId;
  setOpenPanel: (_id: BottomInfoPanelId) => void;
  setActiveSection: (_section: BottomInfoSectionId) => void;
  togglePanel: (_id: Exclude<BottomInfoPanelId, null>) => void;
  openGroupSection: (_group: BottomInfoGroupId, _section?: BottomInfoSectionId) => void;
};

const BottomInfoContext = createContext<BottomInfoContextValue | null>(null);

function normalizeFinanceiroSection(section: BottomInfoSectionId | string): BottomInfoSectionId {
  // Compat: estados em memória / localStorage antigos (resumo/totais/custos)
  if (section === "resumo" || section === "totais" || section === "custos") {
    return "unificado";
  }
  return section as BottomInfoSectionId;
}

export function BottomInfoProvider({ children }: { children: React.ReactNode }) {
  const [openPanel, setOpenPanelState] = useState<BottomInfoGroupId | null>(null);
  const [activeSection, setActiveSectionState] = useState<BottomInfoSectionId>("unificado");

  const setActiveSection = useCallback((section: BottomInfoSectionId) => {
    setActiveSectionState(normalizeFinanceiroSection(section));
  }, []);

  const openGroupSection = useCallback(
    (group: BottomInfoGroupId, section?: BottomInfoSectionId) => {
      setOpenPanelState(group);
      setActiveSectionState(normalizeFinanceiroSection(section ?? DEFAULT_SECTION[group]));
    },
    []
  );

  const setOpenPanel = useCallback((id: BottomInfoPanelId) => {
    if (id === null) {
      setOpenPanelState(null);
      return;
    }
    const { group, section } = resolveOpenTarget(id);
    setOpenPanelState(group);
    setActiveSectionState(normalizeFinanceiroSection(section));
  }, []);

  const togglePanel = useCallback((id: Exclude<BottomInfoPanelId, null>) => {
    const { group, section } = resolveOpenTarget(id);
    setOpenPanelState((prev) => {
      if (prev === group) return null;
      setActiveSectionState(normalizeFinanceiroSection(section));
      return group;
    });
  }, []);

  const value = useMemo<BottomInfoContextValue>(
    () => ({
      openPanel,
      activeSection,
      setOpenPanel,
      setActiveSection,
      togglePanel,
      openGroupSection,
    }),
    [openPanel, activeSection, setOpenPanel, setActiveSection, togglePanel, openGroupSection]
  );

  return <BottomInfoContext.Provider value={value}>{children}</BottomInfoContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useBottomInfo() {
  const ctx = useContext(BottomInfoContext);
  if (!ctx) throw new Error("useBottomInfo must be used within BottomInfoProvider");
  return ctx;
}
