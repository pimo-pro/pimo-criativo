# Arquitetura Multi-Box

Este documento descreve o módulo MultiBoxManager e o fluxo de dados entre Workspace, ProjectContext e Viewer 3D.

## Visão Geral

O sistema multi-box permite gerenciar múltiplas caixas no workspace 3D, com sincronização bidirecional entre o estado do projeto (ProjectContext) e o viewer (Three.js).

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  ProjectContext │────▶│ MultiBoxManager  │────▶│     Viewer      │
│ (workspaceBoxes)│     │ (orquestra sync) │     │ (3d/core)       │
└─────────────────┘     └──────────────────┘     └─────────────────┘
        ▲                         │
        │                         │ addBox, removeBox
        └─────────────────────────┘ (delega a actions)
```

## Módulos

### Viewer (3d/core/Viewer.ts)

Interface para múltiplos boxes:

| Método | Descrição |
|--------|-----------|
| `addBox(id, options)` | Registra nova caixa (paramétrica ou CAD-only) |
| `removeBox(id)` | Remove caixa e libera recursos |
| `updateBox(id, options)` | Atualiza dimensões, posição, rotação |
| `setBoxIndex(id, index)` | Reordena (reflow automático) |
| `setBoxGap(gap)` | Espaço entre caixas em reflow |
| `addModelToBox(boxId, path, modelId)` | Carrega GLB dentro da caixa |
| `removeModelFromBox(boxId, modelId)` | Remove modelo da caixa |
| `listModels(boxId)` | Lista modelos na caixa |
| `selectBox(id)` | Define caixa ativa (highlight) |

**Estado interno:**
- Múltiplos modelos por caixa
- Seleção de box ativo
- Posição, rotação e dimensões independentes por caixa

### MultiBoxManager (core/multibox/)

**Localização:** `src/core/multibox/`

**Arquivos:**
- `types.ts` — MultiBoxViewerApi, MultiBoxManagerApi, MultiBoxEvent
- `multiBoxManager.ts` — useMultiBoxManager
- `index.ts` — re-exportações

**Responsabilidades:**
1. Armazenar/obter lista de boxes via `ProjectContext.workspaceBoxes`
2. Emitir operações para o viewer via `useCalculadoraSync` e `useCadModelsSync`
3. Sincronizar com o ProjectContext

**API exposta (MultiBoxManagerApi):**
- `addBox()` — delega a `actions.addWorkspaceBox()`
- `removeBox(boxId)` — delega a `actions.removeWorkspaceBoxById(boxId)`
- `selectBox(boxId)` — delega a `actions.selectBox(boxId)`
- `listBoxes()` — retorna `project.workspaceBoxes`
- `viewerReady` — indica se o viewer está pronto

### Workspace

- Inicializa o MultiBoxManager com `useMultiBoxManager({ viewerApi, project, actions })`
- O manager orquestra a sincronização internamente
- Conecta ao viewerApiAdapter (snapshot, 2D, render) e PimoViewerContext

## Fluxo de Dados

### ProjectContext → Viewer

1. `project.workspaceBoxes` e `project.boxes` mudam
2. `useCalculadoraSync` (dentro do manager) compara com estado anterior
3. Chama `viewerApi.addBox`, `viewerApi.updateBox`, `viewerApi.removeBox`
4. `useCadModelsSync` sincroniza modelos GLB por caixa

### UI → ProjectContext → Viewer

1. Usuário clica "Adicionar caixa" → `actions.addWorkspaceBox()`
2. ProjectContext atualiza `workspaceBoxes` e recalcula `boxes`
3. O efeito do manager detecta a mudança e chama `viewerApi.addBox`

### Viewer → ProjectContext

1. Usuário arrasta caixa no viewer → `onBoxTransform`
2. Workspace chama `actions.updateWorkspaceBoxTransform(boxId, { x_mm, y_mm, z_mm, rotacaoY_rad })`
3. ProjectContext atualiza `workspaceBoxes`

## Convenções de Nomenclatura

| Termo | Uso |
|-------|-----|
| **box** / **caixa** | Unidade modular no workspace (armário, módulo) |
| **workspaceBox** | Representação no estado (WorkspaceBox) |
| **BoxModule** | Caixa com design calculado (cut list, estrutura) |
| **viewerApi** | API do Viewer exposta via usePimoViewer |
| **manager** | MultiBoxManager (orquestração) |

## Checklist para Integração Futura

- [ ] **Múltiplos boxes**: ✅ Já suportado
- [ ] **Controles sincronizados**: ✅ Via ProjectContext e manager
- [ ] **Iluminação consistente**: ✅ Via constants/viewerOptions
- [ ] **Expor manager via contexto**: Opcional — UI pode usar `actions` ou `useMultiBoxManagerContext`
- [ ] **Duplicar caixa**: `actions.duplicateWorkspaceBox` — já existe
- [ ] **Undo/Redo com snapshot do viewer**: TODO no viewerApiAdapter
- [ ] **Vistas 2D (top, front, left)**: TODO no viewerApiAdapter
- [ ] **Renderização para imagem**: TODO no viewerApiAdapter

## Estrutura de Pastas

```
src/
├── core/
│   ├── multibox/
│   │   ├── types.ts
│   │   ├── multiBoxManager.ts
│   │   └── index.ts
│   └── viewer/
│       └── viewerApiAdapter.ts
├── hooks/
│   ├── usePimoViewer.ts
│   ├── useCalculadoraSync.ts
│   └── useCadModelsSync.ts
├── components/
│   └── layout/
│       └── workspace/
│           └── Workspace.tsx
└── 3d/
    └── core/
        └── Viewer.ts
```
