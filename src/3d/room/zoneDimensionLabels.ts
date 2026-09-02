/**
 * pimo-room v4 — cotas de área / perímetro das zonas (sprites billboard).
 * Sem CSS2DRenderer; CanvasTexture + Sprite (padrão já usado no viewer).
 */
import * as THREE from "three";
import type { ProjectRoomZone } from "../viewer-engine/room/roomEngineTypes";
import { computeZoneMetrics } from "./roomZones";

function makeLabelTexture(lines: string[]): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const fontSize = 22;
  const padX = 14;
  const padY = 10;
  const lineGap = 4;
  if (!ctx) {
    canvas.width = 8;
    canvas.height = 8;
    return new THREE.CanvasTexture(canvas);
  }
  const font = `600 ${fontSize}px system-ui, "Segoe UI", sans-serif`;
  ctx.font = font;
  const maxW = Math.max(...lines.map((l) => ctx.measureText(l).width), 1);
  canvas.width = Math.ceil(maxW + padX * 2);
  canvas.height = Math.ceil(lines.length * fontSize + (lines.length - 1) * lineGap + padY * 2);

  ctx.font = font;
  ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
  const r = 6;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") ctx.roundRect(0, 0, canvas.width, canvas.height, r);
  else ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.fill();
  ctx.strokeStyle = "rgba(148, 163, 184, 0.5)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  ctx.textBaseline = "top";
  lines.forEach((line, i) => {
    ctx.fillText(line, padX, padY + i * (fontSize + lineGap));
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Cria sprite com área (m²) e perímetro (m) no centroide da zona. */
export function createZoneDimensionSprite(zone: ProjectRoomZone): THREE.Sprite {
  const metrics = computeZoneMetrics(zone);
  const lines = [
    zone.name,
    `${metrics.areaM2.toFixed(2)} m²`,
    `P ${metrics.perimeterM.toFixed(2)} m`,
  ];
  const texture = makeLabelTexture(lines);
  const aspect = texture.image.width / Math.max(1, texture.image.height);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  const heightM = 0.45;
  sprite.scale.set(heightM * aspect, heightM, 1);
  sprite.position.set(metrics.centroidMm.x / 1000, 0.35, metrics.centroidMm.z / 1000);
  sprite.name = `zone-dim:${zone.id}`;
  sprite.userData.isRoomZone = true;
  sprite.userData.isZoneDimension = true;
  sprite.userData.zoneId = zone.id;
  sprite.renderOrder = 20;
  return sprite;
}

export function formatZoneDimensionText(zone: ProjectRoomZone): string {
  const m = computeZoneMetrics(zone);
  return `${zone.name}: ${m.areaM2.toFixed(2)} m² · P ${m.perimeterM.toFixed(2)} m`;
}
