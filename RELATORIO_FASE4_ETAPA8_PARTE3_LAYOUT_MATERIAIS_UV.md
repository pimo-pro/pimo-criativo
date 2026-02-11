# Relatório — FASE 4 Etapa 8 (Parte 3): Integração dos materiais com o Layout Engine (UV, grain, faceMaterials)

## Objetivo

Ligar o sistema de materiais (MaterialRecord + MaterialPreset + MaterialLibrary v2) ao Layout Engine: cada peça na cutlist passa a conhecer material visual, espessura, direção do veio (grain) e parâmetros de UV, com preparação para texturas por face, sem quebrar o fluxo atual de cálculo e export.

---

## 1. Como as peças foram estendidas (novos campos)

### CutListItem / CutListItemComPreco (`src/core/types.ts`)

Foram adicionados apenas campos **opcionais** (nenhum campo existente foi alterado ou removido):

- **`materialId?: string`** — ID do material no CRUD (Layout Engine / MaterialLibrary v2).
- **`visualMaterial?: LayoutVisualMaterial`** — Material visual completo (cor, textureUrl, uvScale, uvRotation, roughness, metallic, normalMapUrl). Tipo `LayoutVisualMaterial` definido no mesmo ficheiro, com a mesma forma que `VisualMaterial` do MaterialLibrary v2.
- **`grainDirection?: GrainDirection`** — Direção do veio: `"horizontal"` (tampos/prateleiras), `"vertical"` (laterais/costa/portas), `"none"` (quando não definido).
- **`uvScaleOverride?: { x: number; y: number }`** — Override de escala UV por peça.
- **`uvRotationOverride?: number`** — Override de rotação UV por peça (graus).
- **`faceMaterials?: PieceFaceMaterials`** — Preparação para texturas por face: `{ top?, bottom?, left?, right?, front?, back? }`, cada um opcionalmente um `LayoutVisualMaterial`.

Foram ainda definidos os tipos auxiliares:

- **`GrainDirection`** — `"horizontal" | "vertical" | "none"`.
- **`LayoutVisualMaterial`** — Estrutura alinhada com `VisualMaterial` (color, textureUrl, uvScale, uvRotation, roughness, metallic, normalMapUrl).
- **`PieceFaceMaterials`** — Objeto com propriedades opcionais por face (top, bottom, left, right, front, back).

### CutPiece (`src/core/cutlayout/cutLayoutTypes.ts`)

Foram adicionados:

- **`visualMaterial?: LayoutVisualMaterial`** — Para uso em preview / aplicação no Viewer.
- **`uvScaleOverride?: { x: number; y: number }`**
- **`uvRotationOverride?: number`**

O campo **`grainDirection`** já existia como `"length" | "width"`; foi mantido e a conversão a partir da cutlist faz-se no `cutlistToPieces` (horizontal → length, vertical → width).

---

## 2. Como o material é resolvido para cada peça

- **Onde:** `cutlistComPrecoFromBox` em `src/core/manufacturing/cutlistFromBoxes.ts`.
- **Fluxo:**
  1. **materialId** = `getMaterialForBox(box, projectMaterialId)` (string; pode ser vazio).
  2. **visualMaterial** = se existir `materialId`, `getVisualMaterialForBox(box, projectMaterialId)`; caso contrário `getFallbackMaterial()`. Assim, cada peça da caixa recebe o mesmo material visual da caixa (CRUD + preset).
  3. Cada item da cutlist (painéis, portas, gavetas) é criado com `materialId`, `visualMaterial` e, quando aplicável, **faceMaterials: { top: visualMaterial, front: visualMaterial }** (mesmo valor do material principal).
- **Fallbacks:** Sem `materialId` → usa-se `getFallbackMaterial()` para `visualMaterial`. O preset em falta é tratado dentro de `getVisualMaterialForBox` / `getDefaultPreset()` no MaterialLibrary v2.

---

## 3. Como o grainDirection é definido

- **Painéis (modelo industrial):** Cada painel tem `orientacaoFibra: "horizontal" | "vertical"` em `boxManufacturing`. Em `cutlistComPrecoFromBox`, ao percorrer `modelo.paineis`, usa-se **`grainDirection = p.orientacaoFibra ?? "none"`** (horizontal para cima, fundo, prateleiras; vertical para laterais, costa, portas conforme já definido em `gerarPaineis`).
- **Portas e gavetas:** Não têm `orientacaoFibra` no modelo; em todos os itens de porta e gaveta é definido **`grainDirection = "none"`**.

Assim, tampos e prateleiras ficam com veio horizontal; laterais e costa com vertical; portas e gavetas com `none`.

---

## 4. Como o UV básico é calculado

- **Funções em MaterialLibrary v2** (`src/core/materials/materialLibraryV2.ts`):
  - **`getEffectiveUvScaleForPiece(piece)`** — Devolve a escala UV efetiva:
    - Se a peça tiver **`uvScaleOverride`** válido → usa esse valor.
    - Senão, se **`grainDirection === "horizontal"`** → `{ x: 2, y: 1 }`.
    - Senão, se **`grainDirection === "vertical"`** → `{ x: 1, y: 2 }`.
    - Caso contrário → `piece.visualMaterial?.uvScale ?? { x: 1, y: 1 }`.
  - **`getEffectiveUvRotationForPiece(piece)`** — Devolve a rotação UV efetiva: usa **`uvRotationOverride`** se existir e for número; senão `piece.visualMaterial?.uvRotation ?? 0`.

- **Overrides:** Se a peça tiver `uvScaleOverride` ou `uvRotationOverride`, estes têm prioridade sobre o valor do preset e sobre a regra de grain.

- **CutPiece:** Ao converter cutlist → peças 2D em `cutlistToPieces`, são passados `visualMaterial`, `uvScaleOverride` e `uvRotationOverride` para cada `CutPiece`, de modo que qualquer consumidor (ex.: preview ou nesting) possa usar `getEffectiveUvScaleForPiece` / `getEffectiveUvRotationForPiece` com a mesma lógica.

---

## 5. Preparação para texturas por face

- Na estrutura de **CutListItem** foi adicionado **`faceMaterials?: PieceFaceMaterials`** com as faces opcionais: top, bottom, left, right, front, back.
- Em **cutlistComPrecoFromBox** não se preenchem todas as faces; apenas se define **`faceMaterials: { top: visualMaterial, front: visualMaterial }`** com o mesmo `visualMaterial` principal, como preparação para no futuro diferenciar por face.
- Nenhuma lógica de CNC, PDF ou Cutlist foi alterada para usar `faceMaterials`; o tipo e o preenchimento parcial ficam disponíveis para uso futuro.

---

## 6. Ponto de extensão para Layout Preview / Viewer

- **Ficheiro:** `src/core/layout/pieceMaterialExtension.ts`.
- **Conteúdo:**
  - **`PieceMaterialPayload`** — Agrega `visualMaterial`, `grainDirection`, `uvScaleOverride`, `uvRotationOverride` e opcionalmente a peça completa (`piece`) para uso de `faceMaterials` no futuro.
  - **`ApplyPieceMaterialToPreviewFn`** — Tipo de função `(payload, target) => void` para aplicar o material visual ao alvo (ex.: mesh do preview).
  - **`setApplyPieceMaterialToPreview(fn)`** / **`getApplyPieceMaterialToPreview()`** — Registar e obter a função de extensão. Por defeito é `null`; não se exige implementação nesta etapa.
- **Uso futuro:** O Viewer ou um Layout Preview podem chamar `setApplyPieceMaterialToPreview` com uma função que, por exemplo, receba um `THREE.Mesh` em `target` e use `applyVisualMaterialToMesh` do MaterialLibrary v2 com `payload.visualMaterial` e os UV efetivos (`getEffectiveUvScaleForPiece` / `getEffectiveUvRotationForPiece`).

---

## 7. Ficheiros alterados

| Ficheiro | Alterações |
|----------|------------|
| `src/core/types.ts` | Novos tipos: `GrainDirection`, `LayoutVisualMaterial`, `PieceFaceMaterials`. Novos campos opcionais em `CutListItem`: `materialId`, `visualMaterial`, `grainDirection`, `uvScaleOverride`, `uvRotationOverride`, `faceMaterials`. |
| `src/core/materials/materialLibraryV2.ts` | Novos: `PieceWithMaterialFields`, `getEffectiveUvScaleForPiece`, `getEffectiveUvRotationForPiece`. |
| `src/core/manufacturing/cutlistFromBoxes.ts` | Import de `getVisualMaterialForBox`, `getFallbackMaterial` e tipo `GrainDirection`. Em `cutlistComPrecoFromBox`: preenchimento de `materialId`, `visualMaterial`, `grainDirection` (a partir de `p.orientacaoFibra` nos painéis; `"none"` em portas/gavetas), e `faceMaterials: { top, front }` com o material principal. |
| `src/core/cutlayout/cutLayoutTypes.ts` | Import de `LayoutVisualMaterial`. Em `CutPiece`: novos campos opcionais `visualMaterial`, `uvScaleOverride`, `uvRotationOverride`. |
| `src/core/cutlayout/cutLayoutEngine.ts` | Novo tipo `CutlistItemForPieces` com `grainDirection` (incl. horizontal/vertical/none), `visualMaterial`, `uvScaleOverride`, `uvRotationOverride`. Em `cutlistToPieces`: mapeamento de grain (horizontal→length, vertical→width) e passagem de `visualMaterial`, `uvScaleOverride`, `uvRotationOverride` para cada `CutPiece`. |
| `src/core/layout/pieceMaterialExtension.ts` | **Novo.** Tipos `PieceMaterialPayload`, `ApplyPieceMaterialToPreviewFn` e funções `setApplyPieceMaterialToPreview` / `getApplyPieceMaterialToPreview`. |
| `src/core/layout/index.ts` | Export de `pieceMaterialExtension`. |

Não foram alterados: CNC, PDF, Cutlist (apenas a origem dos dados da cutlist ganha campos opcionais), fluxo de manufacturing (boxManufacturing continua a gerar painéis com `orientacaoFibra` como antes), MaterialLibrary antiga, Viewer (apenas preparado o ponto de extensão).

---

## 8. Confirmação de que o Layout Engine continua estável

- **Cutlist e preços:** `cutlistComPrecoFromBox` e `cutlistComPrecoFromBoxes` mantêm a mesma assinatura e o mesmo fluxo de cálculo de preços e de itens; apenas se acrescentam propriedades opcionais a cada item. Quem ignora esses campos continua a funcionar como antes.
- **CutLayoutEngine:** `cutlistToPieces` aceita itens com os novos campos e repassa-os para `CutPiece`; a lógica de agrupamento, colocação e nesting usa `materialId` e espessura como antes. `grainDirection` já existia em `CutPiece`; agora é preenchido a partir de horizontal/vertical quando disponível.
- **Fallbacks:** Ausência de `materialId` ou de preset é tratada com `getFallbackMaterial()` e `getDefaultPreset()`; ausência de `grainDirection` resulta em `"none"` ou, em `getEffectiveUvScaleForPiece`, no uso do uvScale do preset.
- **Compatibilidade:** Projetos antigos e consumidores que não usam material visual, grain ou UV não são afetados; os novos campos são opcionais e a estrutura existente da cutlist e do layout de corte mantém-se estável.
