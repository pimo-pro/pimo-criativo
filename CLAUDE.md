# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development server (with HMR)
npm run dev

# Type-check + production build
npm run build

# Run tests (single pass)
npm run test

# Run tests in watch mode
npm run test:watch

# Lint TypeScript/TSX source files
npm run lint

# Preview production build locally
npm run preview

# Publish (runs scripts/publish.js)
npm run publish
```

There is no router library — routing is manual via `window.history.pushState` + `popstate` in `App.tsx`.

The Vite dev server exposes a local `/api/materials` middleware (served by `src/server/materialsApi`). In production this endpoint is built at compile time.

## Architecture Overview

Pimo-v3 is a **furniture design web application** (cabinet configurator + 3D viewer) built with React 19, TypeScript, Three.js/R3F, and Zustand.

### Core Data Model

All domain types live in `src/core/types.ts`. The central state is `ProjectState` (defined in `src/context/projectTypes.ts`), which holds:
- `workspaceBoxes: WorkspaceBox[]` — modules placed in the 3D scene (position, rotation, material per box)
- `boxes: BoxModule[]` — computed cabinet data (cutlist, structure) derived from workspaceBoxes
- `resultados: ResultadosCalculo` — final calculation results (pricing, totals)
- `design`, `cutList`, `estructa3D`, `acessorios`, `ruleViolations`, `layoutWarnings`

### State Architecture

```
ProjectContext (src/context/)
  └── ProjectProvider → useProjectState (src/project/useProjectState.ts)
                      → useProjectActions (src/context/hooks/useProjectActions.ts)
                      → useViewerSync (src/hooks/useViewerSync.ts)
                      → useProjectPersistence
```

**ProjectContext** is the single source of truth for project data. It is consumed via `useProject()` hook (`src/context/useProject.ts`). Direct state mutations go through `actions.*` methods defined in `ProjectActions` interface.

**Zustand stores** (`src/stores/`) handle UI-only state that doesn't need persistence:
- `uiStore.ts` — selected tool, selection state
- `wallStore.ts` — derived view (cm) of `ProjectState.room` (mm SSOT); synced by `RoomEngine.applyProjectRoomToWallStore`

### 3D Viewer Architecture

```
Workspace.tsx
  └── usePimoViewer(containerRef, options)  →  PimoViewerApi (viewerApi)
      └── 3d/core/Viewer.ts (1-line alias for ViewerCore)
          └── src/3d/viewer-engine/ViewerCore.ts (~6300 lines, monolithic)
              ├── Managers: SceneManager, CameraManager, RendererManager,
              │             EventsManager, SelectionManager, HighlightManager, BoxManager
              ├── Engines:  BoxEngine, SelectionEngine, GizmoEngine, ViewerRoomEngine,
              │             DesignerEngine, MeasurementEngine, SnapEngine, SmartAlignSnapEngine,
              │             SceneEngine, CameraEngine, LightingEngine, ComposerEngine
              └── Room:     RoomManager (src/3d/room/) — 3D walls/openings
```

The `Viewer` class at `src/3d/core/Viewer.ts` is a 1-line alias (`class Viewer extends ViewerCore {}`) — all implementation lives in `src/3d/viewer-engine/ViewerCore.ts`.

**PimoViewerContext** (`src/context/PimoViewerContext.tsx`) registers the active viewer API so that panels (LeftPanel, RightPanel, etc.) can call viewer operations without prop-drilling.

**useViewerSync** (`src/hooks/useViewerSync.ts`) bridges `ViewerApi` (snapshot/render interface used by ProjectContext) with the viewer instance.

**Synchronization flow** (ProjectContext → Viewer):
1. `project.workspaceBoxes` changes
2. `useCalculadoraSync` detects diff → calls `viewerApi.addBox / updateBox / removeBox`
3. `useCadModelsSync` syncs GLB models per box

### Multi-Box System

Each cabinet in the workspace is a `WorkspaceBox`. The `MultiBoxManager` (`src/core/multibox/`) orchestrates syncing between `ProjectContext.workspaceBoxes` and the Viewer. Key `viewerApi` operations:
- `addBox(id, options)` — registers a new parametric or CAD-only cabinet
- `updateBox(id, options)` — updates dimensions/position/rotation
- `removeBox(id)` — frees resources
- `addModelToBox(boxId, path, modelId)` — loads a GLB inside a box

### GLB / CAD Models

GLB files are loaded via `src/core/glb/glbLoader.ts`. Parts are extracted with `glbPartsToCutList.ts` and registered in `glbRegistry.ts`. The CAD catalog is managed in `src/core/cad/cadModels.ts`.

### Cutlist & Manufacturing Pipeline

```
Box dimensions + rules → BoxModule (core/box/) → CutListItem[] → PDF / CNC export
```

- `src/core/layout/` — spatial layout calculation and material extension
- `src/core/drawers/` — drawer geometry, BOM, and generation service
- `src/core/cnc/` — KDT/CNC file generation
- `src/core/panel/` — panel constants
- PDF export: `jspdf` + `jspdf-autotable` via `src/core/export/`

### Rules Engine

Dynamic rules (dimension constraints, material compatibility, positioning) are defined in `src/core/rules/`. Profiles are stored in LocalStorage via `rulesStorage.ts` / `rulesProfilesStorage.ts`. The active rules profile is part of `ProjectState.rules`.

### Admin Area

Accessible at `/admin`. Admin pages manage: materials CRUD, CAD models catalog, hardware (ferragens), component types, rules profiles, label designer, deploy/versioning. These write to a database via `pg` (PostgreSQL client) on the server side.

### Materials System

- **MaterialLibrary v2** (`src/core/materials/materialLibraryV2.ts`) — visual material definitions with texture/UV/PBR properties
- **MaterialContext** (`src/context/materialContext.tsx`) — provides resolved material data to components
- `/api/materials` endpoint — served by Vite middleware in dev, compiled at build time for production

### Key Conventions

- All measurements in **millimeters** in domain logic; converted to meters for Three.js rendering
- `WorkspaceBox.x_mm`, `y_mm`, `z_mm` are the canonical position; `manualPosition: true` prevents auto-reflow from overwriting them
- The `Viewer` API uses meters; `ProjectContext` uses millimeters — conversion happens in sync hooks
- Language: variable names and comments are in **Portuguese** throughout the codebase (domain terms: `caixa`=cabinet, `gaveta`=drawer, `porta`=door, `prateleira`=shelf, `parede`=wall, `peça`=piece/part)
- `src/3d/` contains legacy 3D helpers; new viewer code lives in `src/viewer/`
- Dev-only tools under `src/__dev__/` (only loaded when `import.meta.env.DEV`)
