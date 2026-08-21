/**
 * Drawer
 *
 * Representa uma gaveta completa com todas as suas peças:
 * - Frente flush com a face frontal do módulo (movível)
 * - Corpo interno recuado atrás da frente (movível junto com a frente)
 * - Laterais, fundo e traseira dentro do volume do corpo
 */

import type { DrawerCalculatedSpecs } from "./DrawerParametrics";
import {
  resolveDrawerBackCenterZMm,
  resolveDrawerBottomCenterYMm,
  resolveDrawerBottomCenterZFrontEntryMm,
} from "./drawerViewerLayout";
import type { DrawerHandlePosition, DrawerHandleType, DrawerMetalBoxType, DrawerSlideType } from "../settings/settingsSchema";

export interface DrawerPiece {
  width: number;
  height: number;
  depth: number;
  positionX: number;
  positionY: number;
  positionZ: number;
}

export interface Drawer {
  id: string;
  parentBoxId: string;
  
  // Tipo
  type: "normal" | "pro";
  sideMaterial: "wood" | "aluminum";
  handleType: DrawerHandleType;
  handlePosition: DrawerHandlePosition;
  handleOffset: number;
  slideType: DrawerSlideType;
  metalBoxType: DrawerMetalBoxType;
  softClose: boolean;
  
  // Especificações calculadas
  specs: DrawerCalculatedSpecs;
  
  // Peças individuais (posições locais relativas ao grupo da gaveta)
  pieces: {
    front: DrawerPiece;
    frontInt: DrawerPiece;
    body: {
      width: number;
      height: number;
      depth: number;
    };
    leftSide: DrawerPiece;
    rightSide: DrawerPiece;
    bottom: DrawerPiece;
    back: DrawerPiece;
  };
  
  // Estado de movimento
  motion: {
    isOpen: boolean;
    openProgress: number;      // 0 = fechada, 1 = aberta
    currentOffset: number;     // Deslocamento atual em mm
  };
  
  // Posição no box
  position: {
    x: number;
    y: number;
    z: number;
  };
  
  // Material
  materialId?: string;
}

/**
 * Cria uma gaveta a partir das especificacoes calculadas.
 */
export function createDrawer(
  id: string,
  parentBoxId: string,
  specs: DrawerCalculatedSpecs,
  position: { x: number; y: number; z: number },
  type: "normal" | "pro" = "normal"
): Drawer {
  // Dimensões das peças
  const extThickness = specs.frontExt.thickness;
  const intThickness = specs.metalBox.enabled ? specs.frontInt.thickness : 0;
  const combinedFrontThickness = extThickness + intThickness;
  const sideThickness = specs.leftSide.width;
  const bottomThickness = specs.bottom.thickness;
  const backThickness = specs.back.thickness;
  const bodyWidth = specs.body.width;
  const bodyHeight = specs.body.height;
  const bodyDepth = specs.body.depth;
  const bodyCenterOffsetY = specs.bodyCenterOffsetY;
  const woodSideDepth = specs.leftSide.depth;
  const sideCenterZ =
    woodSideDepth > 0 ? specs.positioning.sideOffsetZ : specs.positioning.bodyOffsetZ;
  // Clássico + GPS: bordo dianteiro do fundo = face traseira da frente + 10 mm.
  const bottomCenterZ = resolveDrawerBottomCenterZFrontEntryMm(
    combinedFrontThickness,
    specs.bottom.height
  );

  return {
    id,
    parentBoxId,
    type,
    sideMaterial: type === "pro" ? "aluminum" : "wood",
    handleType: specs.handle.type,
    handlePosition: specs.handle.position,
    handleOffset: specs.handle.offsetMm,
    slideType: specs.slide.type,
    metalBoxType: specs.metalBox.type,
    softClose: specs.slide.softClose,
    specs,
    pieces: {
      front: {
        width: specs.frontExt.width,
        height: specs.frontExt.height,
        depth: extThickness,
        positionX: 0,
        positionY: 0,
        positionZ: specs.positioning.frontOffsetZ,
      },
      frontInt: {
        width: specs.frontInt.width,
        height: specs.frontInt.height,
        depth: intThickness,
        positionX: 0,
        positionY: 0,
        positionZ:
          specs.positioning.frontOffsetZ - extThickness / 2 - intThickness / 2,
      },
      body: {
        width: bodyWidth,
        height: bodyHeight,
        depth: bodyDepth,
      },
      
      // ===== LATERAL ESQUERDA =====
      // Encostada na borda esquerda do corpo.
      leftSide: {
        width: specs.leftSide.width,
        height: specs.leftSide.height,
        depth: specs.leftSide.depth,
        positionX: -bodyWidth / 2 + sideThickness / 2,
        positionY: bodyCenterOffsetY,
        positionZ: sideCenterZ,
      },
      
      // ===== LATERAL DIREITA =====
      // Encostada na borda direita do corpo.
      rightSide: {
        width: specs.rightSide.width,
        height: specs.rightSide.height,
        depth: specs.rightSide.depth,
        positionX: bodyWidth / 2 - sideThickness / 2,
        positionY: bodyCenterOffsetY,
        positionZ: sideCenterZ,
      },
      
      // ===== FUNDO =====
      // Entrada frontal 10 mm (clássico e GPS) — sem âncora traseira flush.
      bottom: {
        width: specs.bottom.width,
        height: bottomThickness,
        depth: specs.bottom.height,
        positionX: 0,
        positionY: resolveDrawerBottomCenterYMm(bodyHeight, bottomThickness, bodyCenterOffsetY),
        positionZ: bottomCenterZ,
      },
      
  // ===== TRASEIRA =====
  // Costa = laterais × percentual Admin; topo alinhado com laterais.
  back: {
        width: specs.back.width,
        height: specs.back.height,
        depth: backThickness,
        positionX: 0,
        positionY:
          bodyCenterOffsetY + (bodyHeight - specs.back.height) / 2,
        positionZ: resolveDrawerBackCenterZMm(
          combinedFrontThickness,
          woodSideDepth > 0 ? woodSideDepth : bodyDepth,
          backThickness
        ),
      },
    },
    motion: {
      isOpen: false,
      openProgress: 0,
      currentOffset: 0,
    },
    position,
  };
}

/**
 * Atualiza o estado de abertura da gaveta
 */
export function updateDrawerMotion(
  drawer: Drawer,
  isOpen: boolean,
  progress: number
): Drawer {
  const maxOffset = drawer.specs.positioning.pullDistance;
  const currentOffset = maxOffset * progress;

  return {
    ...drawer,
    motion: {
      isOpen,
      openProgress: progress,
      currentOffset,
    },
  };
}

/**
 * Retorna a posição absoluta da frente (considerando movimento)
 */
export function getFrontAbsolutePosition(drawer: Drawer): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: drawer.position.x + drawer.pieces.front.positionX,
    y: drawer.position.y + drawer.pieces.front.positionY,
    z: drawer.position.z + drawer.pieces.front.positionZ + drawer.motion.currentOffset,
  };
}

/**
 * Retorna a posição absoluta do corpo (considerando movimento)
 */
export function getBodyAbsolutePosition(drawer: Drawer): {
  x: number;
  y: number;
  z: number;
} {
  return {
    x: drawer.position.x,
    y: drawer.position.y,
    z: drawer.position.z + drawer.motion.currentOffset,
  };
}
