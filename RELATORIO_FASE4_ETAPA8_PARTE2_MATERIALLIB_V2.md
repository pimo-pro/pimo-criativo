# Relatório — FASE 4 Etapa 8 (Parte 2): MaterialLibrary v2 e integração com o Viewer

## Objetivo

Criar o módulo MaterialLibrary v2 que converte MaterialRecord + MaterialPreset num objeto visual completo (cor, textura, UV, roughness/metallic) e adicionar no Viewer uma função opcional para aplicar esse material aos meshes, sem substituir o sistema atual.

---

## 1. Estrutura da MaterialLibrary v2

**Ficheiro:** `src/core/materials/materialLibraryV2.ts`

### Tipo `VisualMaterial`

Objeto visual final pronto para renderização:

- `color: string` — cor base (hex)
- `textureUrl?: string` — URL da textura (opcional)
- `uvScale: { x: number; y: number }` — escala UV (default 1, 1)
- `uvRotation: number` — rotação UV em graus (default 0)
- `roughness: number` — 0–1 (default 0.6)
- `metallic: number` — 0–1 (default 0)
- `normalMapUrl?: string` — URL do normal map (opcional, preparado para uso futuro)

### Funções

- **`buildVisualMaterial(materialRecord, preset): VisualMaterial`**  
  Constrói o objeto visual a partir do registo CRUD e do preset. Usa `record.color` se for hex válido, senão `preset.color`. Demais campos vêm do preset com fallbacks (uvScale 1,1; uvRotation 0; roughness 0.6; metallic 0). Preset sem textura → apenas cor base.

- **`getVisualMaterialForBox(box, projectMaterialId): VisualMaterial`**  
  Resolve o material da caixa: `getMaterialForBox` → `getMaterialByIdOrLabel` (MaterialRecord) → `getPresetById(record.visualPresetId)` ou `getDefaultPreset()` → `buildVisualMaterial(record, preset)`.

- **`getThreeJsMaterial(visualMaterial): THREE.MeshStandardMaterial`**  
  Cria um `MeshStandardMaterial` com `color`, `roughness` e `metalness`. Não carrega texturas (uso síncrono; texturas são aplicadas em `applyVisualMaterialToMesh`).

- **`getFallbackMaterial(): VisualMaterial`**  
  Devolve um `VisualMaterial` de fallback via `getDefaultPreset()` e `buildVisualMaterial(null, preset)`.

- **`applyVisualMaterialToMesh(mesh, visualMaterial): void`**  
  Aplica o material visual a um `THREE.Mesh`: define cor, roughness e metallic no material (ou cria um novo `MeshStandardMaterial` se o atual não for desse tipo). Se existir `textureUrl`, carrega a textura de forma assíncrona, define `material.map`, `texture.repeat` a partir de `uvScale`, e `texture.rotation` a partir de `uvRotation` (graus → radianos). Suporta mesh com material único ou array de materiais (edge/face).

---

## 2. Como o visualMaterial é construído

1. **Origem dos dados:** MaterialRecord (CRUD) + MaterialPreset (presetService).
2. **Cor:** Se o record tiver `color` em hex válido, usa-se; caso contrário usa-se `preset.color`. Fallback final: `#f5f5f5`.
3. **Textura:** `preset.textureUrl ?? record.textureUrl`; se não houver, o resultado é só cor base.
4. **UV:** `uvScale` e `uvRotation` vêm do preset; valores em falta → (1, 1) e 0.
5. **PBR:** `roughness` e `metallic` do preset, limitados a [0, 1]; em falta → 0.6 e 0.
6. **Fallbacks gerais:** Sem preset → `getDefaultPreset()`. Sem record → `buildVisualMaterial(null, preset)` usa apenas o preset.

---

## 3. Como o Viewer aplica cor / UV / roughness / metallic

- **Função no Viewer:** `applyVisualMaterialToMesh(mesh: THREE.Mesh, visualMaterial: VisualMaterial): void`  
  Implementação delega para `applyVisualMaterialToMesh` de `materialLibraryV2`.

- **Comportamento:**
  - Para cada material do mesh (um ou vários, no caso de edge/face):
    - Se for `THREE.MeshStandardMaterial`, actualiza-se `color`, `roughness`, `metalness`.
    - Caso contrário, cria-se um novo `MeshStandardMaterial` com `getThreeJsMaterial(visualMaterial)` e substitui-se esse slot.
  - **Textura:** Só se `visualMaterial.textureUrl` estiver definido. Carrega-se a textura com `THREE.TextureLoader`; no callback define-se `material.map`, `texture.repeat` com `uvScale.x/y` e `texture.rotation` com `uvRotation` em radianos. Em caso de erro de carregamento, mantém-se apenas a cor base.

- **UV mapping:** Aplicado apenas quando existe textura: `repeat` a partir de `uvScale` e `rotation` a partir de `uvRotation` (graus).

- O fluxo actual do Viewer (`updateBoxMaterial(id, materialName)` com MaterialLibrary antiga) não foi alterado; `applyVisualMaterialToMesh` é um canal opcional para quem quiser usar MaterialLibrary v2.

---

## 4. Ficheiros alterados / criados

| Ficheiro | Alteração |
|----------|------------|
| `src/core/materials/materialLibraryV2.ts` | **Novo.** Tipos `VisualMaterial`; funções `buildVisualMaterial`, `getVisualMaterialForBox`, `getThreeJsMaterial`, `getFallbackMaterial`, `applyVisualMaterialToMesh`. Depende de `./types`, `./presets`, `./service`, `./presetService`, `../types` (BoxModule), `three`. |
| `src/core/materials/index.ts` | Export de `materialLibraryV2` adicionado. |
| `src/3d/core/Viewer.ts` | Import de `applyVisualMaterialToMesh` e `VisualMaterial` a partir de `materialLibraryV2`; novo método público `applyVisualMaterialToMesh(mesh, visualMaterial)` que delega para o módulo core. |

Não foram alterados: MaterialLibrary antiga (`src/3d/materials/MaterialLibrary.ts`), WoodMaterial, BoxBuilder, CNC, PDF, Cutlist, Materiais & Fabricação. O fluxo de manufacturing e a resolução de material para fins industriais/PDF/cutlist continuam iguais.

---

## 5. Confirmação de que nada foi quebrado

- **Viewer:** `updateBoxMaterial(id, materialName)` e `loadMaterial(materialName)` continuam a usar a MaterialLibrary e o WoodMaterial actuais. Nenhum código existente foi removido ou alterado na lógica de materiais; apenas foi adicionado o método opcional `applyVisualMaterialToMesh`.
- **Sincronização:** useCalculadoraSync e restante fluxo continuam a usar `getViewerMaterialId` e `materialName` como antes; não passam a usar obrigatoriamente MaterialLibrary v2.
- **CRUD / presets:** MaterialRecord e presetService continuam a ser usados como na Etapa 8 Parte 1; a v2 apenas consome `getMaterialForBox`, `getMaterialByIdOrLabel`, `getPresetById` e `getDefaultPreset`.
- **Compatibilidade:** Projetos antigos sem `visualPresetId` passam a usar `getDefaultPreset()` em `getVisualMaterialForBox`, obtendo um material visual de fallback estável.

A página Materials, o Viewer actual e os fluxos de manufacturing, PDF e Cutlist mantêm-se estáveis e funcionais.
