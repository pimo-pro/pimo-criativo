import { safeGetItem, safeParseJson, safeSetItem } from "../../utils/storage";

export type TemplateItem = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string;
  dados: Record<string, unknown>;
};

const STORAGE_KEY = "pimo_admin_templates";

export const listaInicialDeTemplates: TemplateItem[] = [];

export const getTemplate = (nome: string) => {
  const stored = safeGetItem(STORAGE_KEY);
  const parsed = safeParseJson<TemplateItem[]>(stored);
  if (Array.isArray(parsed)) {
    return parsed.find((item) => item.nome === nome);
  }
  return listaInicialDeTemplates.find((item) => item.nome === nome);
};

export const salvarTemplate = (template: TemplateItem) => {
  const stored = safeGetItem(STORAGE_KEY);
  let data = listaInicialDeTemplates;
  const parsed = safeParseJson<TemplateItem[]>(stored);
  if (Array.isArray(parsed)) {
    data = parsed;
  }
  const next = [...data, template];
  safeSetItem(STORAGE_KEY, JSON.stringify(next));
  return next;
};
