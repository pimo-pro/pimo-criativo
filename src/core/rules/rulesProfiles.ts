/**
 * Perfis de Regras Dinâmicas.
 * Permite diferentes conjuntos de regras por fábrica, cliente, país, tipo de projeto, etc.
 */

import { defaultRulesConfig, type RulesConfig } from "./rulesConfig";

export interface RulesProfile {
  id: string;
  nome: string;
  descricao?: string;
  rules: RulesConfig;
}

export interface RulesProfilesConfig {
  perfis: RulesProfile[];
  perfilAtivoId: string;
}

const PROFILE_DEFAULT_ID = "padrao";
const PROFILE_PT_ID = "portugal";
const PROFILE_CLIENTE_A_ID = "cliente-a";
const PROFILE_CLIENTE_B_ID = "cliente-b";

/** Perfil padrão (base). */
function createDefaultProfile(): RulesProfile {
  return {
    id: PROFILE_DEFAULT_ID,
    nome: "Padrão",
    descricao: "Regras padrão da fábrica",
    rules: { ...JSON.parse(JSON.stringify(defaultRulesConfig)) },
  };
}

/** Perfil Portugal (exemplo com pequenas variações). */
function createPortugalProfile(): RulesProfile {
  const rules = JSON.parse(JSON.stringify(defaultRulesConfig)) as RulesConfig;
  return {
    id: PROFILE_PT_ID,
    nome: "Portugal",
    descricao: "Regras para mercado português",
    rules,
  };
}

/** Perfil Cliente A. */
function createClienteAProfile(): RulesProfile {
  const rules = JSON.parse(JSON.stringify(defaultRulesConfig)) as RulesConfig;
  return {
    id: PROFILE_CLIENTE_A_ID,
    nome: "Cliente A",
    descricao: "Regras específicas do Cliente A",
    rules,
  };
}

/** Perfil Cliente B. */
function createClienteBProfile(): RulesProfile {
  const rules = JSON.parse(JSON.stringify(defaultRulesConfig)) as RulesConfig;
  return {
    id: PROFILE_CLIENTE_B_ID,
    nome: "Cliente B",
    descricao: "Regras específicas do Cliente B",
    rules,
  };
}

/** Configuração padrão de perfis. */
export const defaultProfilesConfig: RulesProfilesConfig = {
  perfis: [
    createDefaultProfile(),
    createPortugalProfile(),
    createClienteAProfile(),
    createClienteBProfile(),
  ],
  perfilAtivoId: PROFILE_DEFAULT_ID,
};

/** ID do perfil que não pode ser removido. */
export const DEFAULT_PROFILE_ID = PROFILE_DEFAULT_ID;
