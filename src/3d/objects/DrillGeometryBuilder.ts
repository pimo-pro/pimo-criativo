import * as THREE from "three";
import { CSG } from "three-csg-ts";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { SYSTEM_THICKNESS_MM } from "../../core/baseCabinets";
import type { TechnicalDrillHole } from "../../core/types";
import { devLogger } from "../../utils/devLogger";
import type { PanelType } from "./PanelFactory";

const THICKNESS_M = SYSTEM_THICKNESS_MM / 1000;
const DRILL_MIN_RADIUS_M = 0.0005;
const DRILL_MIN_DEPTH_M = 0.0008;
const DRILL_CSG_EPSILON_M = 0.00035;
const DRILL_BEVEL_MAX_M = 0.0018;
const DRILL_BEVEL_RATIO = 0.18;
const DRILL_SEGMENTS = 16;

function getPanelDimensionsFromGeometry(panel: THREE.Mesh, panelType: PanelType): {
  width: number;
  height: number;
  thickness: number;
} {
  panel.geometry.computeBoundingBox();
  const box = panel.geometry.boundingBox;
  if (!box) {
    return { width: 0, height: 0, thickness: THICKNESS_M };
  }
  const size = new THREE.Vector3();
  box.getSize(size);
  if (panelType === "left" || panelType === "right") {
    return { width: size.z, height: size.y, thickness: size.x };
  }
  if (panelType === "top" || panelType === "bottom") {
    return { width: size.x, height: size.z, thickness: size.y };
  }
  return { width: size.x, height: size.y, thickness: size.z };
}

export function getInwardAxisForHole(panelType: PanelType, _hole: TechnicalDrillHole): THREE.Vector3 {
  if (panelType === "top") return new THREE.Vector3(0, -1, 0);
  if (panelType === "bottom") return new THREE.Vector3(0, 1, 0);
  if (panelType === "left") return new THREE.Vector3(1, 0, 0);
  if (panelType === "right") return new THREE.Vector3(-1, 0, 0);
  if (panelType === "front") return new THREE.Vector3(0, 0, 1);
  return new THREE.Vector3(0, 0, 1);
}

/**
 * khaled-pro — laterais: furos sempre na face interior.
 * lateral_esquerda (panelType left) → interior = +X local, sem espelhamento do lado direito.
 */
export function isLateralInteriorDrill(panelType: PanelType, hole: TechnicalDrillHole): boolean {
  if (panelType === "left") return true;
  if (panelType === "right") return true;
  return String(hole.face) === "B" || String(hole.face) === "interior";
}

/** Posição X de entrada do furo na chapa lateral (face interior). */
export function lateralDrillEntryXM(panelType: PanelType, thicknessM: number): number {
  const entryOffset = thicknessM / 2;
  if (panelType === "left") return entryOffset;
  if (panelType === "right") return -entryOffset;
  return entryOffset;
}

/** Eixo de perfuração horizontal nas laterais: sempre da face interior para dentro da chapa. */
export function lateralInteriorDrillAxis(panelType: PanelType, entryXM: number): THREE.Vector3 {
  void panelType;
  return new THREE.Vector3(Math.sign(-entryXM) || 1, 0, 0);
}

export function getHole2DLocalPosition(
  panelType: PanelType,
  panelWidth: number,
  panelHeight: number,
  hole: TechnicalDrillHole
): { a: number; b: number } {
  const useBottomOriginY =
    panelType === "left" || panelType === "right"
      ? hole.tipo === "cavilha" || hole.tipo === "parafuso"
      : hole.tipo === "cavilha" && panelType === "front";
  const a = (hole.x / 1000) - panelWidth / 2;
  const b = useBottomOriginY
    ? (hole.y / 1000) - panelHeight / 2
    : panelHeight / 2 - (hole.y / 1000);
  if (panelType === "left" || panelType === "right") {
    return { a, b };
  }
  return { a, b };
}

export function buildDrillCutGeometries(panelType: PanelType, panel: THREE.Mesh, holes: TechnicalDrillHole[]): THREE.BufferGeometry[] {
  const { width, height, thickness } = getPanelDimensionsFromGeometry(panel, panelType);
  if (width <= 0 || height <= 0 || thickness <= 0) return [];
  const validDepthMax = Math.max(DRILL_MIN_DEPTH_M, thickness + DRILL_CSG_EPSILON_M * 2);
  const geometries: THREE.BufferGeometry[] = [];
  const quat = new THREE.Quaternion();

  if (import.meta.env.DEV) {
    devLogger.debug("[DRILL-DIAG] buildDrillCutGeometries", {
      panelType,
      holesCount: holes.length,
      panelDimensions: { width, height, thickness },
    });
  }

  for (let holeIndex = 0; holeIndex < holes.length; holeIndex++) {
    const hole = holes[holeIndex];
    const radius = Math.max(DRILL_MIN_RADIUS_M, hole.diametro / 2000);
    const profundidadeRealM = Math.max(DRILL_MIN_DEPTH_M, hole.profundidade / 1000);

    const isTopOrBottom = panelType === "top" || panelType === "bottom";
    const isFrontPanel = panelType === "front";
    const isNonThrough = hole.tipo === "cavilha" || hole.tipo === "parafuso";
    const isLeftOrRight = panelType === "left" || panelType === "right";
    const isShelfOrHinge =
      hole.tipo === "prateleira" ||
      hole.tipo === "dobradica" ||
      hole.tipo === "dobradica_fixacao" ||
      hole.tipo === "dobradica_parafuso_uniao";
    const isLeftOrRightShelfOrHinge = isLeftOrRight && isShelfOrHinge;

    const cylinderHeight =
      isTopOrBottom && isNonThrough && hole.face !== "esquerda" && hole.face !== "direita"
        ? Math.max(DRILL_MIN_DEPTH_M, Math.min(profundidadeRealM, thickness))
        : isTopOrBottom && isNonThrough && (hole.face === "esquerda" || hole.face === "direita")
          ? Math.max(DRILL_MIN_DEPTH_M, Math.min(profundidadeRealM, validDepthMax))
          : isFrontPanel && isNonThrough
          ? Math.max(DRILL_MIN_DEPTH_M, Math.min(profundidadeRealM, thickness))
          : isLeftOrRight && isNonThrough
            ? Math.max(DRILL_MIN_DEPTH_M, Math.min(profundidadeRealM, thickness))
            : isLeftOrRightShelfOrHinge
              ? Math.max(DRILL_MIN_DEPTH_M, Math.min(profundidadeRealM, thickness))
              : Math.max(DRILL_MIN_DEPTH_M, Math.min(validDepthMax, profundidadeRealM));

    const bevelDepth = Math.min(
      DRILL_BEVEL_MAX_M,
      Math.max(0.00045, Math.min(cylinderHeight * DRILL_BEVEL_RATIO, thickness * 0.35))
    );
    const bevelRadius = radius + Math.min(0.0009, Math.max(0.00025, radius * 0.32));
    const { a, b } = getHole2DLocalPosition(panelType, width, height, hole);
    const entryOffset = thickness / 2;
    const entry = new THREE.Vector3();
    let axisInward: THREE.Vector3;

    if (panelType === "top" || panelType === "bottom") {
      if (hole.face === "esquerda" || hole.face === "direita") {
        const fromLeft = hole.face === "esquerda";
        entry.set(fromLeft ? -width / 2 : width / 2, 0, b);
        axisInward = fromLeft ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(-1, 0, 0);
      } else if (hole.face === "fundo") {
        entry.set(a, -entryOffset, b);
        axisInward = new THREE.Vector3(0, 1, 0);
      } else if (hole.face === "cima") {
        entry.set(a, entryOffset, b);
        axisInward = new THREE.Vector3(0, -1, 0);
      } else {
        if (panelType === "top") {
          entry.set(a, -entryOffset, b);
          axisInward = new THREE.Vector3(0, 1, 0);
        } else {
          entry.set(a, entryOffset, b);
          axisInward = new THREE.Vector3(0, -1, 0);
        }
      }
    } else if (panelType === "front") {
      const drillFromFront = hole.face === "frente";
      if (drillFromFront) {
        entry.set(a, b, entryOffset);
        axisInward = new THREE.Vector3(0, 0, -1);
      } else {
        entry.set(a, b, -entryOffset);
        axisInward = new THREE.Vector3(0, 0, 1);
      }
    } else {
      if (panelType === "left" || panelType === "right") {
        const entryX = lateralDrillEntryXM(panelType, thickness);
        entry.set(entryX, b, a);
        axisInward = lateralInteriorDrillAxis(panelType, entryX);
      } else {
        axisInward = getInwardAxisForHole(panelType, hole).normalize();
        entry.set(a, b, axisInward.z < 0 ? entryOffset : -entryOffset);
      }
    }
    quat.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axisInward);

    if (import.meta.env.DEV) {
      const cylDir = new THREE.Vector3(0, 1, 0).applyQuaternion(quat.clone());
      devLogger.debug("[DRILL-DIAG] cylinderTransform", {
        panelType,
        holeIndex,
        entryPoint: entry.clone(),
        axisInward: axisInward.clone(),
        quaternion: quat.clone(),
        cylinderDirectionAfterRotation: cylDir,
      });
    }

    const holeCenter = entry.clone().add(axisInward.clone().multiplyScalar(cylinderHeight / 2));
    const cutterMain = new THREE.CylinderGeometry(radius, radius, cylinderHeight, DRILL_SEGMENTS, 1, false);
    cutterMain.applyQuaternion(quat);
    cutterMain.translate(holeCenter.x, holeCenter.y, holeCenter.z);
    geometries.push(cutterMain);

    const hasBevel = bevelDepth < cylinderHeight - 0.00015;
    const addBevel =
      hasBevel && !(isTopOrBottom && isNonThrough) && !isLeftOrRightShelfOrHinge;
    if (addBevel) {
      const bevelCenter = entry.clone().add(axisInward.clone().multiplyScalar(bevelDepth / 2));
      const bevel = new THREE.CylinderGeometry(bevelRadius, radius, bevelDepth, DRILL_SEGMENTS, 1, false);
      bevel.applyQuaternion(quat);
      bevel.translate(bevelCenter.x, bevelCenter.y, bevelCenter.z);
      geometries.push(bevel);
    }

    const cylindersPerHole = addBevel ? 2 : 1;
    if (import.meta.env.DEV) {
      const holeId = (hole as TechnicalDrillHole & { id?: unknown }).id ?? `hole-${holeIndex}`;
      const entryPoint = { x: entry.x, y: entry.y, z: entry.z };
      const axisInwardLog = { x: axisInward.x, y: axisInward.y, z: axisInward.z };
      devLogger.debug("[DRILL-DIAG] hole", {
        panelType,
        holeIndex,
        holeId,
        entryPoint,
        axisInward: axisInwardLog,
        cylindersPerHole,
        holeType: hole.tipo,
        face: hole.face,
      });
    }
  }

  if (import.meta.env.DEV) {
    devLogger.debug("[DRILL-DIAG] buildDrillCutGeometries result", {
      panelType,
      totalCylinders: geometries.length,
      expectedRange: `[${holes.length}, ${holes.length * 2}]`,
    });
  }

  return geometries;
}

/**
 * DIV vertical: nunca aceitar top/bottom no CSG (interpretaria a altura como espessura
 * e geraria cortes/artefactos verticais — “drill rays”).
 */
export function resolveDrillPanelTypeForMesh(panel: THREE.Mesh, panelType: PanelType): PanelType {
  const isDiv =
    panel.userData?.divSepKind === "div" ||
    (typeof panel.name === "string" && panel.name.startsWith("divsep-div-"));
  if (!isDiv) return panelType;
  if (panelType === "left" || panelType === "right") return panelType;
  const fromUser = panel.userData?.panelType as PanelType | undefined;
  if (fromUser === "left" || fromUser === "right") return fromUser;
  return "left";
}

export function applyDrillHolesToPanelGeometry(panel: THREE.Mesh, panelType: PanelType, holes: TechnicalDrillHole[] | undefined): void {
  if (!holes || holes.length === 0) return;

  const effectivePanelType = resolveDrillPanelTypeForMesh(panel, panelType);

  if (import.meta.env.DEV) {
    devLogger.debug("[DRILL-DIAG] applyDrillHolesToPanelGeometry ENTRADA", {
      panelType: effectivePanelType,
      panelTypeRequested: panelType,
      panelName: panel.name,
      holesReceived: holes.length,
      holeFaces: holes.map((h) => h.face),
      holeTypes: holes.map((h) => h.tipo),
    });
  }

  const cutGeometries = buildDrillCutGeometries(effectivePanelType, panel, holes);
  if (cutGeometries.length === 0) return;

  panel.geometry.computeBoundingBox();
  const bboxBefore = panel.geometry.boundingBox;
  if (import.meta.env.DEV && bboxBefore) {
    devLogger.debug("[DRILL-DIAG] panel bbox ANTES do CSG", {
      panelType: effectivePanelType,
      min: bboxBefore.min.toArray(),
      max: bboxBefore.max.toArray(),
      totalCylindersToSubtract: cutGeometries.length,
    });
  }

  const mergedCutters = mergeGeometries(cutGeometries, false);
  cutGeometries.forEach((geometry) => geometry.dispose());
  if (!mergedCutters) return;

  const sourceMesh = new THREE.Mesh(panel.geometry.clone(), panel.material as THREE.Material | THREE.Material[]);
  const cutterMesh = new THREE.Mesh(mergedCutters, new THREE.MeshStandardMaterial());
  sourceMesh.updateMatrix();
  cutterMesh.updateMatrix();

  const carved = CSG.subtract(sourceMesh, cutterMesh);
  mergedCutters.dispose();
  if (!carved?.geometry) return;

  carved.geometry.computeBoundingBox();
  const bboxAfter = carved.geometry.boundingBox;
  if (import.meta.env.DEV && bboxAfter) {
    devLogger.debug("[DRILL-DIAG] panel bbox DEPOIS do CSG", {
      panelType: effectivePanelType,
      min: bboxAfter.min.toArray(),
      max: bboxAfter.max.toArray(),
    });
  }

  carved.geometry.computeVertexNormals();
  if (!carved.geometry.attributes.uv2 && carved.geometry.attributes.uv) {
    carved.geometry.setAttribute("uv2", carved.geometry.attributes.uv.clone());
  }
  panel.geometry.dispose();
  panel.geometry = carved.geometry;
  panel.userData.hasCsgDrillHoles = true;
  panel.userData.panelType = effectivePanelType;
  panel.castShadow = true;
  panel.receiveShadow = true;

  if (import.meta.env.DEV) {
    devLogger.debug("[DRILL-DIAG] applyDrillHolesToPanelGeometry SAÍDA", {
      panelType: effectivePanelType,
      holesApplied: holes.length,
      meshUpdated: true,
    });
  }
}
