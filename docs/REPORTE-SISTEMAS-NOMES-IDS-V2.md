# 📋 Relatório Completo — Sistemas de Nomes, IDs, Códigos e QR (V2)

**Projeto:** pimo.pro / pimo-v3 (`pimo-criativo`)
**Tipo:** Auditoria exaustiva, somente-leitura — nenhum ficheiro de código foi alterado.
**Data:** 24/08/2026
**Ficheiro único criado:** este relatório (`docs/REPORTE-SISTEMAS-NOMES-IDS-V2.md`).

---

## 🎯 Objetivo

Unificar todos os sistemas de **nomes**, **identificadores (IDs)** e **códigos** do projeto, usando como referência o sistema de etiquetas industriais **LabelSystemV5** (único ponto que gera nomes corretos, completos e consistentes). Este relatório mapeia **tudo** o que existe, para depois substituir os sistemas paralelos.

---

## 📌 Conclusão executiva (V2)

1. **Não existe um gerador único de IDs.** Existem ≥ 10 geradores independentes: `makeId`, `createStableId`, `nextDesignId`, `buildId`, `createId`, `generateId`, `Date.now()+índice`, `crypto.randomUUID`, contadores locais e ids derivados por índice.
2. **Não existe um único naming de peça.** Existem ≥ 6 famílias de labels industriais (Layout PRO, etiquetas/REF, DIV/SEP, portas, gavetas, A1, cx_gav, remates, rodapés).
3. **Existe um único sistema consolidado de etiquetas/QR:** `LabelSystemV5` + `UnifiedEtiquetaEngine` + `buildEtiquetaCodeV5` + `buildEtiquetaQrPayloadV5` — a referência canónica.
4. **O `metadata.industrialLabel` é o override mais usado** (remates, rodapés, DIV/SEP, portas, gavetas, cx_gav, A1) e substitui o nome automático na etiqueta/PDF/REF.
5. **Slugs de páginas estão corretos e separados** — sistema público estável, **NÃO deve ser alterado** (apenas documentado).
6. **Divergência estrutural mais importante:** o ramo etiqueta/PDF técnico/cutlist aplica `resolveNomeIndustrialForEtiqueta` (com inversão L/R + `industrialLabel`), enquanto o ramo CNC/TCN/drill/nesting usa a cutlist base (SSOT) **sem** inversão e **sem** `industrialLabel` documental. O mesmo item pode ter nomes diferentes em artefactos diferentes.

---

## 📌 Índice

- **PARTE 1** — IDs (UUID / random36 / Date.now / contadores / prefixos)
- **PARTE 2** — Nomes industriais (lat_dir, cima, fundo, gav_frent, remate, roda_pé)
- **PARTE 3** — Nomes internos (SSOT) vs industriais
- **PARTE 4** — Códigos e QR (NQR, NCFS, payloads)
- **PARTE 5** — Slugs (projetos, caixas, peças)
- **PARTE 6** — Onde o nome da peça nasce / muda / é derivado
- **PARTE 7** — Uso do nome nos artefactos (PDF técnico, cutlist, TCN, XML, viewer, manufatura)
- **PARTE 8** — Duplicação, conflito e divergência entre nomes
- **PARTE 9** — Nomes dependentes de contexto (lado L/R, inversão, prefixos)
- **PARTE 10** — Overrides manuais (industrialLabel, nomePersonalizado)
- **PARTE 11** — Fluxo completo do nascimento de um nome → pipeline industrial
- **PARTE 12** — Recomendações técnicas para unificação futura

---
## 🧩 PARTE 1 — TODOS OS SISTEMAS DE IDs (UUID / random36 / Date.now / contadores / prefixos)

| # | Sistema | Fórmula | Localização | Exemplo real | Entidade |
|---|---|---|---|---|---|
| 1.1 | `makeId(prefix)` | `` `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,10)}` `` | `src/core/projects/projectsMappers.ts:13-15` | `proj-1729123456789-a1b2c3d4` | Projeto local/offline/sync |
| 1.2 | `getNextWorkspaceBoxId` | `` `box-${nextIndex}-${Date.now()}` `` | `src/context/projectHelpers.ts:74-84` | `box-4-1729123456789` | Caixa (workspace) |
| 1.3 | `createBox(id, …)` | recebe `box.id` externo | `src/context/projectState.ts:139-170` | `box-4-1729123456789` | Caixa (módulo) |
| 1.4 | `createStableId()` | `` `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,11)}` `` | `src/core/box/panelIds.ts:4-6` | `m7x2k9abc-2x9k8` | Painéis estruturais e arrays (cima, fundo, laterais, costa, frente_fixa, prateleiras, portas, gavetas, divisores, separadores) |
| 1.5 | `ensureBoxPanelIds` | preenche arrays/estruturais | `src/core/box/panelIds.ts:12-59` | `prateleiras:[…]` | `BoxPanelIds` de cada caixa |
| 1.6 | `nextDesignId(prefix)` | `` `${prefix}-${Date.now().toString(36)}-${_idCounter}` `` (contador global módulo) | `src/core/industrialDesigner/designModel.ts:21-26` | `design-box-lzj2k1-1`, `hole-…` | Caixa/painel/furo/constraint do designer |
| 1.7 | IDs hierárquicos painel | `` `${boxId}:${tipo}` `` | `designModel.ts:94-113` | `design-box-abc:cima`, `…:lateral-le` | Painéis estruturais do designer |
| 1.8 | `buildId(prefix,index)` | `` `${prefix}-${index+1}` `` | `src/core/manufacturing/boxManufacturing.ts:141` | `pe_plastico-1`, `PARAFUSO_3X30-2` | Ferragens/portas/gavetas (fallback) |
| 1.9 | `getStructuralPanelId` / `getArrayPanelId` | `panelIds` OU `buildId(prefix, 0/index)` | `boxManufacturing.ts:144-170` | `cima-1`, `prateleira-1` | Painéis industriais |

---
| 1.10 | `buildId` (corner) | idem 1.8 | `src/core/cornerCabinet/cornerCabinetManufacturing.ts:29` | `frente-fixa-1` | Painéis corner |
| 1.11 | `getFixedFrontPanelId` | `panelIds.frente_fixa ?? buildId("frente-fixa",0)` | `cornerCabinetManufacturing.ts:49-51` | `frente-fixa-1` | Frente fixa corner |
| 1.12 | `createId(prefix)` | UUID real via `crypto.randomUUID` OU fallback `` `${prefix}-${Date.now()}-${random36}` `` | `src/services/boxLayersService.ts:71-76` | `door-7b3c…` (UUID v4) | Camadas de portas/viewer |
| 1.13 | `generateId` (materiais) | CRUD localStorage | `src/core/materials/service.ts` | `mat-…` | Material CRUD |
| 1.14 | `makeId()` (stores) | `ind-export-${Date.now()}-${random36}` | `src/stores/industrialExportPanelStore.ts` | `ind-export-…-a1b2` | Notificação export |
| 1.15 | `makeId()` (stores) | `inv-notif-${Date.now()}-${random36}` | `src/stores/invariantNotificationStore.ts:51-52` | `inv-notif-…-a1b` | Notificação invariantes |
| 1.16 | IDs de modelo | `` `${newBoxId}-model-${Date.now()}-${i}` `` | `src/context/hooks/useBoxCrudActions.ts:477,535,602`; `useSelectionTransformActions.ts:71,89` | `box-4-…-model-…-0` | Instâncias de modelo 3D |
| 1.17 | IDs de parede | `wall-${Date.now()}-${random36}` | `src/stores/wallStore.ts:123,202` | `wall-…-4` | Paredes/room |
| 1.18 | IDs de room | `${kind}-${Date.now()}-${random36}` | `src/3d/room/RoomBuilder.ts:100` | `wall-…`, `door-…` | Elementos room |
| 1.19 | IDs de medição | `ir-${Date.now()}-${random36}` / `um-…` / `anchor-${Date.now()}` | `src/3d/viewer-engine/measurement/*` | `ir-…-a1` | Régua/medição viewer |
| 1.20 | `profile-${Date.now()}` | `src/context/hooks/useRulesActions.ts:74` | `profile-…` | Perfil de regras |
| 1.21 | `backup-${Date.now()}` | `src/context/hooks/useProjectIoActions.ts:89` | `backup-…` | Backup |
| 1.22 | UUID Three.js (runtime) | `mesh.uuid`, `geometry.uuid` | `src/3d/viewer-engine/**`, `3d/objects/**` | `…-uuid` | Malhas 3D (runtime; NÃO é identidade) |

**Observações — IDs:**
- O projeto **não usa a biblioteca `uuid`**. O único uso de `crypto.randomUUID()` real está em `src/services/boxLayersService.ts:72`.
- Todos os outros “UUID-like” são `Date.now() + Math.random().toString(36)`.
- Existem **3 esquemas de estabilidade** para o mesmo painel: (a) `panelIds` (UUID-like persistido), (b) `buildId(prefixo, indice)` fallback determinístico, (c) `nextDesignId` (contador global `_idCounter` ascendente, instável entre sessões).
- IDs de fabrico (`buildId`) usam **prefixo + nº sequencial**, formato semelhante aos labels industriais — mas `buildId` é chave técnica, enquanto os labels industriais são nomes documentais.

---
## 🧩 PARTE 2 — SISTEMAS DE NOMES INDUSTRIAIS (lat_dir, cima, fundo, gav_frent, remate, roda_pé…)

### 2.1 — Núcleo: `cutLayoutProPieceNaming.ts` (Layout de Corte PRO)
**Ficheiro:** `src/core/cutlayout/cutLayoutProPieceNaming.ts`
**Estrutura do nome:** `<prefixoCaixa>_<prefixoPeca>` → `buildCutLayoutProPartName` (linha 112-120).

**Mapa `TIPO_TO_PREFIX` (linha 6-25)** — usado quando há `item.tipo`:

| tipo (SSOT) | prefixo industrial | | tipo (SSOT) | prefixo industrial |
|---|---|---|---|---|
| `lateral_direita` | `lat_dir` | | `gaveta_frente_int` | `gav_frent_int` |
| `lateral_esquerda` | `lat_esq` | | `gaveta_frente_ext` | `gav_frent_ext` |
| `gaveta_frente` | `gav_frent` | | `gaveta_lat_esq` | `gav_lat_esq` |
| `gaveta_fundo` | `gav_fun` | | `gaveta_lat_dir` | `gav_lat_dir` |
| `gaveta_traseira` | `gav_cost` | | `cima` | `top` |
| `fundo` | `fun` | | `COSTA` | `cos` |
| `prateleira` | `pra` | | `porta_simples` | `por_sim` |
| `porta_dupla` | `por_dup` | | `porta_correr` | `por_cor` |
| `remate` | `rem` | | `rodape` | `rod_pe` |

**Mapa `NOME_PT_TO_PREFIX` (linha 27-44)** — usado quando o prefixo é derivado de `item.nome` (PT):
`lateral esquerda→lat_esq`, `lateral direita→lat_dir`, `gaveta frente→gav_frent`, `gaveta frente interna→gav_frent_int`, `gaveta frente externa→gav_frent_ext`, `gaveta fundo→gav_fun`, `gaveta lateral esquerda→gav_lat_esq`, `gaveta lateral direita→gav_lat_dir`, `gaveta traseira→gav_cost`, `gaveta costas→gav_cost`, `cima→top`, `topo→top`, `fundo→fun`, `base→bas`, `costa→cos`, `prateleira→pra`.

**Fallback genérico (linha 102-109):** `sanitizeToken` + slug NFD (remove acentos) até 24 chars, default `pec`.

**Prefixo da caixa (`buildBoxPrefixForCutLayoutPro`, linha 82-91):**
1. `prefixFromBoxDisplayName(boxNome)` → 1.ª letra da 1.ª palavra + último número → `C1` (linha 60-71).
2. Se projeto auto (`isLikelyAutoGeneratedProjectName`, linha 51-57): usa o próprio nome NP → `NP2624622`.
3. Senão `prefixFromCustomProjectName` (linha 73-80): até 3 letras (sem acentos), default `PRJ`.

**Exemplos reais de output:**
- Caixa `Caixa 1`, peça `cima` → `C1_top`
- Projeto `NP2624622`, caixa `Caixa Forno`, peça separador → `NP2624622_sep`

### 2.2 — Nome industrial para etiqueta (com inversão L/R)
**Ficheiro:** `cutLayoutProPieceNaming.ts` linhas 162-172 (`buildIndustrialPieceName`) e 178-188 (`resolveIndustrialPieceRef`).
- Aplica `applyIndustrialLabelSideInversion` (linha 139-156): `lateral_esquerda → lateral_direita` e vice-versa — apenas para REF/etiqueta de fabrico.
- `resolveIndustrialPieceRef` (linha 178-188): usa `metadata.industrialLabel` se existir, senão `buildIndustrialPieceName`, e devolve em **MAIÚSCULAS**.

### 2.3 — Nome completo `PROJETO_CAIXA_PECA` (faixa inferior v5)
**Ficheiro:** `src/core/etiquetas/industrialDisplayName.ts`
- `sanitizeIndustrialSegment` (linha 7-14): espaços→`_`, remove não-alfanuméricos, colapsa `_`.
- `buildV5BottomStripIndustrialName` (linha 20-58): monta `{PROJETO}_{CAIXA}_{PECA}`; se o industrial já começa por `PROJETO_`, devolve tal qual; se começa pelo prefixo da caixa, faz strip e reconstrói com o nome completo da caixa.
  - Ex.: `ANTONIO_NOVO_5_CC4_REMATE_L_B_01` (visto no QR de teste).

---
### 2.4 — Famílias especializadas de labels industriais (geradores separados)

| Família | Função | Ficheiro:linha | Formato | Exemplo |
|---|---|---|---|---|
| DIV/SEP | `buildDivSepIndustrialLabel` | `src/core/divSep/labels.ts:2-14` | `{BOX}_{DIV\|SEP}_{nn}` | `Armario_Test_DIV_01` |
| Portas (hinge) | `resolveDoorIndustrialLabel` | `src/core/doors/doorLabels.ts:104-109` | `port_dir`, `port_esq`, `port_cima`, `port_baix` | `port_esq` |
| Portas (UI) | `resolveDoorLabel` | `doorLabels.ts:95-101` | `Porta Direita`, `Porta Esquerda`, `Porta Cima`, `Porta Baixa` | `Porta Esquerda` |
| Gavetas | `buildDrawerIndustrialLabel` | `src/core/drawers/drawerIndustrialLabels.ts:18-31` | `{BOX}_{token}_{nn}` | `BoxA_gav_lat_esq_01` |
| Gavetas A1 | `buildA1DrawerIndustrialLabel` | `src/core/innerCabinet/a1Naming.ts:32-39` | `{BOX}_a_1_cx_gav_{n}_{token}` | `A1BOX_a_1_cx_gav_1_fren` |
| Carcaça A1 | `buildA1CarcassIndustrialLabel` | `a1Naming.ts:24-29` | `{BOX}_a_1_{cx_cima\|cx_fundo\|cx_lat_dir\|cx_lat_esq\|cx_comp_40}` | `A1BOX_a_1_cx_cima` |
| cx_gav | `buildCxGavIndustrialLabel` | `src/core/cxGav/cxGavGeometry.ts:107-117` | `{BOX}_{cx_gav_lat_dir\|cx_gav_lat_esq\|cx_gav_fun\|cx_gav_cima}` | `CX1_cx_gav_cima` |
| Remates | `buildRemateIndustrialLabel` | `src/core/remate/labels.ts:65-77` | `{BOX}_REMATE_{suffix}_{nn}` | `Armario_Test_REMATE_DIR_01` |
| Remates (suffix) | `resolveRemateIndustrialSuffix` | `remate/labels.ts:17-48` | `DIR`, `ESQ`, `CIMA`, `BAIXO`, `FRENTE`, `L_ext`, `RODAPE_L_A/B`, `TAMPO` | `REMATE_L_ext` |
| Rodapés | `buildRodapeIndustrialLabel` | `src/core/rodape/labels.ts:15-19` | `{BOX}_RODA_PE_{nn}` | `Armario_Test_RODA_PE_01` |
| Registry industrial | `resolveIndustrialPieceLabel` | `src/core/industrialAdmin/industrialModelsRegistry.ts:209-215` | labels por modelo (cx_gav, A1) | `CX GAV lateral direita` |
| Fallback `PIECE_LABELS` | `getPieceLabel` | `src/core/manufacturing/boxManufacturing.ts:214` | `resolveIndustrialPieceLabel(tipo) ?? PIECE_LABELS[tipo] ?? tipo` | `cima` |

**Tokéns industriais de gaveta (`DRAWER_PIECE_INDUSTRIAL_TOKEN`, `drawerIndustrialLabels.ts:4-12`):**
`gaveta_frente_int→gav_frent_int`, `gaveta_frente_ext→gav_frent_ext`, `gaveta_lat_esq→gav_lat_esq`, `gaveta_lat_dir→gav_lat_dir`, `gaveta_traseira→gav_cost`, `gaveta_fundo→gav_fun`, `gaveta_frente→gav_frent`.

**Sanitizadores duplicados (mesmo algoritmo em vários ficheiros):**
- `sanitizeRemateBoxName` (`remate/labels.ts:6-14`)
- `sanitizeRodapeBoxName` (`rodape/labels.ts:4-12`)
- `sanitizeBoxName` A1 (`innerCabinet/a1Naming.ts:14-22`)
- inline em `divSep/labels.ts:7-11`, `drawerIndustrialLabels.ts:23-28`, `cxGavGeometry.ts:111-116`
- `sanitizeIndustrialSegment` (`etiquetas/industrialDisplayName.ts:7-14`)
- `sanitizeFilenamePart` (drillExport)

**Conclusão PARTE 2:** o mesmo tipo de peça pode ter **até 3 prefixos diferentes** conforme o pipeline:
- `gaveta_frente` → `gav_frent` (Layout PRO) / `fren` (A1) / `gav_frent` (drawer label)
- `lateral_esquerda` → `lat_esq` (Layout PRO, invertido para etiqueta) / `cx_lat_esq` (A1) / `gav_lat_esq` (gaveta)
- `porta_simples` → `por_sim` (Layout PRO) / `port_dir` / `port_esq` (doorLabels)

---
## 🧩 PARTE 3 — NOMES INTERNOS (SSOT) vs NOMES INDUSTRIAIS

### 3.1 — O que é o SSOT de uma peça em `ProjectState`
- `item.id` — chave técnica estável (UUID-like) que **nunca deve mudar**.
- `item.nome` — nome PT/UI (ex.: `"Lateral Esquerda"`, `"Prateleira"`, personalizado).
- `item.tipo` — tipo semântico canónico (ex.: `lateral_esquerda`, `cima`, `gaveta_frente`, `remate`).
- `item.boxId` — caixa a que pertence.
- `item.metadata` — metadados, incluindo **`metadata.industrialLabel`** (override industrial) e `metadata.labelNumber` (nº QR).

### 3.2 — Diferenças entre SSOT e nomes industriais

| Propriedade | SSOT (cutlist/UI/viewer) | Nome industrial (etiqueta/REF/PDF) |
|---|---|---|
| Fonte | `item.nome` / `item.tipo` | `metadata.industrialLabel` ?? `buildIndustrialPieceName` |
| Caso | legível (PT, case original) | MAIÚSCULAS em `resolveIndustrialPieceRef`; mixed no display v5 |
| Lados do módulo | `lateral_esquerda` = ESQ (sem inversão) | **invertidos** (`lat_dir` para `lateral_esquerda`) |
| Separadores | espaço `' '` | `_` |
| Acentos | mantém | removidos (NFD) |
| Caixa | `box.nome` completo | prefixo `C1`/NP/3 letras |
| Conjunto | cutlist de caixa | `PROJETO_CAIXA_PECA` completo |

### 3.3 — Pontos onde `nome` é sobrescrito pela cutlist industrial
1. `cutlistItemsWithCutLayoutProNames` (`cutLayoutProPieceNaming.ts:192-211`): se `metadata.industrialLabel` existir, o `nome` passa a ser esse; senão `buildCutLayoutProPartName`.
2. `drawerCutlistAdapter.ts:154-168`: `const industrialLabel = …; return { ...item, nome: industrialLabel, industrialLabel }` — o `nome` **é substituído** pelo label industrial da gaveta.
3. `cxGavCutlistAdapter.ts:79-100`: idem para cx_gav (`nome: industrialLabel`).
4. `innerCabinet/a1CutlistAdapter.ts:127`: idem A1.
5. `cutlistFromBoxes.ts:528,539,543`: `industrialLabel` atribuído a DIV/SEP/portas via `metadata`.

### 3.4 — SSOT digitais (materiais, regras, etiquetas)
- **Regras/etiquetas:** `rules.labelV5`, `rules.etiqueta`, `rules.qrcode`, `settings.etiquetasQr` foram substituídos por `LabelSystemV5` (schema em `src/core/labelSystem/LabelSystemV5.ts`) resolvido por `resolveLabelSystemConfig` (`src/core/labelSystem/resolveLabelSystemConfig.ts`).
- **QR/número label:** `src/core/qrcode/panelLabelNumber.ts` — `resolveAuthoritativeLabelNumber` é o SSOT do número de etiqueta.
- **NQR unificado:** `src/core/pdf/industrialListQr.ts:16` — `resolveIndustrialListNqr` delega para `resolveUnifiedEtiquetaQrCode` (`etiquetas/qr/etiquetaQr.ts:31`).

---
## 🧩 PARTE 4 — SISTEMAS DE CÓDIGOS E QR (NQR, NCFS, payloads)

### 4.1 — Código display v5 (`buildEtiquetaCodeV5`)
**Ficheiro:** `src/core/etiquetas/qr/etiquetaCodeV5.ts` (linha 101)
- Formato: `[LETRAS][NUM_CAIXA_3]-[SEQ]` — ex. **`NCFS003-6`** (NCFS = sigla de `NP2624622_Caixa_Forno_SEP_03`).
- `extractProjectSigla()` (linha 27): 1.ª letra de cada palavra (até 11 chars).
- `buildIndustrialShortCodeFromFullName()` (linha 63): letras dos tokens do nome completo industrial.
- `formatNumCaixa3Digits(totalPiecesInSheet)` (linha 52): 3 dígitos — **nota:** `totalPiecesInSheet` é usado como “num caixa” (ver divergências PARTE 8).

### 4.2 — QR canónico v5 (`buildEtiquetaQrPayloadV5`)
**Ficheiro:** `src/core/etiquetas/qr/etiquetaCodeV5.ts` (linha 132)
- Formato: `{industrialPieceRef}-{seq}` → **`ANTONIO_NOVO_5_CC4_REMATE_L_B_01-6`**.
- `industrialPieceRef` vem de `resolveIndustrialPieceRef` (nome industrial MAIÚSCULO).
- **Consumido em:** `usePieceData.ts`, `etiquetaQr.ts`, `resolveProjetosIndustrialRef.ts`, QR/PDF/etiqueta.

### 4.3 — NQR unificado (listas/PDF/TCN filenames)
- **Ficheiro:** `src/core/pdf/industrialListQr.ts:16` — `resolveIndustrialListNqr` delega para `resolveUnifiedEtiquetaQrCode` (mesmo código v5 das etiquetas).
- Consumidores: `gerarPdfTecnico.ts:243`, `pdfCutlist.ts:145`, `financeiroPecasBuilder.ts:271`, `drillExport` (nomes de ficheiro XML), PDF de listas industriais.

### 4.4 — Código curto legacy (`generateEtiquetaCode` / shortCode)
**Ficheiro:** `src/core/qrcode/qrcodeService.ts` (linha 47)
- Formato: `{projeto 3-5} {caixa 2} {peça 3} {número 2-3}` em lowercase, máx. 14 chars — ex. `np2624622cacim01`.
- `getPieceLabel` (linha 29): `P-{nnn}`.
- `attachQrCodesToCutlist` (linha 204): grava `pieceNumber`, `shortCode`, `qrSvg` em cada item; prioridade: `metadata.labelNumber` > `pieceNumber` > sufixo do shortCode.
- `buildLocalQrPayload` (linha 83): assembly do payload a partir do nome.

### 4.5 — Config SSOT etiquetas (`LabelSystemV5`)
- **Ficheiro:** `src/core/labelSystem/LabelSystemV5.ts` + `resolveLabelSystemConfig.ts`
- `qrPolicy: "v5" | "short" | "dual"` decide que QR impresso (renderer `pdfEtiquetas.ts:881-892`).
- **Substitui** `rules.labelV5`, `rules.etiqueta`, `rules.qrcode`, `settings.etiquetasQr`, `designer localStorage`.

### 4.6 — Número de etiqueta (SSOT)
- **Ficheiro:** `src/core/qrcode/panelLabelNumber.ts:57-65` — `resolveAuthoritativeLabelNumber`: `metadata.labelNumber`/`qrNumber` → `pieceNumber` → sufixo numérico do shortCode.
- `assignUniqueEtiquetaNumbers` / `assertUniqueEtiquetaNumbers` (`engine/nestingLabelOrder.ts`) garantem unicidade.

### 4.7 — Slugs de páginas (URL) — **documentado, NÃO alterar**
| Ficheiro | Função | Exemplo |
|---|---|---|
| `src/app/PROJETOS/projetosPageSlug.ts:7` | `toProjetosPageSlug("Antunes Novo Cozinha")` → `Antunes_Novo_Cozinha` | URL `/PROJETOS/Antunes_Novo_Cozinha` |
| `projetosFocusSlug.ts:36-38` | `toProjetosBoxSlug(box.nome)` | `cx_1` |
| `projetosFocusSlug.ts:40-59` | `remateTipoToPieceSlug`, `rodapeKindToPieceSlug`, `uniqueSlug` | `remate_cima`, `rodape_l1`, `peca_2` |
| `projetosFocusSlug.ts:91-102` | `uniqueSlug` (desambiguador `_2`, `_3`…) | `caixa_1_2` |
| `projetosFocusSlug.ts:248-254` | `buildProjetosFocusPath` → `/PROJETOS/{projeto}/{caixa}/{peca}` | URL final |

---
## 🧩 PARTE 5 — SLUGS (projetos, caixas, peças) — documentado, NÃO alterar

| Ficheiro | Função | Exemplo |
|---|---|---|
| `src/app/PROJETOS/projetosPageSlug.ts:7` | `toProjetosPageSlug("Antunes Novo Cozinha")` → `Antunes_Novo_Cozinha` | URL `/PROJETOS/Antunes_Novo_Cozinha` |
| `src/app/PROJETOS/projetosFocusSlug.ts:36-38` | `toProjetosBoxSlug(box.nome)` | `cx_1` |
| `projetosFocusSlug.ts:40-59` | `remateTipoToPieceSlug`, `rodapeKindToPieceSlug`, `uniqueSlug` | `remate_cima`, `rodape_l1`, `peca_2` |
| `projetosFocusSlug.ts:248-254` | `buildProjetosFocusPath` → `/PROJETOS/{projeto}/{caixa}/{peca}` | URL final |

### 5.2 — Slugs derivados de nomes
| Item | Função | Exemplo |
|---|---|---|
| slug de caixa | `toProjetosBoxSlug(boxNome)` | `cx_gav_1` |
| slug de peça cutlist | `cutlistPieceSlug` → `piecePrefixForCutLayoutPro` | `top`, `lat_esq`, `rem` |
| slug de remate | `rematePieceSlug` | `remate_l`, `remate_cima` |
| slug de rodapé | `rodapePieceSlug` | `rodape_l1` |
| desambiguador | `uniqueSlug` (linha 91-102) | `cx_1_2` |
| resolver URL → dados | `resolveProjetosFocusFromSegments` (linha 287-339) | `{boxId, pieceId, boxSlug, pieceSlug}` |

**Conclusão:** os slugs (URLs) estão **corretos** e separados dos IDs — são camada pública estável e **NÃO devem ser usados como identidade de negócio**.

---
## 🧩 PARTE 6 — ONDE O NOME DA PEÇA NASCE, MUDA OU É DERIVADO

### 6.1 — Nascimento (criação)
| Ponto | Ficheiro:linha | O que cria |
|---|---|---|
| Nome de projeto auto `NP…` | `src/context/projectState.ts:108-114` | `np2624622` (ano2+dia+mês+hora) |
| Nome de caixa | `createBox` (`projectState.ts:139`) | nome passado pelo utilizador |
| `item.nome` SSOT por tipo | geradores de corte: `cutlistFromBoxes.ts` | `"Lateral Esquerda"`, `"Prateleira"`… |
| `metadata.industrialLabel` | `cutlistFromBoxes.ts:528-543`, `drawerCutlistAdapter.ts:154`, `cxGavCutlistAdapter.ts:79`, `a1CutlistAdapter.ts:127` | label industrial especializado |

### 6.2 — Derivação (nomes autocalculados)
| Função | Ficheiro:linha | Derivado de |
|---|---|---|
| `buildCutLayoutProPartName` | `cutLayoutProPieceNaming.ts:112` | `boxPrefix` + `piecePrefix` (tipo/nome) |
| `buildV5BottomStripIndustrialName` | `industrialDisplayName.ts:20` | projeto + caixa + nome industrial |
| `resolveIndustrialPieceRef` | `cutLayoutProPieceNaming.ts:178` | `industrialLabel` OU `buildIndustrialPieceName` (MAIÚSCULAS) |
| `buildA1DrawerIndustrialLabel` | `a1Naming.ts:32` | box + índice + token |
| `buildDrawerIndustrialLabel` | `drawerIndustrialLabels.ts:18` | box + token + índice |

### 6.3 — Modificação (sobrescrita)
| Ponto | Ficheiro:linha | Comportamento |
|---|---|---|
| `nomePersonalizado` (remate/rodapé) | `remate/labels.ts:104-112`, `rodape/labels.ts:46-50` | substitui o label automático na UI/cutlist |
| `metadata.industrialLabel` | `industrialDisplayName.ts:76-79` | substitui `buildIndustrialPieceName` na etiqueta/REF |
| `applyIndustrialPieceEdits` | `fabrication/buildCutlistItemsForIndustrialExport.ts:55-62` | aplica edições manuais do utilizador ao `nome`/`tipo` da peça na exportação |
| `applyIndustrialLabelSideInversion` | `cutLayoutProPieceNaming.ts:139-156` | inverte `tipo`/`nome` de laterais **só** para etiqueta (não altera SSOT) |

---
## 🧩 PARTE 7 — USO DO NOME DA PEÇA NOS ARTEFACTOS

| Artefacto | Como o nome entra | Ficheiro:linha | Observação |
|---|---|---|---|
| **PDF Etiqueta v5** | `resolveNomeIndustrialForEtiqueta` + `buildV5BottomStripIndustrialName` + `resolveEtiquetaDisplayCodeV5` | `src/core/pdf/pdfEtiquetas.ts:894,1010-1023`; `etiquetas/qr/etiquetaQr.ts:46` | usa `industrialLabel` e inversão L/R |
| **QR v5** | `resolveIndustrialPieceRef` + `buildEtiquetaQrPayloadV5` | `pdfEtiquetas.ts:871-925`; `etiquetaCodeV5.ts:132` | MAIÚSCULAS |
| **PDF Técnico** | `resolveIndustrialListNqr` + `resolveObservacoesForCutListItem` | `src/core/pdf/gerarPdfTecnico.ts:243` | coluna N.º QR |
| **Cutlist PDF** | `resolveIndustrialListNqr` + `resolveIndustrialPieceRef` | `src/core/pdf/pdfCutlist.ts:144-145` | item `nome` pode ser industrialLabel |
| **TCN (CNC)** | cutlist — `item.id` / `item.nome` via `generateTcnForPanel` | `src/core/cnc/tcnGenerator.ts:485`, `tcnGeneratorV2New.ts:134` | usa nome/tipo da cutlist base (SSOT), **sem** inversão/override documental |
| **XML drill/TX XML** | `resolveIndustrialPieceRef` para nome; `panelFileNameFromPiece` para filename | `src/core/drill/drillExport.ts:107-133` | filename = QR v5 (`resolveIndustrialListNqr`) OU `PROJETO_CAIXA_PECA` fallback |
| **Routing máquina** | heurística por `tipo`/`nome` (`resolveXmlMachineTarget`) | `src/core/drill/xmlMachineRouting.ts:93-150` | classifica CNC vs DRILL |
| **Cutlist / nesting** | `item.nome` SSOT (com industrialLabel se presente) | `src/core/cutlayout/**`, `layoutPipeline.ts` | parte/base do layout |
| **Viewer** | `item.nome` / `metadata.frontPieceName` | `DrawerFactory.ts:289`; `PimoViewerContext` | usa SSOT, não industrial |
| **Fabricação/exportação** | `buildCutlistItemsForIndustrialExport` + `applyIndustrialPieceEdits` | `src/core/fabrication/buildCutlistItemsForIndustrialExport.ts:27-62` | junta cutlist + extraídos + remates + rodapés + edits |
| **Artefactos arquivo** | `sanitizeIndustrialSlug` + `{slug}_{tipo}.pdf/xlsx` | `src/core/fabrication/industrialProjectArtifacts.ts:1-45` | nomes de ficheiro a partir do nome do projeto |
| **Ferragens / financeiro** | `resolveIndustrialListNqr` | `financeiroPecasBuilder.ts:271` | coluna NQR |
## 🧩 PARTE 8 — DUPLICAÇÃO, CONFLITO E DIVERGÊNCIA ENTRE NOMES

### 8.1 — Duplicações (mesmo gerador em vários ficheiros)
| Ficheiro | Duplicado de | Risco |
|---|---|---|
| `src/core/cutlayout/cutLayoutProPieceNaming.ts` | tabelas `TIPO_TO_PREFIX` vs `NOME_PT_TO_PREFIX` vs tokens de gaveta/A1 | um tipo várias saídas |
| `buildDivSepIndustrialLabel` (`divSep/labels.ts`) | `drawerIndustrialLabels` | ambos usam padrão `BOX_token_nn` mas com tokens distintos |
| `buildDrawerIndustrialLabel` (`drawerIndustrialLabels.ts`) | tokens A1 (`a1Naming.ts:41-48`) | `gaveta_frente` → `gav_frent` vs `fren` |
| `buildRodapeIndustrialLabel` | `resolveRemateIndustrialSuffix` | sufixos `RODAPE_L_A/B` vs `RODA_PE_nn` |
| Registry `resolveIndustrialPieceLabel` | `PIECE_LABELS` (`boxManufacturing.ts`) vs tabelas especializadas | mesma família de peças com labels diferentes |

### 8.2 — Conflitos reais observados
1. **`metadata.industrialLabel` vs automático**: num override, todos os downstream usam o override; sem ele, usam `buildIndustrialPieceName` — dois caminhos para a mesma peça.
2. **Inversão L/R**: `buildIndustrialPieceName` embute `applyIndustrialLabelSideInversion` (etiqueta/REF), mas **não** no CNC/TCN/nesting — a mesma peça sai `lat_dir` na etiqueta e `lat_esq` no cutlist/TCN.
3. **`NUM_CAIXA` vs `totalPiecesInSheet`**: `buildEtiquetaCodeV5` usa `totalPiecesInSheet` (nº de peças na folha) como dígito de caixa; o payload v5 usa `pieceSeq` — os dois números podem divergir.
4. **`pieceNumber` vs `shortCode` vs `metadata.labelNumber`**: três fontes de número com precedência definida em `panelLabelNumber.ts:57-65`, mas `shortCode` pode ficar desatualizado se `nome` mudar.

### 8.3 — Sanitizadores duplicados
| Função | Ficheiro | Comportamento |
|---|---|---|
| `sanitizeIndustrialSegment` | `etiquetas/industrialDisplayName.ts:7-14` | espaços→`_`, remove não-alfanuméricos |
| `sanitizeRemateBoxName` | `remate/labels.ts:6-14` | idem + max 32 |
| `sanitizeRodapeBoxName` | `rodape/labels.ts:4-12` | idem + max 32 |
| `sanitizeBoxName` A1 | `a1Naming.ts:14-22` | idem + max 32 |
| inline DIV/SEP | `divSep/labels.ts:7-11` | idem + max 32 |
| inline drawer | `drawerIndustrialLabels.ts:23-28` | idem + max 32 |
| inline cx_gav | `cxGavGeometry.ts:111-116` | idem + max 32 |
| `sanitizeFilenamePart` | `drillExport.ts` | filenames |

**Conclusão PARTE 8:** existe **duplicação generalizada** de prefixos, sanitizadores e geradores. **Não há 1 única tabela canónica** `TIPO → PREFIXO`; cada família tem a sua, e o mesmo tipo pode gerar nomes diferentes por pipeline.

---
## 🧩 PARTE 9 — NOMES DEPENDENTES DE CONTEXTO (lado L/R, inversão, prefixos, sufixos, NUM_CAIXA)

### 9.1 — Dependência de contexto
| Contexto | Onde | Regra | Exemplo |
|---|---|---|---|
| **Lado do módulo** | `cutLayoutProPieceNaming.ts:129-156` | `lateral_esquerda` → `lat_esq` (na etiqueta) MAS `lateral_direita` fica **sem inversão** na cutlist/TCN | `lateral_esquerda` → `porta_esq` |
| **Inversão L/R** | `applyIndustrialLabelSideInversion` | **só para etiqueta/REF** — `tipo`/`nome` invertidos; cutlist/CNC **não** invertem | `lat_dir` (etiqueta) vs `lat_esq` (cutlist) |
| **`item.tipo`** | gerador de peça | `gaveta_frente` → `gav_frent` (Layout) vs `fren` (A1) vs `gav_frent` (gaveta) | tokens divergentes |
| **Prefixo da caixa** | `buildBoxPrefixForCutLayoutPro` (linha 82-91) | `C1`, `NP`, 3 letras do projeto | `C1_top`, `NP2624622_sep` |
| **Sufixo remate** | `resolveRemateIndustrialSuffix` | `DIR`, `ESQ`, `CIMA`, `BAIXO`, `FRENTE`, `L_ext`, `RODAPE_L_A/B`, `TAMPO` | `REMATE_DIR_01` |
| **Sufixo rodapé** | `rodape/labels.ts` | `_nn` incrementado por caixa | `RODA_PE_01` |
| **Índice de gaveta** | `buildDrawerIndustrialLabel` | `{BOX}_{token}_{idx-1based:2d}` | `BoxA_gav_frent_02` |
| **`totalPiecesInSheet`** | `buildEtiquetaCodeV5` | dígito de caixa (3) derivado do nº de peças na folha | `NCFS003-6` |

---

### 9.2 — Sobrescritas/overrides
| Ponto | Ficheiro:linha | Efeito |
|---|---|---|
| **nomePersonalizado (remate)** | `remate/labels.ts:109-111` | substitui o label automático na UI/cutlist |
| **nomePersonalizado (rodapé)** | `rodape/labels.ts:51-53` | idem |
| **`metadata.industrialLabel`** | `etiquetas/industrialDisplayName.ts:76-79` | substitui `buildIndustrialPieceName` na etiqueta/REF |
| **`applyIndustrialPieceEdits`** | `fabrication/buildCutlistItemsForIndustrialExport.ts:55-62` | edits manuais ao `nome`/`tipo` na exportação |
| **`applyIndustrialLabelSideInversion`** | `cutLayoutProPieceNaming.ts:139-156` | inverte `tipo`/`nome` de lados **só na etiqueta** |

---

## 🧩 PARTE 10 — OVERRIDES MANUAIS (industrialLabel, nomePersonalizado, número)

### 10.1 — `metadata.industrialLabel`
- **Aplicado em:** `etiquetas/industrialDisplayName.ts:76-79` (`resolveNomeIndustrialForEtiqueta`), `cutlayout/cutLayoutProPieceNaming.ts:183-186,203-205` (`resolveIndustrialPieceRef`, `cutlistItemsWithCutLayoutProNames`).
- **Quem seta:** `cutlistFromBoxes.ts:528-543` (DIV/SEP, portas), `drawerCutlistAdapter.ts:154-168`, `cxGavCutlistAdapter.ts:79-100`, `a1CutlistAdapter.ts:127`, geradores de remates/rodapés.
- **Efeito:** substitui o nome automático; guardado em `metadata` para persistir.

### 10.2 — `nomePersonalizado` (remates/rodapés)
- **Ficheiros:** `remate/labels.ts:104-112` (`resolveRematePieceDisplayName`), `rodape/labels.ts:46-53`.
- Sempre que `nomePersonalizado` estiver presente, o nome na UI/cutlist passa a ser esse; o `industrialLabel` **não é sobrescrito** (preservado) — ver testes `remateIndustrialIntegration.test.ts:129,148` e `rodapeIndustrialIntegration.test.ts:156,175`.

### 10.3 — `applyIndustrialPieceEdits` (edits do utilizador)
- **Ficheiro:** `src/core/industrial/IndustrialPieceEditsService.ts` (consumido em `buildCutlistItemsForIndustrialExport.ts:55`).
- Permite ao utilizador renomear/re-tipar peças; aplicado **antes** do attachQr? Não — é aplicado **depois** do `attachQrCodesToCutlist` (o QR pode ficar com o nome antigo → divergência).

### 10.4 — Número da etiqueta
- Prioridade canónica em `panelLabelNumber.ts:57-65`; mas `assignUniqueEtiquetaNumbers` em `etalabelOrder` pode reatribuir números se a ordem de nesting mudar — `metadata.labelNumber` pode divergir do novo número impresso.

---

*Fim parcial — continua na PARTE 11 e 12.*
## 🧩 PARTE 11 — FLUXO COMPLETO: COMO UM NOME NASCE E COMO É USADO NO PIPELINE INDUSTRIAL

```text
[1] Projeto criado
    └─ formatAutoProjectName() → "NP2624622"        (projectState.ts:108)
    └─ toProjetosPageSlug() → "NP2624622" (URL)     (projetosPageSlug.ts:7)

[2] Caixa criada
    └─ getNextWorkspaceBoxId() → "box-4-1729…"      (projectHelpers.ts:82)
    └─ ensureBoxPanelIds() → panelIds UUID-like      (panelIds.ts:12)

[3] Cutlist paramétrica
    └─ cutlistComPrecoFromBox(box)                   (cutlistFromBoxes.ts)
    │   └─ gerarPaineis() → PainelIndustrial[] com   id via getStructuralPanelId/getArrayPanelId
    │       e `tipo` SSOT (ex.: "cima", "lateral_esquerda")
    └─ attachQrCodesToCutlist()                      (qrcodeService.ts:204)
        └─ pieceNumber + shortCode + qrSvg

[4] Nome industrial (derivação)
    └─ buildCutLayoutProPartName(item, boxNome, project)      (cutLayoutProPieceNaming.ts:112)
    │    = boxPrefix (C1 | NP | 3 letras) + "_" + piecePrefix (lat_dir | top | gav_frent | …)
    ├─ [families] buildDrawerIndustrialLabel / buildA1… / buildCxGav… / buildDivSep… / buildRemate… / buildRodape…
    │    → gravam em metadata.industrialLabel       (cutlistFromBoxes.ts:528-543 etc.)

[5] Etiqueta v5 (UEE)
    └─ resolveNomeIndustrialForEtiqueta(item)        (industrialDisplayName.ts:71)
    │    = metadata.industrialLabel  ??  buildIndustrialPieceName (com inversão L/R)
    ├─ resolveEtiquetaDisplayCodeV5 → buildEtiquetaCodeV5 → "NCFS003-6"   (etiquetaCodeV5.ts:101)
    ├─ resolveUnifiedEtiquetaQrCode → buildEtiquetaQrPayloadV5
    │    = {industrialPieceRef}-{seq}               (etiquetaCodeV5.ts:132)
    └─ pdfEtiquetas.ts:1010 → buildV5BottomStripIndustrialName
         → "ANTONIO_NOVO_5_CC4_REMATE_L_B_01" (faixa inferior)

[6] Artefactos (usam o nome)
    ├─ PDF Técnico / Cutlist PDF: resolveIndustrialListNqr (industrialListQr.ts:16)
    ├─ TCN (CNC): usa cutlist base (item.nome/tipo), sem inversão  (tcnGenerator.ts:485)
    ├─ XML drill: panelFileNameFromPiece → QR v5  (drillExport.ts:124-133)
    ├─ Routing máquina: resolveXmlMachineTarget por tipo/nome  (xmlMachineRouting.ts:93)
    ├─ Exportação industrial: buildCutlistItemsForIndustrialExport → applyIndustrialPieceEdits
    │        (buildCutlistItemsForIndustrialExport.ts:27-62)
    └─ Viewer: usa SSOT (item.nome), não industrial

[7] Página PROJETOS
    └─ buildProjetosFocusCatalog → slug caixa/peça → URL /PROJETOS/{proj}/{box}/{piece}
         (projetosFocusSlug.ts:110-246)
```

**Pontos críticos do fluxo:**
- O `nome` SSOT (`item.nome`) e o `industrialLabel` divergem a partir do passo [4].
- A **inversão L/R** acontece só no ramo [5] etiqueta/REF; o [6] TCN/CNC e o [7] viewer usam SSOT sem inversão.
- `applyIndustrialPieceEdits` é aplicado **depois** do QR [3]/[5], logo os edits do utilizador **não** são refletidos no QR já gerado.

---

## 🧩 PARTE 12 — RECOMENDAÇÕES PARA UNIFICAÇÃO FUTURA (sem implementar nada)

1. **Criar um gerador único de IDs de domínio** (ex.: `createStableId(prefixo, namespace)`) usado por projeto, caixa, painel, designer, remate, rodapé, material e work orders — mantendo compatibilidade de leitura com os formatos atuais (migração idempotente).
2. **Criar UMA tabela canónica `TIPO → PREFIXO industrial`** em `LabelSystemV5` (ou `industrialNaming.ts`), consumida por Layout PRO, etiqueta, cutlist, TCN/XML e viewer — eliminando as tabelas paralelas (`TIPO_TO_PREFIX`, `DRAWER_PIECE_INDUSTRIAL_TOKEN`, `A1_DRAWER_TIPO_TO_TOKEN`, `pieceLabels`, `INDUSTRIAL_CODES`).
3. **Um único resolver de nome industrial** (`resolveIndustrialPieceName`) com parâmetro declarativo `{ invertSides?: boolean; useIndustrialLabel?: boolean }` — hoje `buildIndustrialPieceName`/`resolveIndustrialPieceRef`/`resolveNomeIndustrialForEtiqueta` são 3 wrappers que podem divergir.
4. **Unificar sanitizadores** (acentos, espaços, hífen, underscore, limite de 32 chars) num único módulo `sanitizeIndustrialToken`, eliminando as 8 cópias.
5. **Tornar a inversão L/R explícita e testável**: uma função `invertLateralForManufacture(tipo, orientacao)` declarada no SSOT, com testes de paridade (cutlist ↔ etiqueta ↔ TCN ↔ drill).
6. **Definir a semântica de `NUM_CAIXA` vs `pieceSeq` vs `totalPiecesInSheet`** — hoje o mesmo número tem 3 interpretações; decidir se o QR é `{ref}-{seqPeca}` e o display é `{ref}-{seqCaixa}`.
7. **Preservar slugs de páginas** como camada pública estável; ligá-los ao novo resolver apenas por `ProjectIdentity` (id persistente + nome + slug), nunca substituindo IDs por slugs.
8. **Documentar `industrialLabel` como override explícito** com origem (`generated | specialized | documentary | manual`) e auditável, e decidir se afeta apenas apresentação ou também identidade industrial.
9. **Aplicar `applyIndustrialPieceEdits` ANTES de `attachQrCodesToCutlist`** para o QR/etiqueta refletirem renomeações.
10. **Testes de contrato multi-artefacto**: mesmo projeto/caixa/peça → verificar igualdade (ou divergência esperada) em cutlist, etiqueta, QR, PDF técnico, TCN, XML, viewer e página.
11. **`resolveAuthoritativeLabelNumber` como único SSOT do número**; `assignUniqueEtiquetaNumbers` deve escrever de volta em `metadata.labelNumber` para nunca divergir.

---

## ✅ CHECKLIST DE AUDITORIA (tudo verificado por leitura)

| Item do pedido | Coberto em |
|---|---|
| 1. Sistemas de IDs | PARTE 1 |
| 2. Nomes industriais | PARTE 2 |
| 3. SSOT vs industriais | PARTE 3 |
| 4. Códigos/QR | PARTE 4 |
| 5. Slugs | PARTE 5 (documentado, não alterar) |
| 6. Onde o nome nasce/muda/deriva | PARTE 6 |
| 7. Nome → artefactos | PARTE 7 |
| 8. Duplicação/divergência | PARTE 8 |
| 9. Nomes dependentes de contexto | PARTE 9 |
| 10. Overrides manuais | PARTE 10 |
| Fluxo completo | PARTE 11 |
| Recomendações | PARTE 12 |

---

*Fim do relatório V2. Auditoria exclusivamente de leitura e documentação; nenhum ficheiro de código foi alterado.*
