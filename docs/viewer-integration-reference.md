# Referência: Integração do Viewer 3D

Este documento descreve a arquitetura do viewer 3D e prepara a integração com o módulo pimo-criativo.

## Estrutura de Módulos

| Módulo | Localização | Propósito |
|--------|-------------|-----------|
| **Viewer** | `src/3d/core/Viewer.ts` | Engine 3D principal: cena, câmera, controles, boxes, modelos GLB |
| **usePimoViewer** | `src/hooks/usePimoViewer.ts` | Hook que instancia o Viewer e expõe a API |
| **PimoViewerContext** | `src/context/PimoViewerContext.tsx` | Contexto para registar o viewer ativo (Workspace) |
| **useViewerSync** | `src/hooks/useViewerSync.ts` | Sincronização viewer ↔ ProjectContext (snapshot, 2D, render) |
| **viewerApiAdapter** | `src/core/viewer/viewerApiAdapter.ts` | Adapta PimoViewerApi para ViewerApi |
| **viewerOptions** | `src/constants/viewerOptions.ts` | Opções padronizadas (iluminação, controles) |

## Fluxo de Integração

```
App (viewerOptions)
    └── Workspace
            ├── usePimoViewer(containerRef, options)  →  viewerApi
            ├── PimoViewerContext.registerViewerApi(viewerApi)
            └── viewerSync.registerViewerApi(createViewerApiAdapter(viewerApi))
```

## Nomenclatura

- **Viewer**: classe principal em `3d/core/Viewer.ts`
- **PimoViewer**: prefixo para API React (usePimoViewer, PimoViewerContext, PimoViewerApi)
- **ViewerApi**: interface para snapshot/2D/render (ProjectContext)
- **PimoViewerApi**: interface para operações de boxes (addBox, updateBox, etc.)

## Preparação para Integração

### Múltiplos boxes

O Viewer já suporta múltiplos boxes via `addBox`, `removeBox`, `updateBox`, `setBoxIndex`, `setBoxGap`. O reflow automático posiciona boxes lado a lado.

### Controles sincronizados

- **PimoViewerContext**: componentes (LeftPanel, RightPanel, PainelModelosDaCaixa) usam `viewerApi` para operar no viewer
- **useCalculadoraSync** / **useCadModelsSync**: sincronizam project.workspaceBoxes com o viewer

### Iluminação consistente

As opções estão centralizadas em `constants/viewerOptions.ts`:
- `DEFAULT_VIEWER_OPTIONS`: controles (damping, distâncias, ângulos)
- `VIEWER_BACKGROUND`: cor de fundo (#0f172a)

Workspace e DevActions usam essas constantes.

### Extensões pendentes (TODO no viewerApiAdapter)

- `saveSnapshot` / `restoreSnapshot`: serializar estado da câmera para undo/redo
- `enable2DView` / `disable2DView`: vistas ortográficas (top, front, left, right)
- `renderScene`: captura estática da cena para exportação de imagem

## Páginas que usam o Viewer

| Página | Rota | Viewer |
|--------|------|--------|
| Home (Workspace) | `/` | usePimoViewer + PimoViewerContext + viewerSync |
| DevActions | `/dev-actions` | usePimoViewer (sem contexto; painel de testes) |
| DevPimoTest | `/dev-test` | usePimoViewer (sem contexto; testes automáticos) |

## CADModelsManager

Usa `ThreeViewer` (componente auxiliar) para pré-visualização de modelos no painel de administração. Não utiliza o viewer principal do Workspace.
