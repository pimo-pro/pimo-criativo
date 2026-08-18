/**
 * Configuração centralizada da toolbar do Viewer.
 * Ícones, ações, tooltips e IDs para ViewerToolbar e UnifiedTopToolbar.
 *
 * Novos botões (ex.: Reset Camera): adicionar em VIEWER_TOOLBAR_ITEMS
 * respeitando a ordem definida para a toolbar.
 */

import type { IconName } from "@/components/icons";

export type ToolbarActionId =
  | "reset-camera"
  | "projeto"
  | "novo"
  | "desfazer"
  | "refazer"
  | "imagem"
  | "enviar";

export type Tool3DId = "select" | "move" | "rotate" | "scale";

export const VIEWER_TOOLBAR_ITEMS: Array<{
  id: ToolbarActionId;
  label: string;
  iconName: IconName;
  tooltip: string;
}> = [
  { id: "projeto", label: "PROJETO", iconName: "projects", tooltip: "Projetos salvos" },
  { id: "novo", label: "NOVO", iconName: "adminDocs", tooltip: "Limpar dados locais e iniciar sessão nova" },
  { id: "desfazer", label: "DESFAZER", iconName: "undo", tooltip: "Desfazer (Ctrl+Z)" },
  { id: "refazer", label: "REFAZER", iconName: "redo", tooltip: "Refazer (Ctrl+Shift+Z)" },
  { id: "imagem", label: "PHOTO", iconName: "photoMode", tooltip: "Photo Mode" },
  { id: "reset-camera", label: "RESET", iconName: "resetCamera", tooltip: "Reset Camera – Vista frontal centralizada" },
  { id: "enviar", label: "ENVIAR", iconName: "send", tooltip: "Enviar pacote" },
];

export const TOOLS_3D_ITEMS: Array<{
  id: Tool3DId;
  label: string;
  iconName: IconName;
  tooltip: string;
  eventKey: string;
}> = [
  { id: "select", label: "Selecionar", iconName: "select", tooltip: "Selecionar", eventKey: "tool:select" },
  { id: "move", label: "Mover", iconName: "move", tooltip: "Mover", eventKey: "tool:move" },
  { id: "rotate", label: "Rodar", iconName: "rotate", tooltip: "Rodar", eventKey: "tool:rotate" },
  { id: "scale", label: "Escalar", iconName: "scale", tooltip: "Escalar modelo (GLB / externos)", eventKey: "tool:scale" },
];
