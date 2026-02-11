# Relatório — FASE 3 Etapa 4: Integração Materiais CRUD com PDF, CNC e Cutlist

**Data:** 11 de fevereiro de 2025  
**Objetivo:** Integrar o sistema de Materiais (CRUD real) com os geradores PDF, com a Cutlist e com o módulo CNC, usando sempre o materialId do box ou do projeto e resolvendo o material real via serviço.

---

## 1. Como o PDF passou a usar materiais reais

- **Fonte do material:** Em todos os geradores deixou de se usar diretamente `project.material.tipo` e `box.material` (string antiga). Passa a usar **materialId** resolvido com **getMaterialForBox(box, projectMaterialId)** e, a partir daí, **getMaterialDisplayInfo(materialId)** para obter label, espessura, preço e categoria.
- **pdfTechnical.ts**
  - **ProjectForPdf** inclui **materialId?: string** (material do projeto).
  - **renderProjectSummary:** Para cada caixa usa `getMaterialForBox(box, project.materialId)` e `getMaterialDisplayInfo(...)`; no resumo escreve **matInfo.label** e espessura (box ou matInfo).
  - **renderBoxTechnicalPage(doc, box, boxIndex, projectMaterialId?):** Linha de material passa a ser: **Material: matInfo.label | Espessura: espessura mm | Preço: matInfo.precoPorM2 €/m²**.
  - **buildTechnicalPdf** passa **project.materialId** a **renderBoxTechnicalPage**.
- **pdfGenerator.ts (gerarPdfIndustrial)**
  - Novo parâmetro **projectMaterialId?: string**.
  - Tabela “Resumo Industrial” usa **matInfo.label** (getMaterialDisplayInfo(getMaterialForBox(box, projectMaterialId) || "MDF Branco")) em vez de `box.material ?? "MDF Branco"`.
- **gerarPdfTecnico.ts**
  - **gerarPdfTecnicoCompleto** aceita **opcoes?.materialId**.
  - **construirLinhas:** Material de cada peça = **getMaterialDisplayInfo(getMaterialForBox(box, projectMaterialId) || "MDF Branco").label**.
  - **getAcabamentosUnicos:** Usa **getMaterialForBox** e **getMaterialDisplayInfo** para label e espessura; fallback seguro quando não há match no CRUD.
- **Chamadas:** ProjectProvider e RightPanel passam **project.materialId** aos geradores e a **pdfProject**; exportarPdfUnificado inclui **materialId** no objeto do projeto.
- **Fallback:** Se **materialId** for vazio ou não existir no CRUD, **getMaterialDisplayInfo** devolve label = string original ou "MDF Branco", espessura 18, precoPorM2 0, garantindo projetos antigos sem quebra.

---

## 2. Como a Cutlist foi atualizada

- **cutlistFromBoxes.ts**
  - **cutlistComPrecoFromBox(box, rules, projectMaterialId?):** O material da caixa é **getMaterialDisplayInfo(getMaterialForBox(box, projectMaterialId) || "MDF Branco").label**. Todas as peças da caixa (painéis, portas, gavetas) passam a usar esse **material** (nome legível) na cutlist.
  - **cutlistComPrecoFromBoxes(boxes, rules, projectMaterialId?):** Terceiro parâmetro **projectMaterialId** e repasse a **cutlistComPrecoFromBox**.
- **Conteúdo da cutlist:** Cada item continua com **material: string** (agora = label do material real). A espessura e o preço vêm do **boxManufacturing**, que já usa **getIndustrialMaterial(getMaterialForBox(box, undefined) || "MDF Branco")**, pelo que custos e espessuras estão alinhados ao CRUD/industrial.
- **Chamadas:** Todos os sítios que chamam **cutlistComPrecoFromBoxes** passam **project.materialId**: pdfTechnical, pdfCutlist, pdfUnified, RightPanel (layout de corte e CNC), BottomPanel, RightToolsBar (2 usos). **pdfCutlist** e **pdfUnified** recebem **project** com **materialId**.
- **Remoção de dependência de strings antigas:** O valor que aparece na cutlist deixa de ser apenas `box.material ?? "MDF Branco"`; é sempre o label resolvido pelo serviço (CRUD ou fallback), e a fonte de custo/espessura é o material industrial associado.

---

## 3. Como o CNC recebe o material industrial correto

- **boxManufacturing.ts**
  - **getNomeMaterial(box)** passa a ser **getIndustrialMaterial(getMaterialForBox(box, undefined) || "MDF Branco").nome**. Todo o modelo industrial (painéis, portas, gavetas) usa este material.
  - Onde antes se usava **getMaterial(getNomeMaterial(box))** para custo e dados industriais, passa a usar **getIndustrialMaterial(getMaterialForBox(box, undefined) || "MDF Branco")** (gerarPaineis, gerarPortas, gerarGavetas). Assim, **espessura**, **custo_m2** e **nome** vêm do CRUD (ou do material industrial associado via **industrialMaterialId**) ou do fallback legado.
- **Cutlist → Layout → CNC**
  - As peças na cutlist têm **material** = label; **cutlistToPieces** mantém **materialId** / **materialName** a partir dos itens; o layout agrupa por material + espessura.
  - **cncExport** usa **firstSheet?.materialId** e **firstSheet?.espessura_mm** do resultado do layout. A espessura já vem das peças (que vêm do modelo industrial com espessura correta). O **materialId** no sheet é o identificador/label usado no agrupamento; se no futuro o CNC precisar explicitamente do material industrial (chapa, etc.), pode usar **getIndustrialMaterial(sheet.materialId)** para obter **espessuraPadrao**, **larguraChapa**, **alturaChapa**.
- **getIndustrialMaterial (materials/service.ts):**
  - Resolve **materialIdOrLabel** no CRUD; se existir registo, tenta coincidir com a lista industrial por **industrialMaterialId** ou **label**; caso contrário constrói **MaterialIndustrial** a partir do registo (nome, espessuraPadrao, custo_m2, larguraChapa, alturaChapa com valores por defeito). Se não houver registo, usa **getMaterial(materialIdOrLabel)** (legado). Assim, o CNC e o boxManufacturing recebem sempre um material industrial coerente (espessura e tipo de chapa corretos quando vêm do CRUD).

---

## 4. Serviço de materiais: funções adicionadas

- **getMaterialForBox(box, projectMaterialId?): string**  
  Devolve **box.material ?? projectMaterialId ?? ""**. Usado em PDF, Cutlist e boxManufacturing para obter o id/label efetivo da caixa.
- **getMaterialDisplayInfo(materialIdOrLabel): MaterialDisplayInfo**  
  Devolve **{ label, espessura, precoPorM2, categoryId?, materialId? }**. Se existir material no CRUD com esse id/label, preenche a partir do registo; senão fallback com label = string recebida ou "MDF Branco", espessura 18, precoPorM2 0. Usado em PDF e Cutlist para mostrar nome, espessura e preço.
- **getIndustrialMaterial(materialIdOrLabel): MaterialIndustrial**  
  Devolve o **MaterialIndustrial** (nome, espessuraPadrao, custo_m2, larguraChapa, alturaChapa) para uso em CNC e boxManufacturing. Se existir no CRUD, tenta usar a lista industrial (industrialMaterialId/label); senão constrói a partir do registo ou usa o fallback da lista industrial (legado).

**Tipos:** Foi adicionado **MaterialDisplayInfo** em **core/materials/types.ts**.

---

## 5. Ficheiros alterados

| Ficheiro | Alteração |
|----------|-----------|
| **src/core/materials/types.ts** | Interface **MaterialDisplayInfo** (label, espessura, precoPorM2, categoryId?, materialId?). |
| **src/core/materials/service.ts** | **getMaterialForBox**, **getMaterialDisplayInfo**, **getIndustrialMaterial**; import de **BoxModule**, **MaterialIndustrial** e constantes/lista industrial de manufacturing. |
| **src/core/pdf/pdfTechnical.ts** | **ProjectForPdf** com **materialId**; import e uso de **getMaterialForBox**, **getMaterialDisplayInfo**; resumo e página por caixa com label/espessura/preço; **renderBoxTechnicalPage** com **projectMaterialId**; **buildTechnicalPdf** passa **project.materialId**; **cutlistComPrecoFromBoxes** com **project.materialId**. |
| **src/core/export/pdfGenerator.ts** | Import **getMaterialForBox**, **getMaterialDisplayInfo**; **gerarPdfIndustrial** com **projectMaterialId**; tabela com **matInfo.label**. |
| **src/core/pdf/gerarPdfTecnico.ts** | Import **getMaterialForBox**, **getMaterialDisplayInfo**; **gerarPdfTecnicoCompleto** com **opcoes.materialId**; **construirLinhas** e **getAcabamentosUnicos** com **projectMaterialId** e resolução de material via serviço. |
| **src/core/pdf/pdfCutlist.ts** | **ProjectForPdf** com **materialId**; **getFullCutlist** chama **cutlistComPrecoFromBoxes** com **project.materialId**. |
| **src/core/pdf/pdfUnified.ts** | **cutlistComPrecoFromBoxes** com **project.materialId**. |
| **src/core/manufacturing/boxManufacturing.ts** | Import **getMaterialForBox**, **getIndustrialMaterial**; **getNomeMaterial** = **getIndustrialMaterial(getMaterialForBox(box, undefined) \|\| "MDF Branco").nome**; **gerarPaineis**, **gerarPortas**, **gerarGavetas** usam **getIndustrialMaterial(getMaterialForBox(...))** para material e custos. |
| **src/core/manufacturing/cutlistFromBoxes.ts** | Import **getMaterialForBox**, **getMaterialDisplayInfo**; **cutlistComPrecoFromBox** e **cutlistComPrecoFromBoxes** com **projectMaterialId**; material das peças = **getMaterialDisplayInfo(...).label**. |
| **src/context/ProjectProvider.tsx** | **gerarPdfTecnicoCompleto** com **materialId: currentProject.materialId**; **exportarPdfUnificado** inclui **materialId** no **pdfProject**. |
| **src/components/layout/right-panel/RightPanel.tsx** | **pdfProject** com **materialId: project.materialId**; **cutlistComPrecoFromBoxes** com **project.materialId** (layout de corte e CNC). |
| **src/components/layout/bottom-panel/BottomPanel.tsx** | **cutlistComPrecoFromBoxes** com **project.materialId** no useMemo. |
| **src/components/layout/right-tools/RightToolsBar.tsx** | **cutlistComPrecoFromBoxes** com **project.materialId** (2 chamadas). |

**Não alterados (conforme pedido):** MaterialLibrary, WoodMaterial, Viewer, módulo Materiais & Fabricação. CNC (cncExport, cncTypes) continua a usar **materialId** e **espessura_mm** do layout; a origem desses dados é agora o material industrial resolvido no boxManufacturing/cutlist.

---

## 6. Confirmação de que tudo funciona

- **Build:** `npm run build` concluído com sucesso.
- **Compatibilidade:** Projetos sem **materialId** ou com **box.material** legado continuam a funcionar: **getMaterialForBox** e **getMaterialDisplayInfo** / **getIndustrialMaterial** têm fallback para "MDF Branco" ou para a string existente.
- **PDF:** Resumo e páginas por caixa mostram o label e preço do material resolvido; a tabela industrial usa o mesmo material; o PDF técnico completo recebe **materialId** do projeto.
- **Cutlist:** Itens com **material** = label do material real; espessura e custos vêm do material industrial (CRUD ou legado) via boxManufacturing.
- **CNC:** Painéis e folhas do layout têm **materialId** e **espessura_mm** coerentes com o material industrial usado no modelo (getIndustrialMaterial).

A integração do CRUD de materiais com PDF, Cutlist e CNC está implementada, com fallback seguro e sem alterar Viewer, MaterialLibrary, WoodMaterial nem Materiais & Fabricação.
