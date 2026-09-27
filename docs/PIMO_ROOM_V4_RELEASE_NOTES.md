# PIMO-ALFA v4.0 — RoomEngine Edition · Release Notes

**Versão:** `PIMO_ALFA_VERSION = "4.0"`  
**RoomEngine:** `ROOM_ENGINE_VERSION = "4.0"` · fase `FINAL`  
**Pacote:** `src/pimo-room-v4/`  
**Data:** 2026-09-21

Documentação técnica: [PIMO_ROOM_V4_FINAL.md](./PIMO_ROOM_V4_FINAL.md)

---

## Resumo

Lançamento oficial do **pimo-room v4** no pimo-alfa: motor arquitectónico de salas
(multi-level, slabs, catálogo, IFC/GLB, AI) com ViewerCore WebGL, isolado do pipeline
industrial (cutlist / nesting / CNC).

---

## Fases A–E

| Fase | Conteúdo |
|------|----------|
| **A** | RoomEngine core, snap, import JSON / RoomBridge |
| **B** | Multi-level, slabs avançados, walkthrough |
| **C** | Catálogo de itens (CRUD, ViewerCore, PainelSala) |
| **D** | Import IFC / GLB, export GLB, PBR |
| **E** | AI Auto-Arrange / Auto-Design / presets |
| **FINAL** | `pimo-room-v4`, adapter industrial, Admin, metadados PDF |

### Correcções pré-release 4.0

- Remoção de labels/mensagens “Aedifex” na UI e RoomBridge
- Botões unificados **Importar** / **Exportar** (JSON, IFC, GLB)
- FloorEngine: piso alinhado a RoomGeometry após import
- Portas/janelas: cutout acompanha o movimento; teclado (setas, Q/E, Delete, Ctrl+D)

---

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
  RoomBridge,
  RoomIndustrialAdapter,
} from "../pimo-room-v4";
```

Constantes: `PIMO_ALFA_VERSION`, `ROOM_ENGINE_VERSION`, `ROOM_ENGINE_PHASE`.

---

## Capacidades

- **Multi-level + slabs** — níveis empilhados, lajes, ghosts no viewer
- **Catálogo** — cadeira, mesa, sofá, candeeiro, custom; drag / Q-E / Delete
- **IFC** — parser STEP IFC2x3/IFC4 (paredes, portas, janelas, storeys, slabs)
- **GLB** — import sala/item, export sala completa
- **AI** — presets moderno / minimalista / clássico / industrial
- **Walkthrough** — câmara 1ª pessoa (WASD)
- **Industrial** — `RoomIndustrialAdapter` cutlist-safe (`workspaceBoxes: []`)

---

## Integração industrial

- `ProjectRoomConfig` (viewer-engine/room) permanece o contrato de autoRoomFill
- Metadados via `buildRoomReportMetadata` / `attachRoomMetadataToDocument`
- Níveis, slabs, itens AI **não** geram peças CNC

---

## UI

- PainelSala — badge RoomEngine v4, rodapé PIMO-ALFA v4.0, modal Sobre
- Admin `/admin/room-settings` — IFC/GLB, AI, versão
- Admin Configuração global — banner PIMO-ALFA v4.0

---

## Limitações conhecidas

- Parser IFC sem WASM (web-ifc): geometria simplificada a partir de perfis/extrusões
- Assets GLB de catálogo: placeholders se `/room-catalog/*.glb` ausentes
- Preview AI ghost requer ViewerCore activo
- Ambiente local pimo-alfa: sem remotes / deploy (ver `PIMO-ALFA-LOCAL.txt`)

---

## Roadmap futuro

- web-ifc / geometria IFC completa
- Assets GLB oficiais do catálogo
- Mais presets AI e regras de circulação
- Persistência de RoomState no project snapshot
- Deep-link Admin → ficheiros de docs no browser

---

## Testes

```
npx vitest run tests/pimo-room-v4/
```

Inclui fases A–E + `pimoRoomV4Final.test.ts` (API, adapter, AI+indústria, IFC, GLB, shim).
