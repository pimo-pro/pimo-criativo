# Relatório: Estrutura base (skeleton) FASE 3 — pimo-criativo

**Data:** 11 de fevereiro de 2025  
**Objetivo:** Criar apenas a estrutura inicial dos três módulos (Materials System, Export Engine, Layout Engine), sem lógica real.

---

## 1. Estrutura criada

```
src/core/
├── materials/                    # Materials System (FASE 3)
│   ├── types.ts                  # Interfaces e tipos placeholders
│   ├── service.ts                # Funções principais (skeleton)
│   ├── hooks.ts                  # Hooks React (skeleton)
│   ├── utils.ts                  # Funções auxiliares (skeleton)
│   ├── index.ts                  # Export central
│   └── materialPresets.ts        # (existente; não alterado)
│
├── export/                       # Export Engine (FASE 3)
│   ├── types.ts                  # Interfaces e tipos placeholders
│   ├── service.ts                # Funções principais (skeleton)
│   ├── hooks.ts                  # Hooks React (skeleton)
│   ├── utils.ts                  # Funções auxiliares (skeleton)
│   ├── index.ts                  # Export central
│   └── pdfGenerator.ts           # (existente; não alterado)
│
└── layout/                       # Layout Engine (FASE 3)
    ├── types.ts                  # Interfaces e tipos placeholders
    ├── service.ts                # Funções principais (skeleton)
    ├── hooks.ts                  # Hooks React (skeleton)
    ├── utils.ts                  # Funções auxiliares (skeleton)
    ├── index.ts                  # (atualizado: re-export dos novos ficheiros)
    ├── layoutWarnings.ts         # (existente; não alterado)
    ├── smartArrange.ts           # (existente; não alterado)
    └── viewerLayoutAdapter.ts   # (existente; não alterado)
```

---

## 2. Arquivos adicionados

| Módulo | Ficheiro | Descrição |
|--------|----------|-----------|
| **Materials** | `types.ts` | Tipos e interfaces do sistema de materiais. |
| **Materials** | `service.ts` | Funções: `getPresetsByCategory`, `applyMaterial`, `getMaterialsState`, `resetCategoryOverrides` (todos placeholder). |
| **Materials** | `hooks.ts` | `useMaterialsSystem`, `useMaterialPresets` (retornos vazios/estáticos). |
| **Materials** | `utils.ts` | `normalizeCategoryId`, `getPresetById`, `canApplyPresetToPart` (placeholders). |
| **Materials** | `index.ts` | Re-export de types, service, hooks, utils (sem re-export de materialPresets para evitar conflito de tipos). |
| **Export** | `types.ts` | Tipos: `ExportFormat`, `ExportOptions`, `ExportResult`, `ExportEngineConfig`, `ExportPayload`. |
| **Export** | `service.ts` | `runExport`, `isFormatAvailable`, `getFileExtensionForFormat`, `prepareExportOptions` (placeholders). |
| **Export** | `hooks.ts` | `useExport`, `useAvailableExportFormats` (skeleton com estado local). |
| **Export** | `utils.ts` | `sanitizeExportFilename`, `getMimeTypeForFormat`, `canExportFormat` (placeholders). |
| **Export** | `index.ts` | Re-export de types, service, hooks, utils. |
| **Layout** | `types.ts` | `LayoutDimensionsMm`, `LayoutPosition`, `LayoutBoxInput`, `LayoutResult`, `LayoutEngineOptions`. |
| **Layout** | `service.ts` | `computeLayout`, `detectCollisions`, `getLayoutBounds`, `isPositionInBounds` (placeholders). |
| **Layout** | `hooks.ts` | `useLayoutEngine`, `useLayoutCollisions` (skeleton). |
| **Layout** | `utils.ts` | `mmToMeters`, `metersToMm`, `volumeMm3`, `positionsEqual` (placeholders). |
| **Layout** | `index.ts` | Atualizado: mantidos os exports de viewerLayoutAdapter, layoutWarnings, smartArrange; adicionados exports de types, service, hooks, utils. |

**Total:** 15 ficheiros novos + 1 ficheiro existente alterado (`layout/index.ts`).

---

## 3. Interfaces e tipos placeholders criados

### Materials System (`core/materials/types.ts`)

- `MaterialCategoryId` — tipo string para categoria.
- `MaterialPreset` — id, categoryId, label, metadata.
- `MaterialAssignment` — partId, presetId, categoryId.
- `MaterialsSystemState` — assignments, activeCategoryId, categoryOverrides.
- `ApplyMaterialOptions` — boxId, modelInstanceId, partId.

### Export Engine (`core/export/types.ts`)

- `ExportFormat` — `"pdf" | "cnc" | "cutlist" | "image"`.
- `ExportOptions` — format, filename, includeMetadata.
- `ExportResult` — success, outputUrl, error.
- `ExportEngineConfig` — defaultFormat, formatOptions.
- `ExportPayload` — boxIds, options.

### Layout Engine (`core/layout/types.ts`)

- `LayoutDimensionsMm` — largura, altura, profundidade.
- `LayoutPosition` — x, y, z opcional.
- `LayoutBoxInput` — id, dimensions, position, rotationY.
- `LayoutResult` — placements (boxId, position, rotationY), bounds, warnings.
- `LayoutEngineOptions` — gapMm, maxAreaMm, allowAutoRotate.

---

## 4. Garantias respeitadas

- **Nenhum ficheiro tem lógica real:** Todas as funções retornam valores vazios, `null`, `false` ou `Promise.resolve(...)` com mensagem de placeholder.
- **Tipos e interfaces são placeholders:** Estruturas definidas para uso futuro; sem implementação de regras de negócio.
- **Padrão do projeto:** TypeScript, módulos com export central (`index.ts`), nomenclatura e estrutura alinhadas ao restante do `core/`.
- **Nada quebrado:** Ficheiros existentes (`materialPresets.ts`, `pdfGenerator.ts`, `layoutWarnings.ts`, `smartArrange.ts`, `viewerLayoutAdapter.ts`) não foram alterados. O `index` de `layout` apenas adiciona exports; os de `materials` e `export` não re-exportam os ficheiros antigos para evitar conflitos de tipos.

---

## 5. Confirmação de build estável

- **TypeScript:** `npx tsc --noEmit` — **OK**.
- **Build:** `npm run build` (tsc -b && vite build) — **OK**.

O projeto compila e o build permanece estável. A FASE 3 pode avançar com a implementação da lógica em cima destes skeletons.
