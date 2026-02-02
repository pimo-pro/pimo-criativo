/**
 * Resumo do progresso do projeto.
 * Utilizado no Painel de Referência e para alinhamento com o Roadmap.
 * Atualizar quando houver conclusões ou novas etapas.
 */

export type ProgressoItem = {
  id: string;
  titulo: string;
};

export const TAREFAS_CONCLUIDAS: ProgressoItem[] = [
  { id: "tc-1", titulo: "Implementação completa da interface multi-box no Viewer." },
  { id: "tc-2", titulo: "Criação do módulo src/core/multibox/ com tipos, manager e re-exports." },
  { id: "tc-3", titulo: "Integração total do MultiBoxManager ao Workspace." },
  { id: "tc-4", titulo: "Documentação completa do módulo multi-box em docs/multibox-architecture.md." },
  { id: "tc-5", titulo: "Garantia de build estável e manutenção das funcionalidades existentes." },
  { id: "tc-6", titulo: "Página dedicada para o Painel de Referência (/painel-referencia)." },
];

export const EM_ANDAMENTO: ProgressoItem[] = [
  { id: "ea-1", titulo: "Preparação para integração do configurador 3D com o MultiBoxManager." },
  {
    id: "ea-2",
    titulo: "Expansão futura do viewer para snapshot, 2D e renderização (stubs documentados).",
  },
];

export const PROXIMAS_ETAPAS: ProgressoItem[] = [
  {
    id: "pe-1",
    titulo: "Criar UI inicial para manipulação de múltiplos boxes (seleção, reorder, propriedades).",
  },
  { id: "pe-2", titulo: "Integrar o MultiBoxManager ao PIMO Calculator." },
  { id: "pe-3", titulo: "Unificar padrões de viewer e sincronização em todos os módulos." },
];
