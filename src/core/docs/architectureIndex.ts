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
  { id: "multibox", name: "MultiBoxManager", path: "src/core/multibox/", responsibility: "Sincronizar workspaceBoxes com Viewer via useCalculadoraSync e useCadModelsSync", relatedModules: ["viewer", "workspace", "project-provider"] },
  { id: "viewer", name: "Viewer 3D", path: "src/3d/core/Viewer.ts", responsibility: "Renderização 3D, múltiplos boxes, modelos GLB", relatedModules: ["multibox", "pimo-viewer-context"] },
  { id: "workspace", name: "Workspace", path: "src/components/layout/workspace/Workspace.tsx", responsibility: "Inicializa Viewer, MultiBoxManager, viewerApiAdapter; monta cena principal", relatedModules: ["multibox", "viewer", "viewer-adapter"] },
  { id: "viewer-adapter", name: "viewerApiAdapter", path: "src/core/viewer/viewerApiAdapter.ts", responsibility: "Adapta PimoViewerApi para ViewerApi (snapshot, 2D, render); stubs documentados", relatedModules: ["viewer-sync", "workspace"] },
  { id: "viewer-sync", name: "useViewerSync", path: "src/hooks/useViewerSync.ts", responsibility: "Expõe notifyChange e callbacks de snapshot/2D/render ao ProjectContext", relatedModules: ["viewer-adapter", "project-provider"] },
  { id: "pimo-viewer-context", name: "PimoViewerContext", path: "src/context/PimoViewerContext.tsx", responsibility: "Registo e acesso à API do Viewer (registerViewerApi, viewerApi)", relatedModules: ["viewer", "workspace"] },
  { id: "project-roadmap", name: "ProjectRoadmap", path: "src/core/docs/projectRoadmap.ts", responsibility: "Fases, tarefas e progresso do projeto", relatedModules: ["progresso-resumo"] },
  { id: "progresso-resumo", name: "progressoResumo", path: "src/core/docs/progressoResumo.ts", responsibility: "Tarefas concluídas, em andamento e próximas etapas", relatedModules: ["project-roadmap"] },
];

/** Fluxos principais de dados */
export const DATA_FLOWS: DataFlowRef[] = [
  { id: "flow-1", name: "Workspace → MultiBoxManager → Viewer", from: "Workspace", to: "Viewer", description: "Inicialização e orquestração da sincronização" },
  { id: "flow-2", name: "workspaceBoxes → useCalculadoraSync → viewerApi", from: "ProjectContext.workspaceBoxes", to: "viewerApi.addBox/updateBox/removeBox", description: "Sincronização de boxes paramétricos" },
  { id: "flow-3", name: "workspaceBoxes → useCadModelsSync → viewerApi", from: "ProjectContext.workspaceBoxes", to: "viewerApi.addModelToBox/removeModelFromBox", description: "Sincronização de modelos GLB" },
  { id: "flow-4", name: "UI → actions → ProjectContext", from: "UI (addWorkspaceBox)", to: "ProjectContext.actions", description: "Ações do utilizador disparam atualização de estado" },
  { id: "flow-5", name: "Workspace → viewerApiAdapter → viewerSync", from: "Workspace", to: "useViewerSync", description: "Registo do adapter para snapshot/2D/render" },
];

/** Estrutura de pastas atualizada (principais) */
export const FOLDER_STRUCTURE = `
src/
├── 3d/core/          — Viewer, câmera, cena, materiais
├── context/          — ProjectProvider, PimoViewerContext, materialContext
├── core/
│   ├── multibox/     — MultiBoxManager (types, manager, index)
│   ├── viewer/       — viewerApiAdapter
│   ├── rules/        — Dynamic rules, validação
│   ├── layout/       — viewerLayoutAdapter, smartArrange
│   └── docs/         — projectRoadmap, progressoResumo, painelReferenciaSections, architectureIndex
├── hooks/            — usePimoViewer, useCalculadoraSync, useCadModelsSync, useViewerSync
├── constants/        — viewerOptions, toolbarConfig, fileManagerConfig
├── components/
│   ├── layout/       — Workspace, ViewerToolbar, Tools3DToolbar, LeftPanel, RightPanel, RightToolsBar
│   └── ui/           — Panel, UnifiedPopover, StepperPopover, etc.
└── pages/            — PainelReferencia, ProjectRoadmap, AdminPanel, etc.
`.trim();
