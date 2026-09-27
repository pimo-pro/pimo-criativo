# Arquitetura — Novo RoomEngine (pimo-alfa)

**Status:** proposta para discussão — **sem implementação**  
**Data:** 2026-09-19  
**Âmbito:** só documentação em `pimo-alfa` · leitura de `external/aedifex`  
**Proibido nesta fase:** código de engines, alterações a `pimo-criativo` / mail / WordPress

---

## 0. Veredicto

| Sistema | Papel |
|---------|--------|
| **Aedifex** | Referência de *domínio* arquitetónico (grafo de nós, multi-level, slabs, tools, IFC) — **não** runtime a embutir |
| **pimo-room v4 atual** | Base útil mas limitada (1 nível, retângulo+extras, stubs de snap/openings) |
| **Industrial pipeline** | Continua SSOT próprio (`workspaceBoxes` → cutlist/CNC/PDF) — **zero imports** de RoomEngine |
| **Novo `src/room-engine/`** | Domínio puro (mm) + geometria descritiva; renderer fica em `3d/room` + ViewerCore WebGL |

**Princípio:** um RoomEngine reutilizável (salas, cozinhas, projetos completos) que *pode* gerar caixas via adapter, sem alterar o pipeline industrial.

---

## 1. Aedifex como RoomEngine de referência

### 1.1 Modelo de estado

Grafo plano `Record<nodeId, AnyNode>` + `rootNodeIds` (Zustand + undo).

Hierarquia típica:

```
Site → Building → Level → Wall | Slab | Ceiling | Zone | Roof | Item
                         Wall → Door | Window | Item (hosted)
```

Schemas Zod em `external/aedifex/packages/core/src/schema/nodes/*`  
(Wall: start/end/thickness/height/slots; Door/Window: wallId + offsets; Zone: polygon; Slab/Ceiling: polygon + holes; Level: ordinal + height).

### 1.2 Geometria

| Camada | Onde | Extraível sem WebGPU? |
|--------|------|------------------------|
| Miters, footprint, space-detection | `@aedifex/core` | **Sim** |
| Extrude wall / door mesh / slab solid | `@aedifex/viewer` (Three) | Reescrever em WebGL pimo |
| UI tools / Tailwind | `@aedifex/editor` | **Não trazer** |

### 1.3 Materiais

Slots `library:` / `scene:` + catálogo em `material-library.ts`. Resolver cores/presets em domínio; `MeshStandardMaterial` só no renderer pimo.

### 1.4 Multi-level

Dados: `getLevelElevations` (prefix sum de `level.height`).  
Visual: `stacked | exploded | solo` — no pimo vira política do ViewerCore, não do Aedifex viewer.

### 1.5 Tools (lógica pura útil)

`services/snap.ts`, `movement.ts`, `hosting.ts`, `alignment.ts`, `opening-guides.ts`, `drag-session.ts`, wall drafting snap.

### 1.6 IFC / GLB / catálogo

- IFC: `@aedifex/ifc-converter` → grafo (fase D)  
- GLB export: lógica Three exporters (fase D)  
- Items: `assetSchema` + `CATALOG_ITEMS` (fase C) — assets locais, não CDN SaaS obrigatório  

### 1.7 O que NÃO reutilizar como runtime

Next.js shell, Tailwind/Radix UI, Canvas WebGPU/R3F como viewport principal, SQLite `~/.pascal`, peer `next`.

---

## 2. pimo-alfa hoje — IndustrialEngine + Viewer

### 2.1 Fluxo sala atual (pimo-room v4)

```
ProjectState.room (ProjectRoomConfig, mm)
  → RoomEngine.normalize / applyProjectRoomToWallStore
  → wallStore (cm)
  → useViewerRoomSync → roomMeshFromWallStore
  → RoomManager + RoomBuilder (m, WebGL)
```

Contrato: `src/3d/viewer-engine/room/roomEngineTypes.ts` — *“Não alimenta cutlist, CNC ou produção.”*

### 2.2 Ligação caixas ↔ sala (já existe, isolada)

| Canal | Função | Escreve em industrial? |
|-------|--------|-------------------------|
| `core/autoRoomFill` | Gera plano → `workspaceBoxes` | Sim (só boxes), não cutlist directo |
| `smartSnappingRoom` | Snap 3D a paredes/aberturas | Não |
| `kitchenFinish/roomContext` | Remate/rodapé ao longo de paredes | Peças finish no cutlist via boxes |

### 2.3 Regressão crítica

`ViewerCoreRoomUtils.ts` está **STUB no-op** (aberturas para snap, constraints, bounds mm auto-layout). Geometria (`ViewerCoreRoomGeometry`) funciona; tools de snap/abertura estão degradadas.

### 2.4 Isolamento industrial (a preservar)

`core/cnc`, `manufacturing/cutlist`, `nesting-v3`, `core/pdf` **não** importam room. Manter regra:

> `industrial/**` e `core/cnc|manufacturing|pdf|nesting*` **proibidos** de importar `src/room-engine/**`.

---

## 3. Proposta — `src/room-engine/`

### 3.1 Diagrama de módulos

```
┌─────────────────────────────────────────────────────────────────┐
│                     UI pimo-alfa (tokens/ícones)                │
│              PainelSala · LeftToolbar · Workspace               │
└────────────────────────────┬────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────┐
│                    src/room-engine/  (domínio)                  │
│  RoomState · RoomValidator · RoomConverter                      │
│  WallEngine · OpeningsEngine · FloorEngine · CeilingEngine      │
│  MaterialsEngine · (LevelEngine B+) · (ItemEngine C+)           │
│  RoomGeometry (descritores mm — sem THREE)                      │
└───────┬─────────────────────────────┬───────────────────────────┘
        │                             │
        ▼                             ▼
┌───────────────────┐    ┌────────────────────────────────────────┐
│ 3d/room + Viewer  │    │ RoomIndustrialAdapter (única ponte)    │
│ RoomManager mesh  │    │  → AutoFillPlan / box placement hints  │
│ WebGL ViewerCore  │    │  ✗ NÃO → cnc/cutlist/nesting/pdf       │
└───────────────────┘    └────────────────────────────────────────┘
                                      │
                                      ▼
                         ┌────────────────────────┐
                         │ workspaceBoxes (exist.)│
                         │ industrial pipeline    │
                         └────────────────────────┘
```

### 3.2 Layout de pastas (proposta)

```
src/room-engine/
  index.ts                 # API pública
  types/
    RoomState.ts
    RoomGeometry.ts
    materials.ts
  RoomState.ts             # CRUD / snapshot / imutável
  RoomValidator.ts
  RoomConverter.ts         # ↔ ProjectRoomConfig + (futuro) Aedifex graph
  engines/
    WallEngine.ts
    FloorEngine.ts
    CeilingEngine.ts
    OpeningsEngine.ts
    MaterialsEngine.ts
    LevelEngine.ts         # Fase B
    ItemEngine.ts          # Fase C
  geometry/
    descriptors.ts         # polígonos, extrusões lógicas (mm)
    miters.ts              # port de calculateLevelMiters
    spaces.ts              # auto-zones (port space-detection)
  adapters/
    wallStoreAdapter.ts
    viewerSurfaceAdapter.ts  # substitui stubs RoomUtils
  RoomIndustrialAdapter.ts
  NOTICE                   # MIT Pascal/Aedifex onde aplicável
```

**Regra de naming:** o ficheiro actual `3d/viewer-engine/room/RoomEngine.ts` passa a ser *legacy façade* que reexporta o novo módulo (migração gradual) — **só quando implementarmos**, não agora.

### 3.3 Interfaces TypeScript (proposta)

```typescript
/** SSOT do RoomEngine — mm, independe de Three/React */
export type RoomId = string;
export type LevelId = string;
export type WallId = string;
export type OpeningId = string;

export type Vec2Mm = { x: number; z: number };
export type Vec3Mm = { x: number; y: number; z: number };

export type RoomMaterialRef =
  | { kind: "preset"; presetId: string }
  | { kind: "color"; hex: string; roughness?: number; metalness?: number }
  | { kind: "pimo"; materialId: string }; // bridge futura a materiais pimo

export type RoomWall = {
  id: WallId;
  levelId: LevelId;
  startMm: Vec2Mm;
  endMm: Vec2Mm;
  heightMm: number;
  thicknessMm: number;
  label?: "norte" | "sul" | "este" | "oeste" | "extra" | "custom";
  materialSlots?: {
    interior?: RoomMaterialRef;
    exterior?: RoomMaterialRef;
  };
};

export type RoomOpening = {
  id: OpeningId;
  type: "door" | "window";
  wallId: WallId;
  kind: "normal" | "correr";
  offsetAlongWallMm: number;
  widthMm: number;
  heightMm: number;
  sillMm: number; // floor offset
};

export type RoomSlab = {
  id: string;
  levelId: LevelId;
  polygonMm: Vec2Mm[];
  thicknessMm: number;
  elevationMm: number;
  holesMm?: Vec2Mm[][];
};

export type RoomCeiling = {
  id: string;
  levelId: LevelId;
  polygonMm: Vec2Mm[];
  heightMm: number; // clear height from slab
};

export type RoomZone = {
  id: string;
  levelId: LevelId;
  name: string;
  polygonMm: Vec2Mm[];
  spaceRole?: "generic" | "room" | "kitchen" | "living";
};

export type RoomLevel = {
  id: LevelId;
  ordinal: number;
  name: string;
  storeyHeightMm: number;
};

/** Estado completo — Fase A usa 1 level; B+ multi-level */
export type RoomState = {
  version: 1;
  id: RoomId;
  levels: RoomLevel[];
  activeLevelId: LevelId;
  walls: RoomWall[];
  openings: RoomOpening[];
  zones: RoomZone[];
  slabs: RoomSlab[];      // vazio na Fase A
  ceilings: RoomCeiling[]; // vazio ou 1 default na Fase A
  items: RoomItem[];      // Fase C
  materials: Record<string, RoomMaterialRef>;
  locked: boolean;
};

export type RoomItem = {
  id: string;
  levelId: LevelId;
  catalogId: string;
  positionMm: Vec3Mm;
  rotationDeg: number;
  wallId?: WallId;
};

/** Geometria descritiva — input do renderer, sem Object3D */
export type RoomGeometryDescriptor = {
  walls: Array<{
    wallId: WallId;
    footprintMm: Vec2Mm[];
    heightMm: number;
    miter?: { startAngleRad: number; endAngleRad: number };
    cutouts: Array<{ openingId: OpeningId; rectMm: unknown }>;
  }>;
  floorPolygonsMm: Vec2Mm[][];
  ceilingPolygonsMm: Vec2Mm[][];
  levelElevationsMm: Record<LevelId, number>;
};

export interface WallEngine {
  addWall(state: RoomState, input: Omit<RoomWall, "id">): RoomState;
  moveEndpoint(state: RoomState, wallId: WallId, which: "start" | "end", to: Vec2Mm): RoomState;
  setThickness(state: RoomState, wallId: WallId, thicknessMm: number): RoomState;
  computeMiters(state: RoomState, levelId: LevelId): RoomState;
}

export interface OpeningsEngine {
  addOpening(state: RoomState, opening: Omit<RoomOpening, "id">): RoomState;
  moveAlongWall(state: RoomState, openingId: OpeningId, offsetMm: number): RoomState;
  validateOnWall(state: RoomState, opening: RoomOpening): ValidationIssue[];
}

export interface FloorEngine {
  ensureSlabFromWalls(state: RoomState, levelId: LevelId): RoomState;
  setPolygon(state: RoomState, slabId: string, polygonMm: Vec2Mm[]): RoomState;
}

export interface CeilingEngine {
  ensureCeilingFromWalls(state: RoomState, levelId: LevelId): RoomState;
  setHeight(state: RoomState, ceilingId: string, heightMm: number): RoomState;
}

export interface MaterialsEngine {
  assignWallSlot(
    state: RoomState,
    wallId: WallId,
    slot: "interior" | "exterior",
    ref: RoomMaterialRef,
  ): RoomState;
  resolveForRender(ref: RoomMaterialRef): { color: string; roughness: number; metalness: number };
}

export interface RoomValidator {
  validate(state: RoomState): ValidationIssue[];
}

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  entityId?: string;
  message: string;
};

export interface RoomConverter {
  /** Compat com SSOT actual do projecto */
  fromProjectRoomConfig(room: import("../3d/viewer-engine/room/roomEngineTypes").ProjectRoomConfig): RoomState;
  toProjectRoomConfig(state: RoomState): import("../3d/viewer-engine/room/roomEngineTypes").ProjectRoomConfig;
  /** Intercâmbio Aedifex (subset) — fases B+ */
  fromAedifexGraph?(graph: unknown): RoomState;
  toAedifexGraph?(state: RoomState): unknown;
}

export interface RoomGeometryBuilder {
  build(state: RoomState): RoomGeometryDescriptor;
}

/** Ponte única para o mundo industrial — NÃO importa cnc/pdf */
export interface RoomIndustrialAdapter {
  /** Read-model para snap / auto-layout (mm) */
  getLayoutReadModel(state: RoomState): {
    boundsMm: { width: number; depth: number; height: number };
    walls: Array<{ id: string; lengthMm: number; rotationDeg: number }>;
    openings: Array<{ id: string; type: "door" | "window"; wallId: string; offsetMm: number; widthMm: number }>;
  };
  /** Gera plano de caixas — reutiliza autoRoomFill existente */
  proposeBoxesFromRoom(
    state: RoomState,
    options: { mode: "kitchen30" | "empty" | "custom" },
  ): { boxDrafts: unknown[] } | null;
  /** Aplica drafts via bridge existente (Workspace / applyAutoRoomFillPlan) */
  applyBoxDrafts(drafts: unknown[]): void;
}
```

### 3.4 Relação com `ProjectRoomConfig`

Na **Fase A**, `RoomState` com 1 level é **bijetável** a `ProjectRoomConfig` via `RoomConverter`.  
Persistência continua em `ProjectState.room` até Fase B (multi-level exige migração de schema / `roomSnapshot`).

---

## 4. Integração com o Viewer actual

| Ponto | Acção proposta (quando codificar) |
|-------|-----------------------------------|
| `useViewerRoomSync` | Continuar: `RoomState` → `toProjectRoomConfig` → wallStore → mesh |
| `ViewerCoreRoomGeometry` | Consumir `RoomGeometryDescriptor` (ou manter path actual via converter) |
| `ViewerCoreRoomUtils` (stubs) | **Prioridade:** `viewerSurfaceAdapter` preenche openings/bounds mm |
| `RoomManager` / `RoomBuilder` | Permanecem renderer WebGL; não conhecem industrial |
| `PainelSala` | Única UI; tokens/ícones pimo; chama engines via hooks |
| `smartSnappingRoom` | Ler openings do adapter (não stub) |

**Não** montar segundo Canvas R3F/WebGPU no Workspace principal.

---

## 5. Integração com pipeline industrial

```
RoomIndustrialAdapter
  ├── getLayoutReadModel     → smartSnap / LayoutEngine / kitchenFinish
  ├── proposeBoxesFromRoom   → core/autoRoomFill (existente)
  └── applyBoxDrafts         → workspaceBoxes
         │
         ▼
   cutlist / CNC / nesting / PDF   ← inalterados; só vê boxes
```

**Proibições:**

- RoomEngine não calcula cutlist  
- Industrial não valida paredes  
- Portas de *sala* ≠ portas de *caixa*  

---

## 6. Como reutilizar o Aedifex

| Reutilizar | Como |
|------------|------|
| Schemas / relações wall-door-zone | Inspirar tipos `RoomState`; port campos em falta |
| `calculateLevelMiters`, space-detection | Vendor MIT em `geometry/` + NOTICE |
| snap/hosting/opening-guides | Port para engines / tools pimo |
| ifc-converter | Fase D, output → `RoomConverter.fromAedifexGraph` |
| UI editor / WebGPU viewer / Next | **Descartar** |

Runtime alvo: **React + ViewerCore WebGL** (opcional R3F só em feature isolada, não no path crítico).

---

## 7. Plano de fases

### Fase A — RoomEngine básico
- `RoomState` (1 level) ↔ `ProjectRoomConfig`
- Wall / Openings / Floor(simple) / Ceiling(simple) / Materials (presets)
- `RoomValidator`, `RoomConverter`, `RoomGeometry` descritor
- `viewerSurfaceAdapter` restaura stubs
- UI: só PainelSala pimo  
- **Não** multi-level, items, IFC

### Fase B — Multi-level + slabs + walkthrough
- `LevelEngine`, slabs/ceilings reais, elevações
- Modos visual stacked/explode/solo no ViewerCore
- Walkthrough 1ª pessoa (controlos pimo)

### Fase C — Catálogo de itens
- `ItemEngine` + assets em `public/`
- Placement/collision/hosting (lógica Aedifex portada)
- UI catálogo estilo pimo (não Aedifex)

### Fase D — IFC + GLB
- Vendor ifc-converter → RoomState
- Export GLB da cena arquitetónica (separado de ZIP industrial)

### Fase E — AI opcional
- Tools sobre RoomState; painel chat tokens pimo; só `.env.local`

---

## 8. Riscos e mitigação

| Risco | Mitigação |
|-------|-----------|
| Dois SSOT (`RoomState` vs `ProjectRoomConfig`) | Fase A: converter bijetável; um writer (`useRoomActions`) |
| Dual renderer WebGPU+WebGL | Um viewport: ViewerCore |
| Quebrar CNC/cutlist | Boundary + testes “room não importado por manufacturing” |
| Naming confuso (`RoomEngine` actual vs novo) | Façade + rename gradual `LegacyProjectRoomOps` |
| Stubs RoomUtils esquecidos | Fase A deve incluir restauro como DoD |
| Scope creep Aedifex (45 kinds) | Fases A–E; kinds avançados só sob demanda |
| Licença MIT | NOTICE + atribuição em ports |

---

## 9. Definition of Done (Fase A, quando autorizada)

- [ ] `src/room-engine` domínio sem THREE  
- [ ] Converter ↔ `ProjectRoomConfig` com testes  
- [ ] Stubs `ViewerCoreRoomUtils` restaurados via adapter  
- [ ] PainelSala usa nova API sem mudar look pimo  
- [ ] Grep: zero imports room-engine em cnc/cutlist/nesting/pdf  
- [ ] `pimo-criativo` intacto  

---

## 10. Pontos para discussão (antes de codificar)

1. **Persistência multi-level:** evoluir `ProjectState.room` agora ou só na Fase B?  
2. **R3F:** proibido no Workspace, ou permitido num painel `/room-preview` isolado?  
3. **Prioridade Fase A:** restaurar stubs snap *antes* de slabs? (recomendado: sim)  
4. **Kitchen 3.0:** adapter chama `autoRoomFill` existente ou nova API? (recomendado: encapsular o existente)  
5. **Nome do pacote interno:** `src/room-engine` vs `src/domain/room`?

---

*Documento de discussão apenas. Nenhuma implementação de engines foi iniciada.*
