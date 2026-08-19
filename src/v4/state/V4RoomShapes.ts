import type { V4RoomConfig } from "./V4RoomConfig";

export interface V4RoomWallDef {
  id: string;
  label: string;
  defaultLength: number; // cm
}

export interface V4RoomShape {
  id: string;
  name: string;
  walls: V4RoomWallDef[];
  svgPath: string; // <path d="..."> content for viewBox="0 0 40 40"
  buildConfig: (walls: Record<string, number>, height: number, base: V4RoomConfig) => V4RoomConfig;
}

// All wall lengths in cm; height in cm
// buildConfig maps cm → V4RoomConfig (width/depth/height in mm via × 10)

export const V4_ROOM_SHAPES: V4RoomShape[] = [
  {
    id: "rectangle",
    name: "Retângulo",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 400 },
      { id: "B", label: "Parede B", defaultLength: 300 },
    ],
    svgPath: "M4 8 H36 V32 H4 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
  {
    id: "square",
    name: "Quadrado",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 350 },
    ],
    svgPath: "M6 6 H34 V34 H6 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.A * 10, height: h * 10 }),
  },
  {
    id: "l-right",
    name: "L direita",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 400 },
      { id: "B", label: "Parede B", defaultLength: 300 },
      { id: "C", label: "Parede C", defaultLength: 200 },
      { id: "D", label: "Parede D", defaultLength: 200 },
    ],
    svgPath: "M4 36 V4 H36 V20 H20 V36 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
  {
    id: "l-left",
    name: "L esquerda",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 400 },
      { id: "B", label: "Parede B", defaultLength: 300 },
      { id: "C", label: "Parede C", defaultLength: 200 },
      { id: "D", label: "Parede D", defaultLength: 200 },
    ],
    svgPath: "M36 36 V4 H4 V20 H20 V36 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
  {
    id: "l-inv-right",
    name: "L inv. direita",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 400 },
      { id: "B", label: "Parede B", defaultLength: 300 },
      { id: "C", label: "Parede C", defaultLength: 200 },
      { id: "D", label: "Parede D", defaultLength: 200 },
    ],
    svgPath: "M4 4 H36 V36 H20 V20 H4 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
  {
    id: "l-inv-left",
    name: "L inv. esquerda",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 400 },
      { id: "B", label: "Parede B", defaultLength: 300 },
      { id: "C", label: "Parede C", defaultLength: 200 },
      { id: "D", label: "Parede D", defaultLength: 200 },
    ],
    svgPath: "M36 4 H4 V36 H20 V20 H36 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
  {
    id: "u-shape",
    name: "U shape",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 500 },
      { id: "B", label: "Parede B", defaultLength: 300 },
      { id: "C", label: "Parede C", defaultLength: 200 },
      { id: "D", label: "Parede D", defaultLength: 150 },
      { id: "E", label: "Parede E", defaultLength: 200 },
      { id: "F", label: "Parede F", defaultLength: 300 },
    ],
    svgPath: "M4 36 V4 H14 V22 H26 V4 H36 V36 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
  {
    id: "u-inv",
    name: "U invertido",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 500 },
      { id: "B", label: "Parede B", defaultLength: 300 },
      { id: "C", label: "Parede C", defaultLength: 200 },
      { id: "D", label: "Parede D", defaultLength: 150 },
      { id: "E", label: "Parede E", defaultLength: 200 },
      { id: "F", label: "Parede F", defaultLength: 300 },
    ],
    svgPath: "M4 4 H36 V36 H26 V18 H14 V36 H4 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
  {
    id: "t-shape",
    name: "T shape",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 500 },
      { id: "B", label: "Parede B", defaultLength: 200 },
      { id: "C", label: "Parede C", defaultLength: 150 },
      { id: "D", label: "Parede D", defaultLength: 300 },
      { id: "E", label: "Parede E", defaultLength: 150 },
      { id: "F", label: "Parede F", defaultLength: 200 },
    ],
    svgPath: "M4 4 H36 V16 H24 V36 H16 V16 H4 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: (w.B + w.D) * 10, height: h * 10 }),
  },
  {
    id: "cut-corner-right",
    name: "Recorte direito",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 400 },
      { id: "B", label: "Parede B", defaultLength: 300 },
      { id: "C", label: "Parede C", defaultLength: 150 },
      { id: "D", label: "Parede D", defaultLength: 150 },
    ],
    svgPath: "M4 4 H24 L36 16 V36 H4 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
  {
    id: "cut-corner-left",
    name: "Recorte esquerdo",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 400 },
      { id: "B", label: "Parede B", defaultLength: 300 },
      { id: "C", label: "Parede C", defaultLength: 150 },
      { id: "D", label: "Parede D", defaultLength: 150 },
    ],
    svgPath: "M16 4 H36 V36 H4 V16 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
  {
    id: "cut-corner-double",
    name: "Recorte duplo",
    walls: [
      { id: "A", label: "Parede A", defaultLength: 400 },
      { id: "B", label: "Parede B", defaultLength: 300 },
      { id: "C", label: "Parede C", defaultLength: 120 },
      { id: "D", label: "Parede D", defaultLength: 120 },
      { id: "E", label: "Parede E", defaultLength: 120 },
      { id: "F", label: "Parede F", defaultLength: 120 },
    ],
    svgPath: "M14 4 H26 L36 14 V36 H4 V14 Z",
    buildConfig: (w, h, base) => ({ ...base, width: w.A * 10, depth: w.B * 10, height: h * 10 }),
  },
];

export function getShapeById(id: string): V4RoomShape {
  return V4_ROOM_SHAPES.find((s) => s.id === id) ?? V4_ROOM_SHAPES[0];
}

export function defaultWallValues(shape: V4RoomShape): Record<string, number> {
  return Object.fromEntries(shape.walls.map((w) => [w.id, w.defaultLength]));
}
