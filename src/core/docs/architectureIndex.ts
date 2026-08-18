/**
 * Índice centralizado da arquitetura do projeto.
 * Usado pelo Painel de Referência e preparado para geração futura de documentação automática.
 *
 * Uso: Painel consome DOC_LINKS, MODULES, DATA_FLOWS, FOLDER_STRUCTURE, PANEL_NAV_ITEMS.
 * Documentação automática: addAutoSection, addAutoLink, getAutoSections, getAutoLinks, clearAutoSections, clearAutoLinks.
 * Expansão futura: scripts podem usar add/clear/get para gerar documentação sem alterar este ficheiro.
 * Atualizar quando novos módulos ou fluxos forem adicionados.
 */

export type DocLink = {
  id: string;
  title: string;
  path: string;
  description?: string;
};

export type ModuleRef = {
  id: string;
  name: string;
  path: string;
  responsibility: string;
  relatedModules?: string[];
};

export type DataFlowRef = {
  id: string;
  name: string;
  from: string;
  to: string;
  description: string;
};

/** Links para documentação externa. viewer-integration-reference.md documenta a integração Viewer ↔ ProjectContext. */
export const DOC_LINKS: DocLink[] = [
  { id: "multibox", title: "Arquitetura Multi-Box", path: "docs/multibox-architecture.md", description: "Módulo MultiBoxManager, fluxos e convenções" },
  { id: "dynamic-rules", title: "Dynamic Rules", path: "docs/dynamic-rules-reference.md", description: "Regras dinâmicas por modelo GLB" },
  { id: "smart-layout", title: "Smart Layout", path: "docs/smart-layout-reference.md", description: "Auto-positioning e layout engine" },
  { id: "glb-integration", title: "Integração GLB", path: "docs/glb-integration-reference.md", description: "Pipeline GLB → peças e cutlist" },
  { id: "multi-model", title: "Multi-Model Multi-Box", path: "docs/multi-model-multi-box-reference.md", description: "Múltiplos modelos por caixa" },
  { id: "viewer-integration", title: "Viewer Integration", path: "docs/viewer-integration-reference.md", description: "Integração Viewer com ProjectContext" },
  { id: "observacoes-unificado", title: "Sistema Unificado de Observações", path: "src/core/observacoes/README.md", description: "ObservacoesService — implementação oficial" },
  { id: "pimo-pro-v5-observacoes", title: "PIMO.PRO-V5 Observações", path: "docs/PIMO-PRO-V5-OBSERVACOES.md", description: "Roadmap evolução, checklist regressão e diagramas" },
];

/** Items de navegação lateral do Painel de Referência (anchor links) */
export type NavItem = { id: string; label: string; anchorId: string };
export const PANEL_NAV_ITEMS: NavItem[] = [
  { id: "nav-resumo", label: "Resumo do Progresso", anchorId: "section-resumo-progresso" },
  { id: "nav-arquitetura", label: "Arquitetura Atual do Projeto", anchorId: "section-arquitetura" },
  { id: "nav-multibox", label: "MultiBoxManager", anchorId: "section-multibox" },
  { id: "nav-viewer", label: "Viewer — Suporte Multi-Box", anchorId: "section-viewer" },
  { id: "nav-fluxos", label: "Fluxos de Dados", anchorId: "section-fluxos" },
  { id: "nav-documentacao", label: "Documentação", anchorId: "section-documentacao" },
];

export type AutoSection = { id: string; title: string; content?: string };
export type AutoLink = { id: string; href: string; label: string };

/** Secções geradas automaticamente (uso futuro) */
const _autoSections: AutoSection[] = [];
export const AUTO_SECTIONS: readonly AutoSection[] = _autoSections;

/** Links gerados automaticamente (uso futuro) */
const _autoLinks: AutoLink[] = [];
export const AUTO_LINKS: readonly AutoLink[] = _autoLinks;

/**
 * Adiciona secção para documentação automática.
 * Apenas armazena dados; sem lógica adicional.
 */
export function addAutoSection(section: AutoSection): void {
  _autoSections.push(section);
}

/**
 * Adiciona link para documentação automática.
 * Apenas armazena dados; sem lógica adicional.
 */
export function addAutoLink(link: AutoLink): void {
  _autoLinks.push(link);
}

/**
 * Retorna secções geradas automaticamente.
 * Usar no Painel de Referência quando houver conteúdo.
 */
export function getAutoSections(): readonly AutoSection[] {
  return _autoSections;
}

/**
 * Retorna links gerados automaticamente.
 * Usar no Painel de Referência quando houver conteúdo.
 */
export function getAutoLinks(): readonly AutoLink[] {
  return _autoLinks;
}

/**
 * Limpa todas as secções automáticas.
 * Útil para regeneração de documentação.
 */
export function clearAutoSections(): void {
  _autoSections.length = 0;
}

/**
 * Limpa todos os links automáticos.
 * Útil para regeneração de documentação.
 */
export function clearAutoLinks(): void {
  _autoLinks.length = 0;
}

/** Preparado para expansão futura: scripts podem usar add/clear/get para gerar documentação automática sem alterar este ficheiro. */

/** Módulos principais e responsabilidades */
export const MODULES: ModuleRef[] = [
  { id: "project-provider", name: "ProjectProvider", path: "src/context/ProjectProvider.tsx", responsibility: "Estado global do projeto (boxes, workspaceBoxes, material, changelog)", relatedModules: ["multibox", "viewer-sync"] },
  { id: "multibox", name: "MultiBoxManager", path: "src/core/multibox/", responsibility: "Sincronizar workspaceBoxes com Viewer via useCalculadoraSync", relatedModules: ["viewer", "workspace", "project-provider"] },
  { id: "viewer", name: "Viewer 3D / ViewerCore", path: "src/3d/core/Viewer.ts + src/3d/viewer-engine/ViewerCore.ts", responsibility: "Fachada 3D (ViewerCore) que delega em motores A→E: cena, interacção, dados, layout e runtime", relatedModules: ["multibox", "pimo-viewer-context", "viewer-engines"] },
  { id: "viewer-engines", name: "Viewer engines A→E", path: "src/3d/viewer-engine/engines.ts", responsibility: "Motores extraídos do ViewerCore (Scene/Lighting/Composer, Camera/Selection/Gizmo, Box/Room/Finish, Snap/Layout/Designer, Runtime/State/Facade)", relatedModules: ["viewer"] },
  { id: "box-assembler", name: "BoxAssembler", path: "src/3d/objects/BoxAssembler.ts", responsibility: "Montagem paramétrica das caixas/painéis/portas/gavetas", relatedModules: ["viewer", "drilling"] },
  { id: "drilling", name: "DrillGeometryBuilder", path: "src/3d/objects/DrillGeometryBuilder.ts", responsibility: "Aplicação geométrica dos furos no 3D", relatedModules: ["box-assembler", "manufacturing"] },
  { id: "workspace", name: "Workspace", path: "src/components/layout/workspace/Workspace.tsx", responsibility: "Inicializa Viewer, MultiBoxManager, viewerApiAdapter; monta cena principal", relatedModules: ["multibox", "viewer", "viewer-adapter"] },
  { id: "viewer-adapter", name: "viewerApiAdapter", path: "src/core/viewer/viewerApiAdapter.ts", responsibility: "Adapta PimoViewerApi para ViewerApi (snapshot, render); stubs documentados", relatedModules: ["viewer-sync", "workspace"] },
  { id: "viewer-sync", name: "useViewerSync", path: "src/hooks/useViewerSync.ts", responsibility: "Expõe notifyChange e callbacks de snapshot/render ao ProjectContext", relatedModules: ["viewer-adapter", "project-provider"] },
  { id: "pimo-viewer-context", name: "PimoViewerContext", path: "src/context/PimoViewerContext.tsx", responsibility: "Registo e acesso à API do Viewer (registerViewerApi, viewerApi)", relatedModules: ["viewer", "workspace"] },
  { id: "project-roadmap", name: "ProjectRoadmap", path: "src/core/docs/projectRoadmap.ts", responsibility: "Fases, tarefas e progresso do projeto", relatedModules: ["progresso-resumo"] },
  { id: "progresso-resumo", name: "progressoResumo", path: "src/core/docs/progressoResumo.ts", responsibility: "Tarefas concluídas, em andamento e próximas etapas", relatedModules: ["project-roadmap"] },
  { id: "observacoes-service", name: "ObservacoesService", path: "src/core/observacoes/ObservacoesService.ts", responsibility: "Sistema unificado de observações — sanitização, migração, pipeline industrial", relatedModules: ["project-provider", "pdf-export"] },
  {
    id: "online-analysis",
    name: "Industrial Online Analysis",
    path: "src/core/industrial/onlineAnalysis/",
    responsibility:
      "Fases 1–6: análise online completa + robustez (validações, testes, polish) em /PROJETOS/:project/analise",
    relatedModules: ["project-provider", "pdf-export"],
  },
];

/** Fluxos principais de dados */
export const DATA_FLOWS: DataFlowRef[] = [
  { id: "flow-1", name: "Workspace → MultiBoxManager → Viewer", from: "Workspace", to: "Viewer", description: "Inicialização e orquestração da sincronização" },
  { id: "flow-2", name: "workspaceBoxes → useCalculadoraSync → viewerApi", from: "ProjectContext.workspaceBoxes", to: "viewerApi.addBox/updateBox/removeBox", description: "Sincronização de boxes paramétricos" },
  { id: "flow-3", name: "UI (Painéis) → useProject actions → ProjectProvider", from: "LeftPanel/RightPanel/Toolbar", to: "ProjectContext.actions", description: "Entrada principal de alterações de estado" },
  { id: "flow-4", name: "ProjectProvider → Workspace → Viewer", from: "project/workspaceBoxes", to: "PimoViewerApi", description: "Render e sincronização visual" },
  { id: "flow-5", name: "UI Exportar → useGerarArquivoHandlers → Engines", from: "Workspace modal", to: "CutLayout/PDF/CNC/DRILL", description: "Exportação de layout, PDFs, TCN e Drill XML" },
  {
    id: "flow-6",
    name: "UI Análise → onlineAnalysis → tabelas PROJETOS",
    from: "UnifiedExportBubble / work-orders",
    to: "/PROJETOS/:project/analise/:docId",
    description:
      "Consulta + edição + histórico + download seletivo; overrides.cutlist → UEE (whitelist); CNC sem document overrides",
  },
];

/** Estrutura de pastas atualizada (principais) */
export const FOLDER_STRUCTURE = `
src/
├── 3d/               — Viewer, ViewerCore, objetos paramétricos, materiais, room
│   ├── core/
│   ├── objects/
│   └── viewer-engine/
├── context/          — ProjectProvider, PimoViewerContext, materialContext
├── core/
│   ├── multibox/     — MultiBoxManager (types, manager, index)
│   ├── viewer/       — viewerApiAdapter
│   ├── cutlayout/    — Engine de layout/nesting e PDF de layout
│   ├── cnc/          — Geração TCN e pipeline CNC
│   ├── drill/        — Export Drill XML
│   ├── rules/        — Dynamic rules, validação
│   ├── layout/       — viewerLayoutAdapter, smartArrange
│   ├── industrial/   — bottom sections, chapas, onlineAnalysis (PDFs online Fase 1)
│   └── docs/         — projectRoadmap, progressoResumo, painelReferenciaSections, architectureIndex
├── app/
│   └── PROJETOS/     — hub showroom + /analise (páginas online read-only)
├── hooks/            — usePimoViewer, useCalculadoraSync, useViewerSync, useGerarArquivoHandlers
├── constants/        — viewerOptions, toolbarConfig, fileManagerConfig
├── components/
│   ├── layout/       — Workspace, ViewerToolbar, UnifiedTopToolbar, LeftPanel, RightPanel, RightToolsBar
│   └── ui/           — Panel, UnifiedPopover, StepperPopover, etc.
└── pages/            — Documentacao, PainelReferencia, Ajuda, ProjectProgress, AdminPanel, etc.
`.trim();
