import { useEffect, useMemo, useState } from "react";
import Panel from "../components/ui/Panel";
import { useProject } from "../context/useProject";
import {
  ROADMAP_STORAGE_KEY,
  getCurrentPhase,
  getGlobalProgress,
  getPhaseProgress,
  getRoadmap,
  getRoadmapStats,
  roadmapInstructions,
  statusLabel,
} from "../core/docs/projectRoadmap";

type DocStat = {
  label: string;
  value: number;
};

type DocSection = {
  title: string;
  description: string;
  internals: string;
  files: string[];
  interactions: string;
  notes?: string;
};

const rawFiles = import.meta.glob("/src/**/*.{ts,tsx,css,html}", {
  eager: true,
  as: "raw",
}) as Record<string, string>;

const computeStats = (boxCount: number): DocStat[] => {
  const filePaths = Object.keys(rawFiles);
  const totalFiles = filePaths.length;
  const totalLines = filePaths.reduce((sum, path) => {
    const content = rawFiles[path] ?? "";
    return sum + content.split(/\r?\n/).length;
  }, 0);
  const totalComponents = filePaths.filter(
    (path) => path.includes("/src/components/") && path.endsWith(".tsx")
  ).length;
  const totalCoreModules = filePaths.filter(
    (path) => path.includes("/src/core/") && path.endsWith(".ts")
  ).length;

  return [
    { label: "Linhas de código", value: totalLines },
    { label: "Arquivos", value: totalFiles },
    { label: "Componentes", value: totalComponents },
    { label: "Módulos core", value: totalCoreModules },
    { label: "Caixotes", value: boxCount },
  ];
};

const sections: DocSection[] = [
  {
    title: "Sistema de múltiplos caixotes",
    description: "Gerencia vários módulos independentes por projeto.",
    internals: "Cada caixote é um BoxModule com dimensões, espessura, prateleiras e cut list próprias.",
    files: ["src/core/types.ts", "src/context/ProjectProvider.tsx"],
    interactions: "UI seleciona caixote ativo e recalcula dados por módulo.",
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
    description: "Aplica espessura fixa de 10mm apenas no fundo.",
    internals: "As laterais e tampo/fundo usam a espessura do caixote; costa usa 10mm.",
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
    title: "Simplificação do LeftPanel",
    description: "Remove seção não utilizada e melhora legibilidade.",
    internals:
      "A seção “Selecionar Caixa do Projeto” foi removida por não fazer parte do fluxo atual.",
    files: ["src/components/layout/left-panel/LeftPanel.tsx"],
    interactions: "Painel fica mais direto e evita redundância de seleção.",
  },
  {
    title: "Layout estável com flex e painéis fixos",
    description: "Padroniza larguras e alturas para evitar desalinhamentos.",
    internals:
      "Painéis laterais usam min-width quando abertos e classes de painel padronizadas. " +
      "O painel inferior tem altura fixa via classe dedicada.",
    files: ["src/index.css", "src/App.tsx"],
    interactions: "Evita variações de layout e garante rendering das listas de modelos.",
    notes: "Classes: panel-shell, panel-shell--side, panel-shell--bottom.",
  },
  {
    title: "Hook useCadModels",
    description: "Centraliza leitura e persistência dos modelos CAD.",
    internals: "Hook lê do localStorage com fallback seguro e expõe models/setModels/reload.",
    files: ["src/hooks/useCadModels.ts", "src/components/layout/left-panel/LeftPanel.tsx"],
    interactions: "Admin adiciona modelos e o painel esquerdo reflete as mudanças.",
  },
  {
    title: "Hooks useTemplates e useMaterials",
    description: "Centralizam estado de templates e materiais do Admin.",
    internals:
      "Hooks reutilizam useStoredList e expõem estado/setters com persistência automática.",
    files: [
      "src/hooks/useStoredList.ts",
      "src/hooks/useTemplates.ts",
      "src/hooks/useMaterials.ts",
      "src/components/admin/TemplatesManager.tsx",
      "src/components/admin/MaterialsManager.tsx",
    ],
    interactions: "Admin mantém listas sincronizadas sem acoplamento direto ao storage.",
  },
  {
    title: "Hook useStoredList",
    description: "Base genérica de listas persistidas.",
    internals:
      "Centraliza leitura/validação/persistência e padroniza o comportamento dos hooks.",
    files: ["src/hooks/useStoredList.ts"],
    interactions: "Usado por cadModels, templates e materiais.",
  },
  {
    title: "CSS reutilizável no Admin e painéis",
    description: "Reduz estilos inline e mantém consistência visual.",
    internals:
      "Classes globais padronizam botões, inputs, cards, containers e resize horizontal.",
    files: [
      "src/index.css",
      "src/components/admin/CADModelsManager.tsx",
      "src/components/admin/TemplatesManager.tsx",
      "src/components/admin/MaterialsManager.tsx",
      "src/components/layout/left-panel/LeftPanel.tsx",
      "src/components/layout/right-panel/RightPanel.tsx",
    ],
    interactions: "Admin e painéis laterais compartilham o mesmo estilo base.",
  },
  {
    title: "Scroll global e resize lateral",
    description: "Restabelece rolagem da página e resize horizontal do LeftPanel.",
    internals:
      "Overflow do body volta ao padrão e o painel esquerdo usa handle dedicado.",
    files: ["src/index.css", "src/App.tsx", "src/components/layout/left-panel/LeftPanel.tsx"],
    interactions: "Página rola normalmente e o painel ajusta largura sem handles verticais.",
  },
  {
    title: "Full Model Fix (fase D)",
    description: "Normaliza escala, centro e alinhamento do modelo 3D.",
    internals:
      "Modelo é escalado por dimensão máxima, centralizado e alinhado ao piso antes do render.",
    files: ["src/components/three/ThreeViewer.tsx"],
    interactions: "Modelo responde melhor ao resize do painel e prepara PBR/HDRI.",
  },
  {
    title: "Scroll global e resize lateral",
    description: "Restabelece rolagem da página e resize horizontal do LeftPanel.",
    internals:
      "Overflow do body volta ao padrão e o painel esquerdo permite ajuste apenas lateral.",
    files: ["src/index.css", "src/App.tsx"],
    interactions: "Página rola normalmente e o painel ajusta largura sem cortes.",
  },
  {
    title: "Refino de layout do Workspace e BottomPanel",
    description: "Padroniza rodapé do workspace e painel inferior.",
    internals:
      "Classes reutilizáveis definem estrutura, tipografia e alinhamento dos painéis.",
    files: [
      "src/index.css",
      "src/components/layout/workspace/Workspace.tsx",
      "src/components/layout/bottom-panel/BottomPanel.tsx",
    ],
    interactions: "Layout mantém espaçamento consistente sem cortes de conteúdo.",
  },
  {
    title: "ProjectRoadmap (Phases)",
    description: "Roadmap sequencial baseado em fases com CRUD completo.",
    internals:
      "Fases e tarefas persistidas em localStorage com merge do plano base.",
    files: ["src/pages/ProjectRoadmap.tsx", "src/core/docs/projectRoadmap.ts"],
    interactions: "Substitui o modelo semanal por fases contínuas.",
  },
  {
    title: "Phase Atual no Painel de Referência",
    description: "Resumo automático da fase ativa do roadmap.",
    internals:
      "Calcula progresso da fase e progresso global do projeto.",
    files: ["src/pages/Documentation.tsx", "src/core/docs/projectRoadmap.ts"],
    interactions: "Atualiza quando fases/tarefas são alteradas.",
  },
  {
    title: "Semana 2 — Realismo 3D (HDRI, PBR, sombras)",
    description: "Início da fase de iluminação e materiais realistas.",
    internals:
      "Environment HDRI de estúdio, luzes físicas com sombras e materiais PBR base.",
    files: ["src/components/three/ThreeViewer.tsx"],
    interactions: "Modelo recebe sombras, reflexos ambientais e enquadramento estável.",
  },
  {
    title: "Correção estrutural dos painéis",
    description: "Remove containers internos e elimina scroll/resize indevidos.",
    internals:
      "Painéis laterais passam a ter conteúdo direto no container principal, com flex total.",
    files: [
      "src/components/layout/left-panel/LeftPanel.tsx",
      "src/components/layout/right-panel/RightPanel.tsx",
      "src/components/ui/Panel.tsx",
      "src/index.css",
      "src/App.tsx",
    ],
    interactions: "Conteúdo acompanha o tamanho do painel sem caixas internas fixas.",
  },
  {
    title: "CRUD de Phases e Tarefas",
    description: "Criação, edição, exclusão, reordenação e movimentação.",
    internals:
      "Todas as operações persistem em localStorage com registro na timeline.",
    files: ["src/pages/ProjectRoadmap.tsx", "src/core/docs/projectRoadmap.ts"],
    interactions: "Permite gestão completa sem editar código.",
  },
  {
    title: "Gráficos e estatísticas do Roadmap",
    description: "Progresso por phase, progresso global e timeline.",
    internals:
      "Barras de progresso e métricas agregadas do projeto.",
    files: ["src/pages/ProjectRoadmap.tsx", "src/index.css"],
    interactions: "Visualização rápida do progresso e prioridades.",
  },
  {
    title: "Sistema de Materiais Profissional",
    description: "Presets reais, painel de materiais e aplicação por partes.",
    internals:
      "Presets com mapas PBR e parâmetros padrão, persistência em localStorage.",
    files: [
      "src/core/materials/materialPresets.ts",
      "src/context/materialContext.tsx",
      "src/components/layout/right-panel/MaterialPanel.tsx",
      "src/components/three/ThreeViewer.tsx",
    ],
    interactions: "Materiais aplicados ao modelo por categoria e parte.",
  },
  {
    title: "Melhorias de visualização 3D",
    description: "Grid suave, chão PBR e rotação manual.",
    internals:
      "Grid leve de referência, ground plane com sombras e câmera ajustada.",
    files: ["src/components/three/ThreeViewer.tsx"],
    interactions: "Visualização mais estável e leitura espacial melhor.",
  },
  {
    title: "Semana 2 — Realismo 3D (Parte 2)",
    description: "Sombras suaves, HDRI customizado e PBR avançado.",
    internals:
      "PCFSoft com ajustes de bias/radius, HDRI dedicado e utilitário PBR com mapas.",
    files: ["src/components/three/ThreeViewer.tsx"],
    interactions: "Sombras suaves no piso e melhor leitura de materiais.",
  },
  {
    title: "Semana 2 — Realismo 3D (Parte 3)",
    description: "Texturas PBR reais e HDRI por arquivo.",
    internals:
      "Texturas em public/textures e HDRI em public/hdr com carregamento dedicado.",
    files: [
      "src/components/three/ThreeViewer.tsx",
      "public/hdr/studio_neutral.hdr",
      "public/textures/wood/base.svg",
      "public/textures/metal/base.svg",
      "public/textures/glass/base.svg",
    ],
    interactions: "Materiais ganham texturas reais e sombras com contacto natural.",
  },
  {
    title: "Theme system",
    description: "Troca de temas com context e seletor.",
    internals: "ThemeProvider expõe tema atual via hook.",
    files: ["src/theme/ThemeProvider.tsx", "src/hooks/useTheme.ts"],
    interactions: "Header e ThemeSwitcher controlam o tema.",
  },
  {
    title: "Estrutura 3D",
    description: "Cena 3D com câmera, luzes e controles separados.",
    internals: "ThreeScene orquestra conteúdo com subcomponentes.",
    files: ["src/components/3d/ThreeScene.tsx", "src/components/3d/SceneContent.tsx"],
    interactions: "Exibe estrutura gerada por caixote.",
  },
  {
    title: "Exportação PDF",
    description: "Gera relatório de cut list por caixote.",
    internals: "Itera pelos caixotes e monta páginas.",
    files: ["src/context/ProjectProvider.tsx"],
    interactions: "Usa jsPDF + autoTable.",
  },
  {
    title: "Painel de Referência",
    description: "Página de documentação interna com estatísticas e changelog.",
    internals: "Calcula métricas via import.meta.glob e registra eventos no ProjectProvider.",
    files: ["src/pages/Documentation.tsx", "src/context/ProjectProvider.tsx"],
    interactions: "Atualiza com botão de documentação e eventos do projeto.",
  },
];

export default function Documentation() {
  const { project, actions } = useProject();
  const [roadmapPhases, setRoadmapPhases] = useState(() => getRoadmap());

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === ROADMAP_STORAGE_KEY) {
        setRoadmapPhases(getRoadmap());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const currentPhase = getCurrentPhase(roadmapPhases);
  const currentPhaseProgress = getPhaseProgress(currentPhase);
  const globalProgress = getGlobalProgress(roadmapPhases);
  const roadmapStats = getRoadmapStats(roadmapPhases);
  const stats = useMemo(
    () => computeStats(project.boxes.length),
    [project.boxes.length]
  );

  const formatDateTime = (date: Date) => {
    const pad = (value: number) => String(value).padStart(2, "0");
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(
      date.getHours()
    )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const formattedChangelog = useMemo(
    () =>
      project.changelog
        .slice()
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .map((entry) => ({
          ...entry,
          time: formatDateTime(entry.timestamp),
        })),
    [project.changelog]
  );

  const refreshDocumentation = () => {
    actions.logChangelog("Documentação atualizada");
  };

  return (
    <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>
          Painel de Referência
        </div>
        <button
          onClick={refreshDocumentation}
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "var(--text-main)",
            padding: "8px 12px",
            borderRadius: "var(--radius)",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          Atualizar Documentação
        </button>
      </div>

      <Panel title="Estatísticas do Projeto">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 10,
          }}
        >
          {stats.map((stat) => (
            <div key={stat.label}>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-main)" }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Phase Atual">
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
            {currentPhase.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {currentPhase.description}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Progresso da phase: {currentPhaseProgress}% | Progresso global: {globalProgress}%
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Última atualização do roadmap: {roadmapStats.lastUpdated ?? "Sem data"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {currentPhase.tasks.length === 0 ? (
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                Nenhuma tarefa nesta phase.
              </div>
            ) : (
              currentPhase.tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 10px",
                    border: "1px solid rgba(255,255,255,0.06)",
                    borderRadius: "var(--radius)",
                    background: "rgba(255,255,255,0.02)",
                  }}
                >
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" readOnly checked={task.status === "done"} />
                    <span style={{ fontSize: 12, color: "var(--text-main)" }}>
                      {statusLabel[task.status]}
                    </span>
                  </label>
                  <div style={{ fontSize: 12, color: "var(--text-main)" }}>{task.title}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                    {task.description}
                    {task.notes && task.notes !== task.description ? ` — ${task.notes}` : ""}
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-main)", lineHeight: 1.7 }}>
            {roadmapInstructions.map((instruction) => (
              <div key={instruction}>{instruction}</div>
            ))}
          </div>
        </div>
      </Panel>

      <Panel title="Índice de Funcionalidades">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {sections.map((section) => (
            <div key={section.title}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-main)" }}>
                {section.title}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                {section.description}
              </div>
              <div style={{ fontSize: 13, color: "var(--text-main)", marginTop: 8 }}>
                {section.internals}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
                Arquivos: {section.files.join(", ")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Interações: {section.interactions}
              </div>
              {section.notes && (
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                  Observações: {section.notes}
                </div>
              )}
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Atualização de layout e cadModels">
        <div style={{ fontSize: 12, color: "var(--text-main)", lineHeight: 1.6 }}>
          Mudanças aplicadas: painéis laterais com altura total e scroll interno, painel inferior
          com altura fixa e classes de painel padronizadas. Hook useCadModels para sincronizar
          modelos entre Admin e painel. Hooks useTemplates/useMaterials para centralizar listas
          do Admin e useStoredList como base reutilizável. CSS reutilizável remove estilos inline
          dos painéis do Admin e ajusta Workspace/BottomPanel. Seção “Selecionar Caixa do Projeto”
          foi removida do LeftPanel. Controles 3D e botões internos do Workspace agora usam
          classes globais. Scroll global reativado e resize horizontal aplicado ao LeftPanel.
          ProjectRoadmap substitui o modelo semanal com Phases.
          {"\n"}Motivos técnicos: evitar variação por conteúdo e impedir colapso de altura.
          {"\n"}Decisão: centralizar regras em CSS e mover persistência para hook genérico.
          {"\n"}Decisão visual: consolidar tipografia, espaçamentos e estados de botões.
          {"\n"}Decisão visual: estados de drag/controle via classes no Workspace.
          {"\n"}Impacto: listas de cadModels/templates/materiais permanecem visíveis e sincronizadas,
          com UI consistente no Admin, painéis sem cortes, workspace homogêneo, modelo 3D alinhado
          e fluxo simplificado no LeftPanel. Página com rolagem normal, roadmap disponível e bloco
          de Phase Atual integrado ao Painel de Referência. Semana 2 iniciada com HDRI,
          iluminação realista e preparação de sombras. Painéis laterais agora têm conteúdo
          integrado ao container principal, sem scroll interno. Roadmap aceita Phases e tarefas
          com persistência em localStorage. Status das tarefas agora é editável com badges e
          sincronização imediata. Semana 2 (Parte 2) adiciona HDRI customizado, sombras suaves e
          preparação PBR avançada. Semana 2 (Parte 3) aplica texturas PBR reais e HDRI por arquivo.
          Sistema de Materiais Profissional adiciona presets reais, painel de seleção e
          persistência de materiais. ThreeViewer recebeu grid suave, chão PBR e rotação manual.
          {"\n"}Arquivos: src/index.css, src/App.tsx, src/hooks/useCadModels.ts,
          src/hooks/useTemplates.ts, src/hooks/useMaterials.ts, src/hooks/useStoredList.ts,
          src/components/layout/left-panel/LeftPanel.tsx,
          src/components/layout/right-panel/RightPanel.tsx,
          src/components/layout/workspace/Workspace.tsx,
          src/components/layout/bottom-panel/BottomPanel.tsx,
          src/components/three/ThreeViewer.tsx,
          src/pages/ProjectRoadmap.tsx,
          src/core/docs/projectRoadmap.ts,
          src/pages/Documentation.tsx,
          src/components/ui/Panel.tsx,
          src/core/materials/materialPresets.ts,
          src/context/materialContext.tsx,
          src/components/layout/right-panel/MaterialPanel.tsx,
          src/components/admin/CADModelsManager.tsx,
          src/components/admin/TemplatesManager.tsx,
          src/components/admin/MaterialsManager.tsx
        </div>
        <pre
          style={{
            marginTop: 10,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--text-main)",
            whiteSpace: "pre-wrap",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
{`.panel-resizer {
  width: 6px;
  cursor: col-resize;
}

.textarea {
  resize: none;
}`}
        </pre>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
          Referências: src/index.css, src/App.tsx
        </div>
      </Panel>

      <Panel title="Changelog Automático">
        {formattedChangelog.length === 0 ? (
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Nenhum evento registrado ainda.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {formattedChangelog.map((entry) => (
              <div key={entry.id} style={{ fontSize: 12, color: "var(--text-main)" }}>
                <span style={{ color: "var(--text-muted)" }}>[{entry.time}]</span> {entry.message}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
