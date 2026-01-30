# Relatório de Auditoria Técnica — PIMO v3

**Data:** 2025  
**Objetivo:** Revisão profunda da arquitetura, identificação de problemas, limpeza de código e base sólida para próximas fases.

---

## 1. Arquitetura atual (visão geral)

### 1.1 Organização do projeto

```
src/
├── 3d/                    # Viewer 3D e geometria
│   ├── core/              # Viewer.ts, câmera, cena, controls, lights
│   ├── materials/         # MaterialLibrary, WoodMaterial
│   ├── objects/           # BoxBuilder (paramétricas)
│   └── viewer/            # PimoViewerClean (não usado na app principal)
├── components/            # UI React
│   ├── layout/            # Workspace, LeftPanel, RightPanel, etc.
│   ├── admin/             # CADModelsManager, MaterialsManager, etc.
│   ├── panels/            # CutlistPanel, RulesPanel
│   └── ui/                # CutListView, Panel, Cube, etc.
├── context/               # Estado global e providers
│   ├── ProjectProvider.tsx, projectState.ts, projectTypes.ts
│   ├── PimoViewerContext.tsx, PimoViewerContextCore.ts
│   └── materialContext.tsx, useMaterial.ts
├── core/                  # Lógica de negócio
│   ├── calculator/        # woodCalculator
│   ├── design/            # generateDesign, ferragens, acessorios
│   ├── glb/               # extractPartsFromGLB, glbPartsToCutList
│   ├── layout/            # layoutWarnings, viewerLayoutAdapter
│   ├── manufacturing/     # boxManufacturing, cutlistFromBoxes
│   ├── pricing/           # pricing
│   ├── rules/             # validation, modelRules
│   └── templates/         # templates
├── hooks/                 # useCalculadoraSync, useCadModelsSync, usePimoViewer, etc.
├── pages/                 # App routes: Documentation, Documentacao, AdminPanel, etc.
├── theme/                 # ThemeProvider, themes
└── utils/                 # storage, units
```

### 1.2 Principais módulos e responsabilidades

| Módulo | Responsabilidade |
|--------|------------------|
| **ProjectProvider + projectState** | Estado do projeto (workspaceBoxes, boxes derivados, cut list, resultados, undo/redo). Single source of truth: `workspaceBoxes` → `boxes` (BoxModule[]) via `buildBoxesFromWorkspace`. |
| **PimoViewerContext** | Regista o viewer 3D (usePimoViewer) para RightPanel/Workspace usarem `highlightBox`, `setTransformMode`, etc. |
| **Viewer.ts (3d/core)** | Cena 3D: addBox, updateBox, addModelToBox, reflowBoxes, TransformControls, raycast para seleção. Paramétricas (BoxBuilder) e CAD-only (grupo + GLB). |
| **useCalculadoraSync** | Sincroniza `project.boxes` + `project.workspaceBoxes` com o Viewer: addBox/updateBox/removeBox, index a partir de workspaceBoxes, position/rotation só quando manualPosition. |
| **useCadModelsSync** | Sincroniza `workspaceBoxes[].models` com o Viewer: addModelToBox/removeModelFromBox quando o viewer está pronto. |
| **Workspace** | Monta usePimoViewer, useCalculadoraSync, useCadModelsSync; onModelLoaded (extração GLB → cut list, setWorkspaceBoxDimensoes para CAD-only); onBoxTransform → updateWorkspaceBoxTransform. |
| **RightPanel** | Lista caixas, seleção, Mover/Rodar (viewerApi.setTransformMode), highlightBox. |
| **Cut list** | Derivada de design paramétrico + extractedPartsByBoxId (GLB). Agregação em projectState. |

### 1.3 Fluxo de caixas (paramétricas vs CAD-only)

- **Paramétricas:** workspaceBox → BoxModule (prateleiras/gavetas/porta) → design → cut list. Viewer: BoxBuilder (geometria). Reflow usa bbox do mesh para width.
- **CAD-only:** workspaceBox com models[] e sem prateleiras/gavetas. Viewer: grupo vazio + addModelToBox(GLB). Dimensões placeholder até GLB carregar → setWorkspaceBoxDimensoes → sync → updateBox → reflow. Cut list vem de extractedPartsByBoxId (GLB).

---

## 2. Problemas encontrados

### 2.1 Código morto ou pouco utilizado

| Problema | Ficheiros | Impacto |
|----------|-----------|---------|
| **PimoViewerClean** nunca importado na aplicação principal | `src/3d/viewer/PimoViewerClean.ts` | Código morto; confusão se for confundido com o Viewer real. |
| **ViewerApi (projectTypes) vs PimoViewerApi (PimoViewerContextCore)** | `projectTypes.ts`, `PimoViewerContextCore.ts`, `useViewerSync.ts` | useViewerSync regista uma API (saveSnapshot, enable2DView, renderScene) que **não é a do Viewer usado**. O Workspace regista o PimoViewer em PimoViewerContext, não em useViewerSync. Logo `viewerSync.saveViewerSnapshot()`, `enable2DView`, `renderScene` chamam `viewerApiRef.current?.…` que está sempre null. Funcionalidades de snapshot/2D/render na UI não têm efeito. |
| **updateWorkspaceBoxPosition** é alias de **updateWorkspacePosition** | `ProjectProvider.tsx`, `projectTypes.ts` | Duplicação de nome e ação; um deles poderia ser removido ou documentado como alias. |
| **ThreeViewer** (componente) recebe props não utilizadas em test-viewer | `pages/test-viewer.tsx`, `components/ThreeViewer.tsx` | test-viewer passa `cubeCount`, `cubeSize`, `animationEnabled`, `materialId`; ThreeViewer não usa essas props. Comportamento de teste pouco claro. |

### 2.2 Inconsistências e riscos

| Problema | Ficheiros | Impacto |
|----------|-----------|---------|
| **Duas páginas de documentação** | `Documentation.tsx` (inglês/sistema) e `Documentacao.tsx` (português) | Ambas em rotas diferentes; possível duplicação de conteúdo e manutenção. |
| **Referências a caminhos incorretos** | `Documentation.tsx`, `Documentacao.tsx` | Textos referem "src/components/three/ThreeViewer.tsx" mas o ficheiro está em `src/components/ThreeViewer.tsx`. |
| **createBox** em projectState | `projectState.ts` | createBox é usado internamente em convertWorkspaceToBox; não é exportado. Nome próximo de createWorkspaceBox pode confundir. |
| **Rotação/posição em WorkspaceBox** | `core/types.ts` | Campos `rotacaoY_90` (boolean) e `rotacaoY` (radianos) coexistem; toggle vs valor contínuo pode gerar inconsistência se ambos forem escritos. |

### 2.3 Fragilidades no fluxo

| Problema | Descrição |
|----------|-----------|
| **Reflow só para CAD quando dimensões mudam** | Paramétricas não disparam reflow ao mudar dimensões; apenas ao mudar index. Se no futuro se quiser “colar” após redimensionar, é preciso estender a condição. |
| **Dependência de ordem de efeitos** | useCalculadoraSync e useCadModelsSync dependem de viewerReady e da ordem de render; se viewerReady atrasar ou mudar, pode haver um frame com caixas sem modelos ou vice-versa. |
| **Placeholder 100x100x100 para CAD-only** | Até o GLB carregar, as dimensões são 100 mm; reflow usa isso. Se muitos CAD-only carregarem ao mesmo tempo, posições podem “saltar” quando as dimensões reais chegarem. |

### 2.4 Outros

| Problema | Ficheiros |
|----------|------------|
| **DevPimoTest / DevActionsTest** | Componentes de desenvolvimento com console.log e lógica de teste; convém manter apenas em builds de dev ou atrás de flag. |
| **materialContext vs project.material** | Material do projeto está em state (project.material); existe também materialContext. Verificar se há duplicação de conceito ou se são para coisas diferentes (projeto vs UI tema/material). |

---

## 3. Melhorias aplicadas nesta auditoria

### 3.1 Limpeza de logs de diagnóstico

- **Removidos** todos os `console.log` de diagnóstico em:
  - `src/3d/core/Viewer.ts` (addBox, updateBox, reflowBoxes)
  - `src/hooks/useCalculadoraSync.ts` (sync, workspaceBoxes ordem, box)
- **Mantido** um eventual log em `DevPimoTest.tsx` por ser componente de desenvolvimento.

### 3.2 Limpeza em reflowBoxes

- **Removido** o mapa `boxIdByEntry` e o loop que o preenchia em `Viewer.reflowBoxes()`; eram usados apenas para logs já removidos, portanto código morto.

### 3.3 Resumo antes/depois

| Antes | Depois |
|-------|--------|
| Vários console.log no Viewer e no sync | Viewer e sync sem logs de diagnóstico |
| reflowBoxes construía boxIdByEntry sem uso | reflowBoxes sem estruturas auxiliares desnecessárias |

---

## 4. Sugestões para o futuro

### 4.1 Prioridade alta

1. **Unificar Viewer “registado” com viewerSync**  
   Ou o Viewer principal (usePimoViewer) implementa e regista em useViewerSync as funções saveSnapshot / restoreSnapshot / enable2DView / disable2DView / renderScene, ou essas funções são removidas da UI (RightToolsBar, etc.) para não dar a ilusão de que funcionam.

2. **Documentar ou remover PimoViewerClean**  
   Se não for usado: remover ou mover para exemplo/teste. Se for usado noutro contexto: documentar e garantir que não se confunde com Viewer.ts.

3. **Clarificar updateWorkspacePosition vs updateWorkspaceBoxPosition**  
   Unificar numa única ação ou documentar explicitamente que um é alias do outro e onde cada um é usado.

### 4.2 Prioridade média

4. **Consolidar páginas de documentação**  
   Avaliar fusão de Documentation e Documentacao ou separação clara (uma técnica, outra utilizador) e corrigir referências a caminhos (ex.: ThreeViewer).

5. **test-viewer e ThreeViewer**  
   Alinhar props: ou ThreeViewer passa a aceitar cubeCount/cubeSize/animation/materialId e usa-as, ou test-viewer deixa de as passar.

6. **Reflow ao mudar dimensões paramétricas**  
   Se o produto exigir que, ao redimensionar uma caixa paramétrica, as outras se reposicionem para continuar “coladas”, considerar `reflowNeeded = indexChanged || dimensionsChanged` (e testar impacto em performance e UX).

### 4.3 Prioridade baixa

7. **Nomes createBox vs createWorkspaceBox**  
   Renomear ou comentar createBox para deixar claro que é interno à conversão workspace → BoxModule.

8. **rotacaoY_90 vs rotacaoY**  
   Definir um único conceito (ex.: apenas radianos) e migrar a UI para não escrever os dois de forma inconsistente.

9. **Material: project.material vs materialContext**  
   Esclarecer responsabilidades (projeto vs tema/visual) para evitar duplicação ou estado divergente.

---

## 5. Pontos críticos que podem causar bugs

- **viewerSync desconectado do viewer real:** Botões de vista 2D e de captura de imagem não fazem nada enquanto a API registada em useViewerSync for null.
- **Ordem e timing dos efeitos (sync vs viewerReady):** Qualquer alteração que mude quando viewerReady fica true ou a ordem de useCalculadoraSync/useCadModelsSync pode provocar caixas sem modelos ou modelos sem caixa.
- **Index vs ordem de workspaceBoxes:** O index usado no reflow vem de `workspaceBoxes.findIndex` no sync; reordenar lista noutro sítio sem refletir em workspaceBoxes quebra o alinhamento.
- **manualPosition e posição no estado:** Se alguma ação escrever posição (x_mm, z_mm) sem definir manualPosition = true, o reflow pode sobrescrever a posição no próximo sync.

---

## 6. Resumo final

- **Arquitetura:** Estado em ProjectProvider (workspaceBoxes → boxes); Viewer em Workspace via usePimoViewer; sincronização com useCalculadoraSync e useCadModelsSync; cut list e preços derivados em projectState.
- **Problemas tratados:** Remoção de logs de diagnóstico e de código morto (boxIdByEntry) em Viewer e useCalculadoraSync.
- **Problemas identificados (não alterados):** PimoViewerClean não usado; viewerSync sem API registada (snapshot/2D/render inativos); duplicação updateWorkspacePosition/updateWorkspaceBoxPosition; duas páginas de doc e referências a caminhos errados; test-viewer com props não usadas.
- **Recomendações:** Ligar o viewer real a useViewerSync ou remover funcionalidades que dependem dele; limpar ou documentar PimoViewerClean; unificar/ documentar ações de posição; corrigir referências e props de documentação e test-viewer.

Este relatório pode ser usado como base para tarefas de refatoração e para evitar regressões nas áreas indicadas.
