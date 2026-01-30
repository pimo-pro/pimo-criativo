import { safeGetItem, safeParseJson, safeSetItem } from "../../utils/storage";

export type CadModelDimensions = {
  largura: number;
  altura: number;
  profundidade: number;
};

export type CadModel = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  arquivo: string;
  /** Dimensões em mm (L×A×P). Opcional; pode vir do Admin ou bbox ao carregar GLB. */
  dimensions?: CadModelDimensions;
};

const STORAGE_KEY = "pimo_admin_cad_models";

export const listaInicialDeModelos: CadModel[] = [];

export const getModelo = (id: string) => {
  const stored = safeGetItem(STORAGE_KEY);
  const parsed = safeParseJson<CadModel[]>(stored);
  if (Array.isArray(parsed)) {
    return parsed.find((item) => item.id === id);
  }
  return listaInicialDeModelos.find((item) => item.id === id);
};

export const salvarModelo = (modelo: CadModel) => {
  const stored = safeGetItem(STORAGE_KEY);
  let data = listaInicialDeModelos;
  const parsed = safeParseJson<CadModel[]>(stored);
  if (Array.isArray(parsed)) {
    data = parsed;
  }
  const next = [...data, modelo];
  safeSetItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};
