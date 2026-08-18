export type MouseMenuTargetType =
  | "empty"
  | "box"
  | "door"
  | "drawer"
  | "piece"
  | "remate"
  | "divSep"
  | "room";

export type MouseMenuTarget = {
  type: MouseMenuTargetType;
  boxId?: string;
  panelId?: string;
  panelType?: string;
  doorLayerId?: string;
  drawerLayerId?: string;
  remateId?: string;
  divSepKind?: "div" | "sep";
  divSepItemId?: string;
  wallId?: number;
  roomElementId?: string;
};

export type MouseMenuCategoryId =
  | "multiSelection"
  | "box"
  | "porta"
  | "peca"
  | "remate"
  | "sala"
  | "materiais"
  | "cutlist"
  | "ferramentas"
  | "smartAlignSnap"
  | "alignment"
  | "intelligentDesigner"
  | "designerStyles";

export type MouseMenuActionId =
  | "box.lockToggle"
  | "box.rename"
  | "box.duplicate"
  | "box.delete"
  | "box.alignFront"
  | "box.alignBottom"
  | "porta.material"
  | "gaveta.material"
  | "peca.material"
  | "remate.remove"
  | "remate.material"
  | "remate.snapFrente"
  | "remate.snapFundo"
  | "remate.snapCima"
  | "sala.roomSnappingToggle"
  | "materiais.mousePreset"
  | "cutlist.open"
  | "ferramentas.snappingToggle"
  | "ferramentas.snapModeToggle"
  | "ferramentas.autoAlignmentToggle"
  | "ferramentas.autoSpacingToggle"
  | "ferramentas.wallOffset"
  | "ferramentas.fillWall"
  | "ferramentas.extendAlongWall"
  | "ferramentas.distributeBoxes"
  | "ferramentas.autoStackShelves"
  | "smartAlignSnap.toggle"
  | "smartAlignSnap.front"
  | "smartAlignSnap.back"
  | "smartAlignSnap.top"
  | "smartAlignSnap.bottom"
  | "smartAlignSnap.right"
  | "smartAlignSnap.left"
  | "smartAlignSnap.auto"
  | "smartAlignSnap.flushLeft"
  | "smartAlignSnap.flushRight"
  | "smartAlignSnap.flushBack"
  | "smartAlignSnap.flushFront"
  | "smartAlignSnap.continueLine"
  | "smartAlignSnap.alignDoor"
  | "smartAlignSnap.alignDrawer"
  | "smartAlignSnap.repeatLast"
  | "smartAlignSnap.inverse"
  | "smartLayout.autoWallFill"
  | "smartLayout.autoRoomFill"
  | "smartLayout.autoDistribute"
  | "smartLayout.autoStackShelves"
  | "smartLayout.applyPredictive"
  | "smartLayout.rejectPredictive"
  | "alignment.right"
  | "alignment.left"
  | "alignment.front"
  | "alignment.back"
  | "alignment.top"
  | "alignment.bottom"
  | "alignment.ctrlClickHint"
  | "intelligentDesigner.generateABC"
  | "intelligentDesigner.generateVariations"
  | "intelligentDesigner.applyA"
  | "intelligentDesigner.applyB"
  | "intelligentDesigner.applyC"
  | "intelligentDesigner.refine"
  | "intelligentDesigner.learnPreferences"
  | "designerStyles.modern"
  | "designerStyles.nordic"
  | "designerStyles.industrial"
  | "designerStyles.minimalist"
  | "designerStyles.classic"
  | "designerStyles.scandinavian"
  | "designerStyles.japandi"
  | "designerStyles.luxury"
  | "multi.copy"
  | "multi.delete"
  | "multi.rotate"
  | "multi.move"
  | "multi.showMcDimensions"
  | "multi.changeMaterial"
  | "multi.changeDimensions"
  | "multi.changeDimensionsAdditive"
  | "multi.changeDimensionsRatio"
  | "multi.createGroup"
  | "multi.ungroup"
  | "multi.addAnchor";

export type MouseMenuAction = {
  id: MouseMenuActionId;
  label: string;
  danger?: boolean;
};

export type MouseMenuCategory = {
  id: MouseMenuCategoryId;
  label: string;
  actions: MouseMenuAction[];
};

export type MouseMenuEngineInput = {
  target: MouseMenuTarget | null;
  hasSelectedBox: boolean;
  hasRoom: boolean;
  hasRemates: boolean;
  hasSmartAlignTarget: boolean;
  multiSelectionCount: number;
  activeGroupId?: string | null;
  canAlign: boolean;
};

function isGeneralTarget(target: MouseMenuTarget | null): boolean {
  return !target || target.type === "empty";
}

export function buildMouseMenu(input: MouseMenuEngineInput): MouseMenuCategory[] {
  const target = input.target ?? { type: "empty" as const };
  const categories: MouseMenuCategory[] = [];

  if (input.multiSelectionCount >= 2) {
    categories.push({
      id: "multiSelection",
      label: `Seleção (${input.multiSelectionCount})`,
      actions: [
        { id: "multi.createGroup", label: "Criar Grupo" },
        ...(input.activeGroupId ? [{ id: "multi.ungroup" as const, label: "Desagrupar" }] : []),
        { id: "multi.copy", label: "Copiar" },
        { id: "multi.delete", label: "Apagar", danger: true },
        { id: "multi.rotate", label: "Rodar" },
        { id: "multi.move", label: "Mover" },
        { id: "multi.showMcDimensions", label: "Mostrar Medidas MC" },
        { id: "multi.changeMaterial", label: "Alterar Material" },
        { id: "multi.changeDimensions", label: "Alterar Medidas" },
        { id: "multi.addAnchor", label: "Adicionar Âncora" },
      ],
    });
  }

  if (target.type === "box") {
    categories.push({
      id: "box",
      label: "Box",
      actions: [
        { id: "box.lockToggle", label: "Bloquear / desbloquear" },
        { id: "box.rename", label: "Renomear" },
        { id: "box.duplicate", label: "Duplicar" },
        { id: "box.alignFront", label: "Alinhar pela frente" },
        { id: "box.alignBottom", label: "Alinhar baixo" },
        { id: "box.delete", label: "Excluir", danger: true },
      ],
    });
  }

  if (target.type === "door") {
    categories.push({
      id: "porta",
      label: "Porta",
      actions: [{ id: "porta.material", label: "Alterar material" }],
    });
  }

  if (target.type === "drawer") {
    categories.push({
      id: "peca",
      label: "Peça",
      actions: [{ id: "gaveta.material", label: "Alterar material da frente" }],
    });
  }

  if (target.type === "piece") {
    categories.push({
      id: "peca",
      label: "Peça",
      actions: [{ id: "peca.material", label: "Alterar material" }],
    });
  }

  if (target.type === "remate") {
    categories.push({
      id: "remate",
      label: "Remate",
      actions: [
        { id: "remate.material", label: "Alterar material" },
        { id: "remate.snapFrente", label: "Alinhar à Frente" },
        { id: "remate.snapFundo", label: "Alinhar por Baixo" },
        { id: "remate.snapCima", label: "Alinhar por Cima" },
        { id: "remate.remove", label: "Remover remate", danger: true },
      ],
    });
  } else if (!isGeneralTarget(target) && input.hasRemates) {
    categories.push({
      id: "remate",
      label: "Remate",
      actions: [
        { id: "remate.material", label: "Alterar material" },
        { id: "remate.remove", label: "Remover remate", danger: true },
      ],
    });
  }

  if (target.type === "room" && input.hasRoom) {
    categories.push({
      id: "sala",
      label: "Sala",
      actions: [{ id: "sala.roomSnappingToggle", label: "Room snapping" }],
    });
  }

  if (!isGeneralTarget(target)) {
    categories.push({
      id: "materiais",
      label: "Materiais",
      actions: [{ id: "materiais.mousePreset", label: "Modo do mouse" }],
    });
  }

  if (input.canAlign) {
    categories.push({
      id: "alignment",
      label: "Alinhamento",
      actions: [
        { id: "alignment.right", label: "Alinhar à Direita" },
        { id: "alignment.left", label: "Alinhar à Esquerda" },
        { id: "alignment.front", label: "Alinhar à Frente" },
        { id: "alignment.back", label: "Alinhar Atrás" },
        { id: "alignment.top", label: "Alinhar Acima" },
        { id: "alignment.bottom", label: "Alinhar Abaixo" },
      ],
    });
  } else if (input.hasSelectedBox) {
    categories.push({
      id: "alignment",
      label: "Alinhamento",
      actions: [
        { id: "alignment.ctrlClickHint", label: "Ctrl+Click para selecionar múltiplas caixas" },
      ],
    });
  }

  if (input.hasSmartAlignTarget) {
    categories.push({
      id: "smartAlignSnap",
      label: "Alinhamento e Encaixe Inteligente (Smart Align & Snap)",
      actions: [
        { id: "smartAlignSnap.toggle", label: "Ativar Smart Align & Snap" },
        { id: "smartAlignSnap.front", label: "Alinhar pela Frente (Front Align)" },
        { id: "smartAlignSnap.back", label: "Alinhar por Trás (Back Align)" },
        { id: "smartAlignSnap.top", label: "Alinhar por Cima (Top Align)" },
        { id: "smartAlignSnap.bottom", label: "Alinhar por Baixo (Bottom Align)" },
        { id: "smartAlignSnap.right", label: "Alinhar pela Direita (Right Align)" },
        { id: "smartAlignSnap.left", label: "Alinhar pela Esquerda (Left Align)" },
        { id: "smartAlignSnap.auto", label: "Auto Balance (automático)" },
        { id: "smartAlignSnap.flushFront", label: "Flush Frontal" },
        { id: "smartAlignSnap.flushBack", label: "Flush Traseiro" },
        { id: "smartAlignSnap.flushLeft", label: "Flush Lateral (Esquerda)" },
        { id: "smartAlignSnap.flushRight", label: "Flush Lateral (Direita)" },
        { id: "smartAlignSnap.continueLine", label: "Continuar Linha (Remate ↔ Rodapé)" },
        { id: "smartAlignSnap.alignDoor", label: "Alinhar com Porta" },
        { id: "smartAlignSnap.alignDrawer", label: "Alinhar com Gaveta" },
        { id: "smartAlignSnap.repeatLast", label: "Repetir último alinhamento" },
        { id: "smartAlignSnap.inverse", label: "Inverter alinhamento" },
        { id: "smartLayout.autoWallFill", label: "Preencher Parede (Auto-Wall-Fill)" },
        { id: "smartLayout.autoRoomFill", label: "Preencher Sala (Auto-Room-Fill)" },
        { id: "smartLayout.autoDistribute", label: "Distribuição Inteligente" },
        { id: "smartLayout.autoStackShelves", label: "Auto-Stack Shelves" },
        { id: "smartLayout.applyPredictive", label: "Aceitar layout sugerido" },
        { id: "smartLayout.rejectPredictive", label: "Rejeitar layout sugerido" },
      ],
    });
  }

  if (input.hasRoom && input.hasSmartAlignTarget) {
    categories.push({
      id: "designerStyles",
      label: "Estilos (Designer Inteligente)",
      actions: [
        { id: "designerStyles.modern", label: "Moderno" },
        { id: "designerStyles.nordic", label: "Nórdico" },
        { id: "designerStyles.industrial", label: "Industrial" },
        { id: "designerStyles.minimalist", label: "Minimalista" },
        { id: "designerStyles.classic", label: "Clássico" },
        { id: "designerStyles.scandinavian", label: "Escandinavo" },
        { id: "designerStyles.japandi", label: "Japandi" },
        { id: "designerStyles.luxury", label: "Luxo" },
      ],
    });
    categories.push({
      id: "intelligentDesigner",
      label: "Designer Inteligente (AI Layout Generator)",
      actions: [
        { id: "intelligentDesigner.generateABC", label: "Gerar Layouts (A/B/C)" },
        { id: "intelligentDesigner.generateVariations", label: "Gerar Variações" },
        { id: "intelligentDesigner.applyA", label: "Aplicar Design A" },
        { id: "intelligentDesigner.applyB", label: "Aplicar Design B" },
        { id: "intelligentDesigner.applyC", label: "Aplicar Design C" },
        { id: "intelligentDesigner.refine", label: "Refinar Layout" },
        { id: "intelligentDesigner.learnPreferences", label: "Aprender Preferências" },
      ],
    });
  }

  categories.push({
    id: "cutlist",
    label: "Cutlist",
    actions: [{ id: "cutlist.open", label: "Abrir / consultar cutlist" }],
  });

  categories.push({
    id: "ferramentas",
    label: "Ferramentas",
    actions: [
      { id: "ferramentas.snappingToggle", label: "Snapping" },
      { id: "ferramentas.snapModeToggle", label: "Modo snapping" },
      ...(input.hasRoom
        ? [
            { id: "ferramentas.autoAlignmentToggle" as const, label: "Auto-alignment" },
            { id: "ferramentas.autoSpacingToggle" as const, label: "Auto-spacing" },
            { id: "ferramentas.wallOffset" as const, label: "Wall offset" },
          ]
        : []),
      ...(input.hasSelectedBox && input.hasRoom
        ? [
            { id: "ferramentas.fillWall" as const, label: "Preencher parede" },
            { id: "ferramentas.extendAlongWall" as const, label: "Estender layout" },
          ]
        : []),
      ...(input.multiSelectionCount >= 2
        ? [{ id: "ferramentas.distributeBoxes" as const, label: "Distribuir caixas" }]
        : []),
      ...(input.hasSelectedBox
        ? [{ id: "ferramentas.autoStackShelves" as const, label: "Auto-stack prateleiras" }]
        : []),
    ],
  });

  return categories.filter((category) => category.actions.length > 0);
}
