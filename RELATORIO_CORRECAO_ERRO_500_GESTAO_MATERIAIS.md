# Relatório — Correção do erro 500 em GestaoMateriaisPage

## Erro

- **Sintoma:** `GET http://localhost:5173/src/pages/admin/materials/GestaoMateriaisPage.tsx net::ERR_ABORTED 500 (Internal Server Error)`
- **Causa:** O Vite/TypeScript falhava ao compilar o projeto devido a **três** problemas:

1. **Conflito de exports no barrel `src/core/materials/index.ts`**  
   - O módulo `./types` exporta `MaterialPreset` (tipo CRUD).  
   - O módulo `./presets` também exporta `MaterialPreset` (tipo visual, Etapa 8).  
   - Com `export * from "./types"` e `export * from "./presets"`, o TypeScript reportava:  
     `Module "./types" has already exported a member named 'MaterialPreset'. Consider explicitly re-exporting to resolve the ambiguity.`

2. **Conflito de nome `getPresetById`**  
   - `./utils` exporta `getPresetById(presets, presetId)` (placeholder CRUD).  
   - `./presetService` exporta `getPresetById(id: string)` (presets visuais).  
   - Com `export *` de ambos:  
     `Module "./utils" has already exported a member named 'getPresetById'. Consider explicitly re-exporting to resolve the ambiguity.`

3. **Uso de `??` e `||` sem parênteses em `GestaoMateriaisPage.tsx`**  
   - Linha 47: `return ... ?? id || "—";`  
   - O TypeScript (regra TS5076) exige parênteses quando se misturam `??` e `||` na mesma expressão.

---

## Como foi corrigido

1. **`src/core/materials/index.ts`**  
   - Deixou de se usar `export * from "./presets"` e `export * from "./presetService"`.  
   - Passou a re-exportar de forma explícita:  
     - De `./presets`: tipo `MaterialPreset` como **`VisualMaterialPreset`**, mais `MaterialPresetRecord` e `INITIAL_MATERIAL_PRESETS`.  
     - De `./presetService`: funções necessárias, com **`getPresetById`** exportada como **`getVisualPresetById`** para não colidir com `getPresetById` de `./utils`.  
   - Assim evita-se ambiguidade de `MaterialPreset` e de `getPresetById` no barrel.

2. **`src/pages/admin/materials/GestaoMateriaisPage.tsx`**  
   - Na função `getCategoryLabel`, a expressão foi alterada de  
     `... ?? id || "—"`  
     para  
     `... ?? (id || "—")`.  
   - Desta forma cumpre-se a regra TS5076 e o build conclui sem erro.

---

## Ficheiros alterados

| Ficheiro | Alteração |
|----------|-----------|
| `src/core/materials/index.ts` | Re-exports explícitos para `presets` e `presetService`; tipo visual como `VisualMaterialPreset`; `getPresetById` do presetService como `getVisualPresetById`. |
| `src/pages/admin/materials/GestaoMateriaisPage.tsx` | Parênteses na expressão com `??` e `||` em `getCategoryLabel`: `(id \|\| "—")`. |

**Nota:** A página continua a importar `getAllPresets` e `getPresetById` diretamente de `"../../../core/materials/presetService"`, pelo que não é afectada pela alteração do nome no barrel (`getVisualPresetById`). O build termina com sucesso e a página volta a compilar sem falhas.
