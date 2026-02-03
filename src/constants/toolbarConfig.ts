/**
 * Configuração centralizada da toolbar do Viewer.
 * Ícones, ações, tooltips e IDs para ViewerToolbar e Tools3DToolbar.
 */

export type ToolbarActionId =
  | "projeto"
  | "salvar"
  | "desfazer"
  | "refazer"
  | "2d"
  | "imagem"
  | "enviar";

export type Tool3DId = "select" | "move" | "rotate" | "scale" | "orbit" | "pan";

export const VIEWER_TOOLBAR_ITEMS: Array<{
  id: ToolbarActionId;
  label: string;
  icon: string;
  tooltip: string;
}> = [
  { id: "projeto", label: "PROJETO", icon: "P", tooltip: "Projetos salvos" },
  { id: "salvar", label: "SALVAR", icon: "S", tooltip: "Guardar snapshot" },
  { id: "desfazer", label: "DESFAZER", icon: "⟲", tooltip: "Desfazer" },
  { id: "refazer", label: "REFAZER", icon: "⟳", tooltip: "Refazer" },
  { id: "2d", label: "2D", icon: "2D", tooltip: "Vista 2D" },
  { id: "imagem", label: "PHOTO", icon: "📷", tooltip: "Photo Mode" },
  { id: "enviar", label: "ENVIAR", icon: "↗", tooltip: "Enviar pacote" },
];

export const TOOLS_3D_ITEMS: Array<{
  id: Tool3DId;
  label: string;
  icon: string;
  tooltip: string;
  eventKey: string;
}> = [
  { id: "select", label: "Selecionar", icon: "◆", tooltip: "Selecionar", eventKey: "tool:select" },
  { id: "move", label: "Mover", icon: "↔", tooltip: "Mover", eventKey: "tool:move" },
  { id: "rotate", label: "Rodar", icon: "↻", tooltip: "Rodar", eventKey: "tool:rotate" },
  { id: "scale", label: "Escalar", icon: "⊞", tooltip: "Escalar (futuro)", eventKey: "tool:scale" },
  { id: "orbit", label: "Orbit", icon: "◎", tooltip: "Orbit (futuro)", eventKey: "tool:orbit" },
  { id: "pan", label: "Pan", icon: "✥", tooltip: "Pan (futuro)", eventKey: "tool:pan" },
];
