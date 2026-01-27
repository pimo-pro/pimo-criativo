import Panel from "../components/ui/Panel";
import { changelog } from "../core/docs/changelog";
import { specs } from "../core/docs/specs";
import { howItWorks } from "../core/docs/howItWorks";
import { features } from "../core/docs/features";

const sectionTitleStyle = {
  fontSize: 16,
  fontWeight: 700,
  color: "var(--text-main)",
  marginBottom: 10,
};

const bodyTextStyle = {
  fontSize: 12,
  color: "var(--text-main)",
  lineHeight: 1.7,
  whiteSpace: "pre-wrap" as const,
};

export default function Documentacao() {
  return (
    <main
      style={{
        flex: 1,
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        background: "radial-gradient(circle at top, #1e293b, #0b0f17 60%)",
        overflowY: "auto",
        scrollBehavior: "smooth",
      }}
    >
      <Panel title="Documentação do Sistema">
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Referência interna do PIMO‑Criativo
        </div>
      </Panel>

      <Panel title="Atualizações recentes do layout, cadModels e Admin">
        <div style={bodyTextStyle}>
          Mudanças aplicadas:
          {"\n"}- Painéis esquerdo/direito com largura estável (min-width quando abertos).
          {"\n"}- Painel inferior com altura fixa (min-height e altura base).
          {"\n"}- Painéis laterais com altura total e scroll interno, evitando colapso.
          {"\n"}- Hook useCadModels centraliza leitura/gravação de modelos CAD.
          {"\n"}- Hooks useTemplates e useMaterials centralizam templates e materiais.
          {"\n"}- Hook useStoredList unifica a persistência de listas no storage.
          {"\n"}- Redução de estilos inline com classes CSS reutilizáveis.
          {"\n"}- Classes de painel padronizadas para layout consistente.
          {"\n"}- Remoção da seção “Selecionar Caixa do Projeto” do painel esquerdo.
          {"\n"}- Ajustes no Workspace e BottomPanel para visual estável.
          {"\n"}- Controles 3D e botões internos padronizados no Workspace.
          {"\n"}- Redimensionamento apenas horizontal no painel esquerdo.
          {"\n"}- Scroll global reativado (sem bloqueios no body).
          {"\n"}- Transições e cursores do Workspace movidos para classes CSS.
          {"\n"}- Handle vertical removido; resize agora é via handle lateral customizado.
          {"\n"}- Full Model Fix iniciado para ajuste de escala e centralização 3D.
          {"\n"}- ProjectRoadmap criado para planeamento por fases.
          {"\n"}- Bloco “Semana Atual” integrado ao Painel de Referência.
          {"\n"}- Semana 2 iniciada: HDRI, iluminação realista e preparação de sombras.
          {"\n"}- Materiais convertidos para MeshStandardMaterial com PBR base.
          {"\n"}- Correção estrutural dos painéis (sem painel dentro de painel).
          {"\n"}- Conteúdo do LeftPanel/RightPanel integrado ao container principal.
          {"\n"}- Remoção de scroll interno e ajuste de overflow/altura.
          {"\n"}- Formulário para adicionar tarefas no ProjectRoadmap.
          {"\n"}- Tarefas semanais persistidas no localStorage.
          {"\n"}- Painel de Referência exibe tarefas adicionadas pelo utilizador.
          {"\n"}- Status editável das tarefas com badge por estado.
          {"\n"}- Alteração de status atualiza timeline e Semana Atual.
          {"\n"}- Sombras suaves com PCFSoft + ajustes de bias/blur.
          {"\n"}- HDRI customizado com environment map dedicado.
          {"\n"}- Materiais PBR avançados com suporte a mapas (ao/roughness/metalness).
          {"\n"}- Texturas PBR reais carregadas de public/textures.
          {"\n"}- HDRI real carregado de public/hdr.
          {"\n"}- Ajustes finos de iluminação e sombras do piso.
          {"\n"}- Roadmap semanal removido e substituído por Phases.
          {"\n"}- CRUD completo de Phases e tarefas com persistência.
          {"\n"}- Sistema de Materiais Profissional iniciado com presets reais.
          {"\n"}- Painel lateral de materiais com preview e ajustes.
          {"\n"}- Aplicação de materiais por partes (madeira, metal, vidro, etc.).
          {"\n"}- materialContext separado em Provider/Hook e utilitários dedicados.
          {"\n"}- Rotação automática removida no ThreeViewer.
          {"\n"}- Grid suave de referência adicionado ao fundo.
          {"\n"}- Ground plane PBR com sombras ativas.
          {"\n\n"}Motivos técnicos:
          {"\n"}- Evitar variação de tamanho por conteúdo.
          {"\n"}- Evitar overflow escondido que impede renderização de listas.
          {"\n"}- Evitar divergência de estado entre painéis ao mover cadModels.
          {"\n"}- Reduzir acoplamento entre Admin e storage.
          {"\n"}- Simplificar manutenção visual do Admin e painéis laterais.
          {"\n"}- Remover fluxo sem utilidade no estado atual do produto.
          {"\n"}- Garantir rolagem natural da página inteira.
          {"\n"}- Eliminar handles automáticos do navegador em painéis e textareas.
          {"\n"}- Preparar modelo 3D para materiais e iluminação realistas.
          {"\n"}- Garantir visão clara do progresso semanal do projeto.
          {"\n"}- Centralizar plano semanal no Painel de Referência.
          {"\n"}- Preparar pipeline visual para realismo 3D (HDRI, PBR, sombras).
          {"\n"}- Evitar cortes e containers fixos que quebram o layout.
          {"\n"}- Permitir atualização do plano semanal sem editar código.
          {"\n"}- Garantir controle visual do progresso semanal.
          {"\n"}- Melhorar realismo do 3D com luz e sombras naturais.
          {"\n"}- Aplicar texturas reais sem depender de edição de código.
          {"\n"}- Unificar o planeamento em fases sequenciais.
          {"\n"}- Permitir seleção e ajuste de materiais sem editar código.
          {"\n"}- Melhorar leitura espacial com grid leve e chão PBR.
          {"\n\n"}Decisões de arquitetura:
          {"\n"}- Layout principal controlado por flex e limites fixos.
          {"\n"}- Scroll concentrado nos painéis, não no body.
          {"\n"}- Estado de cadModels centralizado em hook reutilizável.
          {"\n"}- Templates e materiais seguem o mesmo padrão de hook.
          {"\n"}- Persistência genérica extraída para useStoredList.
          {"\n"}- Estilos essenciais movidos para classes globais em index.css.
          {"\n"}- Painéis usam classes compartilhadas para padding, tipografia e botões.
          {"\n"}- Workspace usa classes para botões e overlays do 3D.
          {"\n"}- Redimensionamento vertical desativado nos painéis laterais.
          {"\n"}- Estados do Workspace controlados por classes (drag/controle).
          {"\n"}- Resize horizontal implementado por handle dedicado no painel esquerdo.
          {"\n"}- Modelo 3D normalizado (escala/centro/alinhamento).
          {"\n"}- Planeamento semanal centralizado em página dedicada.
          {"\n"}- Painel de Referência consome o plano semanal de fonte única.
          {"\n"}- Cena 3D preparada para iluminação física e sombras suaves.
          {"\n"}- Painéis laterais passam a usar container único com flex total.
          {"\n"}- Fonte única do plano semanal combinada com tarefas do utilizador.
          {"\n"}- Overrides de status persistidos sem alterar o plano base.
          {"\n"}- Pipeline PBR preparado para texturas reais.
          {"\n"}- HDRI real passa a ser carregado via arquivo.
          {"\n"}- Roadmap baseado em Phases com progresso global e por fase.
          {"\n"}- Presets e ajustes de materiais persistidos no localStorage.
          {"\n\n"}Fluxos atualizados:
          {"\n"}- Lista de cadModels renderiza de forma estável em qualquer painel.
          {"\n"}- CadModels atualiza na UI após salvar no Admin.
          {"\n"}- Templates e materiais persistem via hooks e refletem no Admin.
          {"\n"}- Hooks agora compartilham a mesma base de persistência.
          {"\n"}- Bottom panel mantém altura constante, independentemente do conteúdo.
          {"\n"}- Admin reutiliza classes para inputs, botões e cards.
          {"\n"}- Painel esquerdo exibe 100% do conteúdo sem cortes.
          {"\n"}- Workspace e BottomPanel com tipografia consistente.
          {"\n"}- Página inteira volta a rolar normalmente.
          {"\n"}- Modelo 3D responde melhor ao resize do painel.
          {"\n"}- Workspace mantém transições visuais sem inline.
          {"\n"}- Painéis sem handles verticais e sem resize acidental.
          {"\n"}- Equipa acompanha tarefas por semana no roadmap.
          {"\n"}- Semana atual aparece automaticamente no Painel de Referência.
          {"\n"}- Visual 3D com reflexos ambientais e sombras ativadas.
          {"\n"}- Painel cresce com o conteúdo sem scroll interno.
          {"\n"}- Semana atual inclui tarefas adicionadas em tempo real.
          {"\n"}- Status atualizado reflete imediatamente no Painel de Referência.
          {"\n"}- Iluminação HDRI reflete melhor nos materiais PBR.
          {"\n"}- Sombras suaves mais naturais no contacto com o piso.
          {"\n"}- Phase atual e progresso global exibidos no Painel de Referência.
          {"\n"}- Materiais aplicados no ThreeViewer conforme o painel de materiais.
          {"\n"}- Câmara ajustada para enquadramento natural com chão.
          {"\n\n"}Exemplo de uso:
          {"\n"}- Alternar painel esquerdo sem perder a lista de modelos.
          {"\n"}- Adicionar modelo no Admin e ver atualização no painel esquerdo.
          {"\n"}- Criar template/material no Admin e manter estado centralizado.
          {"\n"}- Reaproveitar classes .input, .button e .card no Admin.
          {"\n"}- Usar .workspace-footer para padronizar o rodapé do workspace.
          {"\n"}- Usar .icon-button para controles 3D.
          {"\n"}- Ajustar largura do painel esquerdo pelo lado direito.
          {"\n"}- Usar .workspace-placeholder.is-controlling para interação.
          {"\n"}- Usar .panel-resizer para resize horizontal.
          {"\n"}- Usar normalização de escala no ThreeViewer.
          {"\n"}- Manter Phases atualizadas no ProjectRoadmap.
          {"\n"}- Validar tarefas pendentes diretamente no Painel de Referência.
          {"\n"}- Ajustar iluminação HDRI sem quebrar o enquadramento da câmera.
          {"\n"}- Garantir layout sem “painel dentro de painel”.
          {"\n"}- Adicionar tarefas via formulário e refletir no Painel de Referência.
          {"\n"}- Ajustar status direto no ProjectRoadmap.
          {"\n"}- Validar sombras suaves no piso com PCFSoft.
          {"\n"}- Trocar HDRI embutido por arquivo em public/hdr.
          {"\n"}- Gerir Phases e tarefas diretamente no ProjectRoadmap.
          {"\n"}- Ajustar presets e parâmetros no painel de materiais.
          {"\n"}- Navegar a cena sem rotação automática.
          {"\n\n"}Arquivos modificados:
          {"\n"}- src/hooks/useCadModels.ts
          {"\n"}- src/hooks/useTemplates.ts
          {"\n"}- src/hooks/useMaterials.ts
          {"\n"}- src/hooks/useStoredList.ts
          {"\n"}- src/components/layout/left-panel/LeftPanel.tsx
          {"\n"}- src/components/layout/right-panel/RightPanel.tsx
          {"\n"}- src/components/admin/CADModelsManager.tsx
          {"\n"}- src/components/admin/TemplatesManager.tsx
          {"\n"}- src/components/admin/MaterialsManager.tsx
          {"\n"}- src/components/layout/workspace/Workspace.tsx
          {"\n"}- src/components/layout/bottom-panel/BottomPanel.tsx
          {"\n"}- src/components/three/ThreeViewer.tsx
          {"\n"}- src/pages/ProjectRoadmap.tsx
          {"\n"}- src/core/docs/projectRoadmap.ts
          {"\n"}- src/core/materials/materialPresets.ts
          {"\n"}- src/context/materialContext.tsx
          {"\n"}- src/context/materialContextInstance.ts
          {"\n"}- src/context/materialUtils.ts
          {"\n"}- src/context/useMaterial.ts
          {"\n"}- src/components/layout/right-panel/MaterialPanel.tsx
          {"\n"}- src/pages/Documentation.tsx
          {"\n"}- src/components/ui/Panel.tsx
          {"\n"}- src/index.css
          {"\n"}- public/hdr/studio_neutral.hdr
          {"\n"}- public/textures/wood/base.svg
          {"\n"}- public/textures/metal/base.svg
          {"\n"}- public/textures/glass/base.svg
          {"\n"}- public/textures/plastic/base.svg
          {"\n"}- public/textures/marble/base.svg
          {"\n"}- public/textures/stone/base.svg
          {"\n"}- src/App.tsx
        </div>
      </Panel>

      <Panel title="Trecho de código relevante">
        <pre
          style={{
            margin: 0,
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
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
          Referências internas: src/index.css, src/App.tsx,
          src/components/layout/left-panel/LeftPanel.tsx,
          src/components/layout/right-panel/RightPanel.tsx,
          src/components/layout/workspace/Workspace.tsx,
          src/components/layout/bottom-panel/BottomPanel.tsx
        </div>
      </Panel>

      <Panel title="Hook useCadModels (exemplo de uso)">
        <pre
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--text-main)",
            whiteSpace: "pre-wrap",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
{`const { models, setModels, reload } = useCadModels();
// models alimenta selects e listas
// setModels atualiza e persiste no storage
// reload sincroniza com storage quando necessário`}
        </pre>
      </Panel>

      <Panel title="Hooks useTemplates / useMaterials (exemplo)">
        <pre
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--text-main)",
            whiteSpace: "pre-wrap",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
{`const { templates, setTemplates } = useTemplates();
const { materials, setMaterials } = useMaterials();
// estado centralizado + persistência automática`}
        </pre>
      </Panel>

      <Panel title="Hook useStoredList (base reutilizável)">
        <pre
          style={{
            margin: 0,
            fontSize: 12,
            lineHeight: 1.6,
            color: "var(--text-main)",
            whiteSpace: "pre-wrap",
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          }}
        >
{`const { items, setItems, reload } = useStoredList({
  storageKey: "pimo_admin_templates",
  defaultValue: [],
});`}
        </pre>
      </Panel>

      <Panel>
        <div style={sectionTitleStyle}>Changelog</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {changelog.map((item, index) => (
            <div key={`${item.data}-${index}`} style={{ fontSize: 12, color: "var(--text-main)" }}>
              <span style={{ color: "var(--text-muted)" }}>[{item.data}]</span> {item.descricao}
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <div style={sectionTitleStyle}>Especificações Técnicas</div>
        <div style={bodyTextStyle}>{specs}</div>
      </Panel>

      <Panel>
        <div style={sectionTitleStyle}>Como o Sistema Funciona</div>
        <div style={bodyTextStyle}>{howItWorks}</div>
      </Panel>

      <Panel>
        <div style={sectionTitleStyle}>O que o Sistema Oferece</div>
        <ul
          style={{
            margin: 0,
            paddingLeft: 18,
            display: "flex",
            flexDirection: "column",
            gap: 6,
            fontSize: 12,
            color: "var(--text-main)",
          }}
        >
          {features.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Panel>
    </main>
  );
}
