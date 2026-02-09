import type { CadModel } from "../../core/cad/cadModels";
import type { DesignTemplate } from "../../templates/types";
import { TEMPLATES } from "../../templates/templatesIndex";
import { CATALOG_ITEMS } from "../../catalog/catalogIndex";

export type ModeloTipo = "pronto" | "3d" | "cad";

export type UnifiedModelItem = {
  id: string;
  sourceId: string;
  tipo: ModeloTipo;
  nome: string;
  categoria: string;
  categoriaId: string;
  descricao?: string;
  thumbnailUrl?: string | null;
  dimensoes?: { largura_mm: number; altura_mm: number; profundidade_mm: number };
};

const MOVEIS_CATEGORIES = [
  { id: "todos", label: "Todos" },
  { id: "cozinha", label: "Cozinha" },
  { id: "quarto", label: "Quarto" },
  { id: "sala", label: "Sala" },
  { id: "escritorio", label: "Escritório" },
  { id: "banheiro", label: "Banheiro" },
  { id: "roupeiro", label: "Roupeiro" },
  { id: "infantil", label: "Infantil" },
  { id: "outros", label: "Outros" },
] as const;

export const getCategoriasMoveis = () => MOVEIS_CATEGORIES.slice();

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

const resolveCategoriaId = (categoria?: string | null): string => {
  const cat = normalize(categoria ?? "");
  if (!cat) return "outros";
  if (cat.includes("base")) return "cozinha";
  if (cat.includes("cozinha")) return "cozinha";
  if (cat.includes("roupeiro") || cat.includes("guarda-roupa") || cat.includes("guarda roupa")) return "roupeiro";
  if (cat.includes("banheiro") || cat.includes("wc")) return "banheiro";
  if (cat.includes("infantil") || cat.includes("quarto infantil") || cat.includes("quarto-infantil")) return "infantil";
  if (cat.includes("quarto")) return "quarto";
  if (cat.includes("sala") || cat.includes("living")) return "sala";
  if (cat.includes("escritorio") || cat.includes("office")) return "escritorio";
  return "outros";
};

const getTemplateDimensions = (template: DesignTemplate) => {
  if (!template.boxes?.length) return null;
  const xs = template.boxes.map((b) => [b.posicaoX_mm, b.posicaoX_mm + b.dimensoes.largura]);
  const ys = template.boxes.map((b) => {
    const y = b.posicaoY_mm ?? 0;
    return [y, y + b.dimensoes.altura];
  });
  const zs = template.boxes.map((b) => {
    const z = b.posicaoZ_mm ?? 0;
    return [z, z + b.dimensoes.profundidade];
  });
  const minX = Math.min(...xs.map((v) => v[0]));
  const maxX = Math.max(...xs.map((v) => v[1]));
  const minY = Math.min(...ys.map((v) => v[0]));
  const maxY = Math.max(...ys.map((v) => v[1]));
  const minZ = Math.min(...zs.map((v) => v[0]));
  const maxZ = Math.max(...zs.map((v) => v[1]));
  return {
    largura_mm: Math.max(0, Math.round(maxX - minX)),
    altura_mm: Math.max(0, Math.round(maxY - minY)),
    profundidade_mm: Math.max(0, Math.round(maxZ - minZ)),
  };
};

export const buildUnifiedMoveis = (cadModels: CadModel[] = []): UnifiedModelItem[] => {
  const templates = TEMPLATES.map((template) => {
    const categoriaId = resolveCategoriaId(template.categoria);
    const dims = getTemplateDimensions(template);
    return {
      id: `pronto:${template.id}`,
      sourceId: template.id,
      tipo: "pronto" as const,
      nome: template.nome,
      categoria: template.categoria,
      categoriaId,
      descricao: template.descricao,
      thumbnailUrl: template.thumbnail ?? null,
      dimensoes: dims ?? undefined,
    };
  });

  const catalogo3d = CATALOG_ITEMS.map((item) => ({
    id: `3d:${item.id}`,
    sourceId: item.id,
    tipo: "3d" as const,
    nome: item.nome,
    categoria: item.categoria,
    categoriaId: resolveCategoriaId(item.categoria),
    descricao: item.descricao,
    thumbnailUrl: item.thumbnailUrl ?? null,
    dimensoes: {
      largura_mm: item.dimensoesDefault.largura_mm,
      altura_mm: item.dimensoesDefault.altura_mm,
      profundidade_mm: item.dimensoesDefault.profundidade_mm,
    },
  }));

  const cad = (cadModels ?? []).map((model) => ({
    id: `cad:${model.id}`,
    sourceId: model.id,
    tipo: "cad" as const,
    nome: model.nome,
    categoria: model.categoria,
    categoriaId: resolveCategoriaId(model.categoria),
    descricao: model.descricao,
    thumbnailUrl: null,
    dimensoes: model.dimensions
      ? {
          largura_mm: model.dimensions.largura,
          altura_mm: model.dimensions.altura,
          profundidade_mm: model.dimensions.profundidade,
        }
      : undefined,
  }));

  return [...templates, ...catalogo3d, ...cad];
};
