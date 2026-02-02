/**
 * Secções do Índice de Funcionalidades no Painel de Referência.
 * Ficheiro modular para facilitar atualizações e expansão.
 */

export type DocSection = {
  title: string;
  description: string;
  internals: string;
  files: string[];
  interactions: string;
  notes?: string;
};

export const painelReferenciaSections: DocSection[] = [
  {
    title: "Sistema de múltiplos caixotes",
    description: "Gerencia vários módulos independentes por projeto.",
    internals: "Cada caixote é um BoxModule com dimensões, espessura, prateleiras e cut list próprias.",
    files: ["src/core/types.ts", "src/context/ProjectProvider.tsx"],
    interactions: "UI seleciona caixote ativo e recalcula dados por módulo.",
  },
  {
    title: "MultiBoxManager",
    description: "Orquestra sincronização entre ProjectContext e Viewer 3D.",
    internals:
      "Local: src/core/multibox/. Arquivos: types.ts (MultiBoxViewerApi, MultiBoxManagerApi, MultiBoxEvent), " +
      "multiBoxManager.ts (hook useMultiBoxManager), index.ts (re-exports). " +
      "Responsabilidades: sincronizar ProjectContext.workspaceBoxes com o Viewer; encaminhar operações via " +
      "useCalculadoraSync e useCadModelsSync; API: addBox, removeBox, selectBox, listBoxes. " +
      "Fluxo: Workspace → MultiBoxManager → Viewer.",
    files: [
      "src/core/multibox/types.ts",
      "src/core/multibox/multiBoxManager.ts",
      "src/core/multibox/index.ts",
      "src/components/layout/workspace/Workspace.tsx",
      "docs/multibox-architecture.md",
    ],
    interactions: "Workspace inicializa useMultiBoxManager; addBox/removeBox delegam a ProjectContext.actions.",
    notes: "Ver docs/multibox-architecture.md para diagrama, convenções e checklist.",
  },
  {
    title: "Viewer — Suporte Multi-Box",
    description: "Interface do Viewer (3d/core/Viewer.ts) para múltiplos boxes.",
    internals:
      "Métodos: addBox, removeBox, updateBox; setBoxIndex, setBoxGap; " +
      "addModelToBox, removeModelFromBox, listModels; selectBox. Estado: múltiplos modelos por caixa, seleção ativa, posição/dimensões independentes.",
    files: ["src/3d/core/Viewer.ts", "src/context/PimoViewerContextCore.ts"],
    interactions: "Expõe API via usePimoViewer; recebe operações do MultiBoxManager.",
  },
  {
    title: "Arquitetura Atual do Projeto",
    description: "Estrutura de pastas, fluxos principais, módulos críticos e ligações entre contexts/managers.",
    internals:
      "Conteúdo em architectureIndex.ts. Funções: addAutoSection, addAutoLink, getAutoSections, getAutoLinks, clearAutoSections, clearAutoLinks. " +
      "Painel consome apenas architectureIndex (sem redundâncias). Sidebar: IntersectionObserver MIN_RATIO 0.1, rootMargin -8% -50%, " +
      "thresholds até 1.0; role list/listitem, aria-label, aria-current, data-painel-nav-list; teclado ↑↓ Home End Enter Space/Spacebar; aria-orientation não aplicado (role list).",
    files: ["src/core/docs/architectureIndex.ts", "src/pages/PainelReferencia.tsx"],
    interactions: "Painel consome architectureIndex; sidebar usa PANEL_NAV_ITEMS para scroll suave às secções.",
  },
  {
    title: "ViewerToolbar e Tools3DToolbar",
    description: "Toolbar superior do Viewer com ações (PROJETO, SALVAR, 2D, etc.) e ferramentas 3D (Select, Move, Rotate).",
    internals:
      "ViewerToolbar: ícones pequenos com tooltips; aciona viewerApiAdapter via ToolbarModalContext. " +
      "Tools3DToolbar: emite tool:select, tool:move, tool:rotate (Scale, Orbit, Pan preparados). " +
      "toolbarConfig.ts define VIEWER_TOOLBAR_ITEMS e TOOLS_3D_ITEMS.",
    files: ["src/components/layout/viewer-toolbar/ViewerToolbar.tsx", "src/components/layout/viewer-toolbar/Tools3DToolbar.tsx", "src/constants/toolbarConfig.ts"],
    interactions: "ToolbarModalContext conecta ViewerToolbar aos modais em RightToolsBar.",
  },
  {
    title: "UnifiedPopover e StepperPopover",
    description: "Sistema unificado de popovers para steppers (Prateleiras, Gavetas) e seleções (Tipo de porta).",
    internals: "UnifiedPopover: trigger, children, align. StepperPopover: label, value, onChange, min, max.",
    files: ["src/components/ui/UnifiedPopover.tsx"],
    interactions: "Usado em LeftPanel para Prateleiras, Gavetas e Tipo de porta.",
  },
  {
    title: "Gestor de Ficheiros",
    description: "Estrutura de pastas (textures/, hdr/, etc.), ocultar por padrão, bloqueio de upload .php.",
    internals: "fileManagerConfig.ts: FILE_MANAGER_VISIBLE_ITEMS, FILE_MANAGER_HIDDEN_BY_DEFAULT, isUploadBlocked.",
    files: ["src/constants/fileManagerConfig.ts", "src/components/admin/FileManager.tsx"],
    interactions: "Admin Panel → Gestor de Ficheiros.",
  },
  {
    title: "Painel de Referência (página dedicada)",
    description: "Página própria em /painel-referencia com estatísticas, phase atual e changelog.",
    internals: "src/pages/PainelReferencia.tsx; secções em core/docs/painelReferenciaSections.ts.",
    files: ["src/pages/PainelReferencia.tsx", "src/core/docs/painelReferenciaSections.ts", "src/App.tsx"],
    interactions: "Botão no Header redireciona para a página.",
  },
  {
    title: "Nome editável por caixote",
    description: "Permite renomear cada módulo.",
    internals: "O nome é armazenado no BoxModule e atualizado no ProjectProvider.",
    files: ["src/context/ProjectProvider.tsx", "src/components/layout/left-panel/LeftPanel.tsx"],
    interactions: "UI atualiza o estado e mantém seleção.",
  },
  {
    title: "Cálculo do caixote (costa fixa 10mm)",
    description: "COSTA com espessura fixa de 10 mm; CIMA e FUNDO são a base estrutural.",
    internals: "Altura das laterais = altura_total - (espessura_cima + espessura_fundo). COSTA sempre 10 mm; não mostrar espessura ao lado do nome.",
    files: ["src/core/design/generateDesign.ts"],
    interactions: "Cut list alimenta pricing e exportação.",
  },
  {
    title: "Prateleiras com cálculo automático",
    description: "Permite qualquer número de prateleiras por caixote.",
    internals: "Cada prateleira gera uma peça com largura interna e espessura do caixote.",
    files: ["src/core/design/generateDesign.ts", "src/components/layout/left-panel/LeftPanel.tsx"],
    interactions: "Altera cut list e preço.",
  },
  {
    title: "Ferragens dinâmicas",
    description: "Suportes de prateleira são adicionados automaticamente.",
    internals: "Cada prateleira adiciona 4 suportes na lista de ferragens do caixote.",
    files: ["src/core/design/ferragens.ts", "src/context/ProjectProvider.tsx"],
    interactions: "Ferragens alimentam precificação e changelog.",
  },
  {
    title: "Cut list por caixote",
    description: "Cada módulo tem sua própria lista de cortes.",
    internals: "A geração ocorre por BoxModule e o PDF é gerado por caixote.",
    files: ["src/context/ProjectProvider.tsx", "src/core/pricing/pricing.ts"],
    interactions: "UI e exportação usam a cut list do caixote selecionado.",
  },
  {
    title: "Duplicar / remover / renomear caixotes",
    description: "Operações básicas de gestão de módulos.",
    internals: "ProjectProvider cria, duplica, remove e renomeia BoxModule.",
    files: ["src/context/ProjectProvider.tsx", "src/components/layout/left-panel/LeftPanel.tsx"],
    interactions: "Recalcula dados após cada ação.",
  },
  {
    title: "UI do LeftPanel e RightPanel",
    description: "Entradas de configuração e ações principais.",
    internals: "LeftPanel controla dados, RightPanel aciona geração e exibe resultados.",
    files: ["src/components/layout/left-panel/LeftPanel.tsx", "src/components/layout/right-panel/RightPanel.tsx"],
    interactions: "Conectado ao ProjectProvider.",
  },
  {
    title: "Phase Atual no Painel de Referência",
    description: "Resumo automático da fase ativa do roadmap.",
    internals: "Calcula progresso da fase e progresso global do projeto.",
    files: ["src/pages/PainelReferencia.tsx", "src/core/docs/projectRoadmap.ts"],
    interactions: "Atualiza quando fases/tarefas são alteradas.",
  },
  {
    title: "Fase 4: Dynamic Rules & Smart Behaviors",
    description: "Regras dinâmicas por modelo GLB, auto-positioning, snapping e UI de gestão.",
    internals: "Módulo core/rules com tipos, validação e armazenamento.",
    files: ["src/core/rules/", "docs/dynamic-rules-reference.md"],
    interactions: "Admin → Regras; violações no painel Modelos.",
    notes: "Ver docs/dynamic-rules-reference.md.",
  },
  {
    title: "Fase 5: Smart Layout Engine",
    description: "Auto-positioning, colisões, Smart Arrangement e controlo de layout.",
    internals: "core/layout, viewerLayoutAdapter, layoutWarnings, smartArrange.",
    files: ["src/core/layout/", "docs/smart-layout-reference.md"],
    interactions: "Painel Modelos: Auto-Organizar, Snap, Reset.",
    notes: "Ver docs/smart-layout-reference.md.",
  },
  {
    title: "Viewer Sync e viewerApiAdapter",
    description: "Fluxo de sincronização Viewer ↔ ProjectContext.",
    internals: "useViewerSync, createViewerApiAdapter; snapshot/2D/render com stubs.",
    files: ["src/hooks/useViewerSync.ts", "src/core/viewer/viewerApiAdapter.ts", "src/components/layout/workspace/Workspace.tsx"],
    interactions: "Workspace regista adapter em viewerSync e PimoViewerContext.",
  },
  {
    title: "Project Manager e Save/Load",
    description: "Gestão de projetos no modal PROJETO.",
    internals: "localStorage com criar, renomear, excluir e carregar snapshots.",
    files: ["src/context/ProjectProvider.tsx", "src/components/layout/right-tools/RightToolsBar.tsx"],
    interactions: "Restaura Viewer e ProjectState.",
  },
];
