# Freeze — ProjectRoomConfig (M0)

**Estado:** CONGELADO · **Fase:** M0 · **Data:** 2026-10-02  
**Fonte canónica:** `src/3d/viewer-engine/room/roomEngineTypes.ts`  
**Normalização:** `src/3d/viewer-engine/room/RoomEngine.ts` (`normalizeProjectRoom`, `createDefaultProjectRoom`)

## Regra

Qualquer motor de sala (legado `3d/room`, `pimo-room-v4`, futuro `pimo-room`) aterra neste contrato.  
O pipeline industrial só consome sala via `ProjectRoomConfig` → `autoRoomFill` → `workspaceBoxes`.

Alterações ao shape exigem revisão explícita e actualização dos testes em  
`tests/viewer/engines/projectRoomConfigFreeze.test.ts`.

## Unidades

- SSOT: **mm**
- Vista derivada: `wallStore` / `roomSnapshot` em **cm** (não fazem parte deste freeze de shape)
- Renderer: **metros** (Three.js)

## Chaves obrigatórias de `ProjectRoomConfig`

| Chave | Tipo | Notas |
|-------|------|-------|
| widthMm, depthMm, heightMm, wallThicknessMm | number | footprint |
| locked, visible, ceilingVisible | boolean | |
| floorMode | `"full" \| "room" \| "hybrid"` | |
| hiddenWalls | string[] | ids de parede |
| walls | ProjectRoomWall[] | ≥4 após normalize (senão default) |
| openings | ProjectRoomOpening[] | |
| utilities | ProjectRoomUtility[] | |
| zones? | ProjectRoomZone[] | opt-in |
| catalogItems? | ProjectRoomCatalogItemMeta[] | opt-in; não alimenta CNC |

## Defaults congelados (`ROOM_20_DEFAULTS`)

- widthMm/depthMm: 4000
- heightMm: 2600
- wallThicknessMm: 200
- floorMode: `"room"`
- ceilingVisible: true

## Isolamento industrial

- Este contrato **não** alimenta cutlist/CNC directamente.
- `RoomIndustrialAdapter` / equivalente deve manter `workspaceBoxes: []`.
- `core/cnc`, `drill`, `manufacturing`, `cutlayout` **proibidos** de importar módulos de sala.

## Compatibilidade Z-03.7

Load: se `project.room` ausente e existir `roomSnapshot.walls` → promover via  
`wallStoreToProjectRoom` + `normalizeProjectRoom`.
