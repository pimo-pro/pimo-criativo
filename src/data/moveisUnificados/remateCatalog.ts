import type { RemateMountSlot, RemateProductType } from "../../core/remate/rematePieceTypes";
import { REMATE_PRODUCT_TYPE_LABELS } from "../../core/remate/rematePieceTypes";

export type RemateCatalogItem = {
  id: string;
  productType: RemateProductType;
  defaultMountSlot: RemateMountSlot;
  nome: string;
  descricao?: string;
};

export const REMATE_CATALOG_ITEMS: RemateCatalogItem[] = [
  {
    id: "remate-avista",
    productType: "AVISTA",
    defaultMountSlot: "FRENTE",
    nome: REMATE_PRODUCT_TYPE_LABELS.AVISTA,
  },
  {
    id: "remate-completo",
    productType: "COMPLETO",
    defaultMountSlot: "FRENTE",
    nome: REMATE_PRODUCT_TYPE_LABELS.COMPLETO,
  },
  {
    id: "remate-l",
    productType: "L",
    defaultMountSlot: "DIR",
    nome: REMATE_PRODUCT_TYPE_LABELS.L,
  },
  {
    id: "remate-rodape",
    productType: "RODAPE",
    defaultMountSlot: "FUNDO",
    nome: REMATE_PRODUCT_TYPE_LABELS.RODAPE,
  },
  {
    id: "remate-rodape-l",
    productType: "RODAPE_L",
    defaultMountSlot: "FUNDO",
    nome: REMATE_PRODUCT_TYPE_LABELS.RODAPE_L,
  },
  {
    id: "remate-tampo-cozinha",
    productType: "TAMPO_COZINHA",
    defaultMountSlot: "CIMA",
    nome: REMATE_PRODUCT_TYPE_LABELS.TAMPO_COZINHA,
    descricao: "MDB Laminado 30 · 630 mm · laminado de fábrica",
  },
];
