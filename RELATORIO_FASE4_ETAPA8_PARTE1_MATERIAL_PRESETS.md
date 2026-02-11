# Relatório — FASE 4 Etapa 8 (Parte 1): Material Presets Engine

## Objetivo

Criar um módulo centralizado que define presets visuais de materiais, com tipos, presets iniciais e serviço, como base para o futuro MaterialLibrary v2, Textures, UV Mapping e integração com o Layout Engine. Sem alterar o Viewer; apenas estrutura, tipos, presets e serviço, e integração com o CRUD de materiais.

---

## 1. Estrutura dos presets

### Ficheiro: `src/core/materials/presets.ts`

**Interface `MaterialPreset`:**
- `id: string` — identificador único
- `name: string` — nome do preset
- `color: string` — cor base (hex)
- `textureUrl?: string` — URL da textura (opcional)
- `uvScale?: { x: number; y: number }` — escala UV
- `uvRotation?: number` — rotação UV (graus)
- `roughness?: number` — 0–1
- `metallic?: number` — 0–1
- `normalMapUrl?: string` — URL do normal map (opcional)

**Tipo:** `MaterialPresetRecord = Record<string, MaterialPreset>`

**Constante:** `INITIAL_MATERIAL_PRESETS: MaterialPreset[]` — array estático com os 6 presets iniciais (carregado pelo presetService).

---

## 2. Lista dos presets iniciais

| id               | name              | color     | roughness | metallic |
|------------------|-------------------|-----------|-----------|----------|
| madeira_clara    | Madeira Clara     | #e8dcc8   | 0.6       | 0        |
| madeira_escura   | Madeira Escura    | #5c4033   | 0.65      | 0        |
| branco_liso      | Branco Liso       | #f5f5f5   | 0.4       | 0        |
| preto_fosco      | Preto Fosco      | #2a2a2a   | 0.85      | 0        |
| cinza_industrial | Cinza Industrial  | #6b7280   | 0.7       | 0.1      |
| carvalho_natural | Carvalho Natural  | #c9a227   | 0.55      | 0        |

Cada preset tem `uvScale: { x: 1, y: 1 }`, `uvRotation: 0`; `textureUrl` e `normalMapUrl` não definidos (placeholders para expansão futura).

---

## 3. Como funciona o presetService

**Ficheiro:** `src/core/materials/presetService.ts`

- **Store:** Map em memória inicializado com uma cópia de `INITIAL_MATERIAL_PRESETS`. Alterações (register/update/delete) modificam apenas esta cópia; os iniciais em `presets.ts` permanecem estáticos.

**Funções:**

- **`getAllPresets(): MaterialPreset[]`** — devolve todos os presets (cópias para não mutar o store).
- **`getPresetById(id: string): MaterialPreset | null`** — devolve preset por `id` ou `null`.
- **`getPresetByName(name: string): MaterialPreset | null`** — devolve preset por nome (case-insensitive) ou `null`.
- **`registerPreset(preset: MaterialPreset): boolean`** — adiciona um novo preset; retorna `false` se `id` já existir ou dados inválidos.
- **`updatePreset(id: string, data: Partial<...>): boolean`** — atualiza campos do preset; retorna `false` se o `id` não existir.
- **`deletePreset(id: string): boolean`** — remove o preset; retorna o resultado do `delete` no Map.
- **`getDefaultPreset(): MaterialPreset`** — fallback: devolve o preset `branco_liso` ou o primeiro disponível; se o store estiver vazio, devolve um objeto fallback mínimo.

Os presets são carregados apenas do objeto estático (`INITIAL_MATERIAL_PRESETS`); não há CRUD em localStorage nesta etapa.

---

## 4. Como o CRUD usa visualPresetId

- **MaterialRecord** (em `src/core/materials/types.ts`) já inclui `visualPresetId?: string`. Nenhuma alteração foi feita no tipo.

- **Drawer de materiais** (Admin → Materials, `GestaoMateriaisPage.tsx`):
  - O dropdown “Preset visual associado” passa a ser preenchido com **`getAllPresets()`** do `presetService` (presets do novo engine), exibindo `p.name` e valor `p.id`.
  - Se o material tiver um `visualPresetId` que não existe no novo engine (ex.: id legado), é mostrada a opção “— [id] (legado)” para manter o valor e compatibilidade.
  - **Preview do preset:** quando há um preset selecionado que existe no engine (`getPresetById(form.visualPresetId)`), é mostrado um bloco com:
    - Amostra da cor base (quadrado com `preset.color`)
    - Nome do preset
    - Roughness e Metallic
    - Indicação se há `textureUrl` ou `normalMapUrl` definidos

Assim, o CRUD continua a guardar e a mostrar `visualPresetId`; a lista de opções e o preview passam a depender do Material Presets Engine.

---

## 5. Ficheiros alterados / criados

| Ficheiro | Alteração |
|----------|-----------|
| `src/core/materials/presets.ts` | **Novo.** Interface `MaterialPreset`, tipo `MaterialPresetRecord`, constante `INITIAL_MATERIAL_PRESETS` com 6 presets. |
| `src/core/materials/presetService.ts` | **Novo.** Store em memória e funções `getAllPresets`, `getPresetById`, `getPresetByName`, `registerPreset`, `updatePreset`, `deletePreset`, `getDefaultPreset`. |
| `src/core/materials/index.ts` | Export de `presets` e `presetService` adicionados. |
| `src/pages/admin/materials/GestaoMateriaisPage.tsx` | Import de `getAllPresets` e `getPresetById` a partir de `presetService`; dropdown de preset visual usa `getAllPresets()`; opção legado quando `visualPresetId` não está nos presets; bloco de preview (cor, nome, roughness, metallic, textura/normal) quando há preset selecionado. |

Não foram alterados: MaterialLibrary, Viewer, CNC, PDF, Cutlist, Materiais & Fabricação, nem o ficheiro `materialPresets.ts` (compatibilidade mantida).

---

## 6. Confirmação de estabilidade

- O Viewer e a MaterialLibrary não foram alterados.
- O CRUD de materiais continua a usar `visualPresetId` como antes; materiais existentes com ids de preset antigos mantêm-se e podem ser exibidos como “(legado)” no dropdown.
- O presetService é usado apenas na página Admin → Materials (dropdown e preview). Nenhum outro módulo foi obrigado a migrar para o novo engine nesta parte.
- A página Materials está estável e funcional: lista e formulário (incluindo preset e preview) comportam-se conforme esperado. O sistema de Material Presets Engine fica pronto como base para a futura MaterialLibrary v2, Textures, UV Mapping e Layout Engine.
