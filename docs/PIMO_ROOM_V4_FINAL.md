# pimo-room v4 — Final Integration

**Versão:** 4.0 · **Fase:** FINAL · **Edição:** PIMO-ALFA RoomEngine Edition

| Constante | Valor |
|-----------|-------|
| `PIMO_ALFA_VERSION` | `4.0` |
| `ROOM_ENGINE_VERSION` | `4.0` |
| `ROOM_ENGINE_PHASE` | `FINAL` |
| Pacote | `src/pimo-room-v4/` |

**Release Notes:** [PIMO_ROOM_V4_RELEASE_NOTES.md](./PIMO_ROOM_V4_RELEASE_NOTES.md)

---

## Visão

O **pimo-room v4** é o módulo oficial de salas arquitectónicas do pimo-alfa.
Consolida as fases A–E do RoomEngine num pacote estável, com ViewerCore WebGL
como renderer e isolamento completo do pipeline industrial (cutlist / nesting / CNC).

## API pública

```ts
import {
  PimoRoom,
  loadRoom,
  importIfc,
  importGlb,
  exportGlb,
  applyAiPreset,
  autoArrange,
  autoDesign,
  getRoomState,
  setRoomState,
  RoomIndustrialAdapter,
  buildRoomReportMetadata,
  PIMO_ALFA_VERSION,
} from "../pimo-room-v4";
```

| Função | Descrição |
|--------|-----------|
| `loadRoom` | JSON → RoomState / ProjectRoomConfig |
| `importIfc` | Ficheiro IFC2x3/IFC4 → RoomState |
| `importGlb` | GLB sala ou item |
| `exportGlb` | RoomState → buffer GLB |
| `applyAiPreset` | Preset AI (moderno / minimalista / clássico / industrial) |
| `autoArrange` | Reorganiza itens do nível activo |
| `autoDesign` | Gera layout completo |
| `getRoomState` / `setRoomState` | Store Zustand |

## Arquitectura

```
src/pimo-room-v4/
  index.ts                 # API pública
  version.ts               # PIMO_ALFA_VERSION + ROOM_ENGINE_*
  RoomIndustrialAdapter.ts # Bridge industrial (cutlist-safe)
  roomMetadata.ts          # Metadados PDF / nesting
  ui/AboutRoomEngineModal.tsx
  RoomState.ts …
  catalog/ ifc/ glb/ ai/
  levels/ walkthrough/
  adapters/viewerSurfaceAdapter.ts
```

Compatibilidade: `src/room-engine/index.ts` reexporta `pimo-room-v4` (shim deprecated).

O `src/3d/viewer-engine/room/` (**ProjectRoomConfig**) permanece — contrato
industrial de paredes/aberturas para autoRoomFill. Conversão via
`RoomConverter` / `RoomIndustrialAdapter.toProjectRoomConfig`.

## Isolamento industrial

`RoomIndustrialAdapter.sync(state)` devolve:

- `projectRoom` — input seguro para autoRoomFill / PainelSala
- `constraints` — clearances (aberturas + itens)
- `furnitureHints` — metadados de mobiliário (`industrialSafe: true`)
- `metadata` — para PDF / relatórios
- `workspaceBoxes: []` — **nunca** cria caixas de fabrico

## Admin

- `/admin/room-settings` — Configurações da Sala
- `/admin/global-settings` — banner PIMO-ALFA v4.0 + link para room-settings

## UI projecto

`PainelSala`: badge RoomEngine v4, rodapé PIMO-ALFA v4.0, modal Sobre.

## Testes

```
tests/pimo-room-v4/
  roomEnginePhaseA…E.test.ts
  pimoRoomV4Final.test.ts
  fixtures/ifcFixtures.ts
```

## Naming unificado

- **PimoRoom** — fachada pública
- **RoomBridge** — import/export JSON/IFC/GLB
- **RoomIndustrialAdapter** — sync industrial cutlist-safe
- WalkthroughCamera · CatalogItem · SlabEngine · RoomLevelManager
- AiEngine · GlbExporter · IfcLoader
