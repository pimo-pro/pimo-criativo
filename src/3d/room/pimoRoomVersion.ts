/**
 * pimo-room v4 — módulo interno de salas/divisões do pimo-criativo.
 *
 * Versão: 4.0.0
 * Viewer: THREE.WebGLRenderer (ViewerCore) — sem WebGPU no Workspace principal.
 * SSOT: ProjectState.room / ProjectRoomConfig (mm).
 * Pipeline industrial (CNC, cutlist, DrillGeometryBuilder, tampos): isolado — não depende deste módulo.
 *
 * Atribuição (MIT, só em código-fonte): lógica de nós/cutouts inspirada em
 * Pascal Group Inc. / Aedifex Inc.; adaptação nativa pimo (tokens, ícones SVG, three-csg-ts).
 */
export const PIMO_ROOM_CHANGELOG = [
  "4.0.0 — fundação schema/store, geometria CSG, integração ViewerCore, UI Salão, controlos avançados (snap/alinhamento/comprimento de parede).",
] as const;
