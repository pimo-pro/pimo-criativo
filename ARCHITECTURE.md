# Arquitectura — PIMO-Criativo (estado pós Z-03.10 / hub v1.40)

## 1. Modelo de estado (Project)

- `ProjectState` (`src/context/projectTypes.ts`) é o “coração” do projecto.
- Para a sala:
  - **SSOT canónico:** `ProjectState.room` em **mm** (`ProjectRoomConfig`).
- Para persistência:
  - O “envelope” de snapshot usa `ProjectSnapshot`/`PersistedProjectSnapshot` (projectState + viewer + sala).

## 2. Sala / room (SSOT mm → vistas cm → render m)

Fluxo canónico:
1. UI canónica (`PainelSala`) chama `actions.updateProjectRoom` com `ProjectRoomConfig` (mm).
2. `useRoomActions` normaliza e grava no SSOT: `ProjectState.room`.
3. `RoomEngine.applyProjectRoomToWallStore` gera a vista derivada `wallStore` em **cm**.
4. `roomMeshFromWallStore` sincroniza `wallStore` → `RoomManager` (viewer em **metros**).

Persistência e compatibilidade:
- `roomSnapshot` é um snapshot derivado persistido em **cm**.
- **Z-03.7 (unificação de persistência):** no load, se `project.room` estiver ausente mas `roomSnapshot` existir, promovemos `roomSnapshot -> project.room` via `wallStoreToProjectRoom` + `normalizeProjectRoom`.
- Isto preserva sempre o SSOT mm (evita mistura mm/cm) e garante retrocompatibilidade com snapshots antigos.

## 3. Viewer canónico

- Entrada UI: `Workspace.tsx` → `usePimoViewer` → `ViewerApi`.
- Implementação 3D:
  - `src/3d/viewer-engine/ViewerCore.ts` (~**3570** linhas; fachada/orquestração — **não** monolito ~6300).
  - Engines e `ViewerCore*Ops` já extraídos (Z-01.2 / Z-03.10).
  - `src/3d/core/Viewer.ts` é apenas uma fachada/alias.

Engines internas ao ViewerCore (exemplos):
- `BoxEngine`, `SelectionEngine`, `GizmoEngine`
- `ViewerRoomEngine` (sala no viewer)
- `DesignerEngine`, `MeasurementEngine`
- `SnapEngine`, `SmartAlignSnapEngine`
- `SceneEngine`, `CameraEngine`, `LightingEngine`, `ComposerEngine`, `MaterialEngine`

Sala no viewer:
- `RoomManager` (src/3d/room/) + `RoomBuilder` para aberturas (portas/janelas).

## 4. Pipeline industrial (isolado)

O pipeline industrial (CNC, DRILL, PI, TCN, NQR, etiquetas, técnico, XLSX) é **isolado** do subsistema sala:
- não depende de `RoomManager`/`RoomEngine`/`wallStore`/`roomSnapshot` para regras industriais;
- a sala afecta o industrial apenas via bridge permitido (ex.: `autoRoomFill`/Kitchen 3.0), gerando `WorkspaceBoxes`. Depois disso o industrial opera sobre dados de caixas/cutlist como SSOT industrial.

## 5. V4 (removido em Z-03.8)

- O subsistema V4 foi removido em **Z-03.8**:
  - `src/v4/`, `src/components/v4/`, `src/pages/V4Page.tsx`
  - rota `/v4` inexistente.
- O projecto mantém apenas o viewer canónico e o sistema sala SSOT (mm → wallStore/roomSnapshot cm → render em metros).

