/**
 * PIMO Criativo — Página de Ajuda + System Documentation
 * Conteúdo baseado em: howItWorks.ts, specs.ts, features.ts, projectProgress
 * Língua: PT-PT
 * Tema: herda dark/light do ThemeContext via documentElement (não forçar theme-dark).
 * Sem lógica industrial.
 */

import { useState } from "react";
import { Link } from "react-router-dom";
import SystemDocumentationPage from "../components/help/SystemDocumentationPage";
import {
  PIMO_INFO_CONTACTO_URL,
  PIMO_INFO_FAQ_URL,
  PIMO_INFO_HELP_CENTER_URL,
  PIMO_INFO_NOVIDADES_URL,
  PIMO_INFO_SECTION_URLS,
} from "../constants/helpCenter";
import { AJUDA_WHATS_NEW_PATH } from "../routes/ajudaRoutes";
import type { SystemDocCategoryId } from "../utils/loadSystemDoc";
import { SYSTEM_DOC_CATEGORIES } from "../utils/loadSystemDoc";
import { ciTint } from "./ajuda/ajudaPageTokens";

// ── Tokens (CI-native com fallback Alpha) ─────────────────────────────────────

const C = {
  bg:      "var(--navy,#0f172a)",
  surface: "var(--card-bg,rgba(255,255,255,0.03))",
  border:  "var(--card-border,rgba(255,255,255,0.07))",
  text:    "var(--text-main,#e2e8f0)",
  muted:   "var(--text-muted,#94a3b8)",
  accent:  "var(--ci-prussian-600, var(--blue-light,#3b82f6))",
  green:   "var(--status-done-color, var(--ci-success, #34d399))",
  amber:   "var(--status-progress-color, var(--ci-sienna-400, #fbbf24))",
  purple:  "var(--ci-prussian-200, var(--blue-light,#a78bfa))",
  pink:    "var(--primary,#f472b6)",
  danger:  "var(--ui-color-danger, var(--ci-danger, #f85149))",
  system:  "var(--ci-prussian-400, var(--primary,#38bdf8))",
  accentBg: "var(--accent-button-bg, color-mix(in srgb, var(--ci-prussian-600, var(--blue-light,#3b82f6)) 10%, transparent))",
  accentBd: "var(--accent-button-border, color-mix(in srgb, var(--ci-prussian-600, var(--blue-light,#3b82f6)) 25%, transparent))",
};

const font = "system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";

// ── SVG ───────────────────────────────────────────────────────────────────────

const P: Record<string,string> = {
  box:    "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  move:   "M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20",
  mat:    "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  door:   "M3 3h7v18H3zM10 7l4-4h7v18h-7l-4-4",
  drawer: "M2 8h20v8H2zM6 8v8M12 8v8M18 8v8",
  shelf:  "M4 12h16M4 6h16M4 18h16",
  cut:    "M14.5 4l-5 16M4 6l16 12M4 18l16-12",
  export: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12",
  grid:   "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  ruler:  "M2 12h20M6 8l-4 4 4 4M18 8l4 4-4 4",
  info:   "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16v-4M12 8h.01",
  warn:   "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01",
  star:   "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  key:    "M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3",
  tag:    "M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01",
  check:  "M20 6L9 17l-5-5",
  gear:   "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  engineering: "M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2zM9 9h6v6H9z",
};

function Ico({ d, size=16, color="currentColor" }: { d:string; size?:number; color?:string }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

type AlertType = "tip" | "warning" | "best-practice";

interface Alert { type: AlertType; text: string; }
interface Step  { title: string; text: string; code?: string; }
interface Section {
  id: string; icon: string; label: string; accent: string;
  title: string; intro: string;
  steps: Step[];
  alerts?: Alert[];
  subsections?: { title: string; steps: Step[]; alerts?: Alert[] }[];
}

// ── Conteúdo ──────────────────────────────────────────────────────────────────

const SECTIONS: Section[] = [
  {
    id:"criar-caixa", icon:"box", label:"Criar Caixa", accent:C.accent,
    title:"Criar e configurar uma nova caixa",
    intro:"O PIMO usa um sistema de placeholders (workspaceBoxes) — primeiro posiciona as caixas no workspace, depois clica em 'Gerar Design 3D' para calcular a estrutura completa.",
    steps:[
      { title:"Abrir o painel Móveis", text:"Clique no ícone de Móveis na barra lateral esquerda (segundo ícone). Surge a lista de módulos agrupados por categoria: Cozinha Base, Cozinha Superior, PI Models, Roupeiro." },
      { title:"Escolher e configurar o módulo", text:"Clique num item para abrir o painel flutuante à direita. Vê a pré-visualização 3D do módulo com as dimensões reais. Configure as opções antes de adicionar." },
      { title:"Definir opções: Pés, Porta, Gavetas, Prateleiras", text:"No painel flutuante: ative 'Pés' (adiciona 100mm à altura base), escolha tipo de porta (Sem porta / Simples / Dupla), defina número de gavetas (0-4) e prateleiras (0-5)." },
      { title:"Adicionar ao projeto", text:"Clique em '+ Adicionar ao projeto'. A caixa aparece no viewport como placeholder. Pode adicionar múltiplos módulos seguidos sem sair do painel Móveis." },
      { title:'Clicar em "Gerar Design 3D"', text:"Este é o passo crítico: converte todos os placeholders em BoxModules completos. O sistema calcula painéis, ferragens, furação e custos. O 3D é montado a partir da estrutura calculada." },
    ],
    alerts:[
      { type:"tip",          text:'Pode adicionar múltiplos módulos seguidos sem sair do painel Móveis — o sistema mantém a aba ativa.' },
      { type:"best-practice",text:'Configure todas as caixas antes de clicar "Gerar Design 3D" — o cálculo é feito para todo o projeto de uma vez.' },
      { type:"warning",      text:'Gavetas e portas não podem coexistir na mesma caixa. Ao adicionar gavetas, as portas são automaticamente removidas.' },
    ],
  },
  {
    id:"workspace-mover", icon:"move", label:"Mover e Posicionar", accent:C.purple,
    title:"Mover, rodar e posicionar módulos no workspace",
    intro:"O workspace é a área central onde posiciona os módulos antes do cálculo. Use as ferramentas da barra do viewer (barra horizontal acima do viewport 3D).",
    steps:[
      { title:"Selecionar um módulo (S)", text:"Clique no módulo no viewport 3D. Fica destacado com borda azul. Em alternativa, prima S para ativar a ferramenta de seleção." },
      { title:"Mover nos eixos (M)", text:"Prima M ou clique no ícone de seta cruzada. Surge o gizmo de translação: eixo X (vermelho) para horizontal, eixo Z (azul) para profundidade. Shift+drag bloqueia o eixo Z." },
      { title:"Rodar o módulo (R)", text:"Prima R ou clique no ícone de rotação. Arraste para rodar em torno do eixo Y (vertical). Útil para posicionar módulos em cantos ou parede oposta." },
      { title:"Alinhar pela frente (botão direito)", text:"Clique com o botão direito no módulo → 'Alinhar pela frente do box ao lado'. Alinha a frente (eixo Z) com o módulo vizinho mais próximo." },
      { title:"Auto-posicionamento", text:"O PIMO tem auto-layout: módulos adicionados são posicionados automaticamente lado a lado. Se preferir controlo manual, mova a caixa após adicionar — fica em modo 'posição manual'." },
    ],
    alerts:[
      { type:"tip",    text:"Prima Home para repor a câmara à posição padrão. Prima Escape para cancelar a seleção." },
      { type:"tip",    text:"O sistema deteta colisões entre módulos e mostra avisos no painel inferior (LayoutWarnings)." },
    ],
  },
  {
    id:"materials", icon:"mat", label:"Materiais", accent:C.green,
    title:"Alterar materiais da carcaça e frentes",
    intro:"Cada caixa pode ter material diferente para a carcaça (painéis estruturais) e para as frentes (portas e gavetas). A biblioteca de materiais inclui espessura padrão e custo por m².",
    steps:[
      { title:"Selecionar a caixa", text:"Clique na caixa no viewport ou no painel lateral esquerdo." },
      { title:"Abrir o separador Modelos", text:"Clique no ícone 'Modelos' na barra lateral. Vê a secção 'Material da Carcaça' com a lista de materiais disponíveis." },
      { title:"Escolher material da carcaça", text:"Selecione da lista (ex.: MDF Branco 19, Carvalho Natural, Nogueira). O viewer 3D atualiza em tempo real com o material PBR correto." },
      { title:"Material da frente (portas/gavetas)", text:"Clique com o botão direito na porta ou gaveta no viewport → 'Alterar material da porta' ou 'Alterar material da gaveta'. Permite frente diferente da carcaça." },
      { title:"Custo do material", text:"O resumo financeiro atualiza automaticamente: custo por m² × área total dos painéis desse material." },
    ],
    alerts:[
      { type:"best-practice", text:"Defina o material antes de gerar o design 3D — o cálculo de custo usa o material configurado." },
      { type:"tip",           text:"Materiais adicionados pelo admin ficam disponíveis para todos os projetos. Aceda ao Admin Panel para gerir a biblioteca." },
    ],
  },
  {
    id:"portas-gavetas", icon:"door", label:"Portas e Gavetas", accent:C.amber,
    title:"Configurar portas, gavetas e frentes",
    intro:"O sistema de layers (camadas) do PIMO gera automaticamente a geometria 3D de portas e gavetas com base nas regras industriais de folgas, dobradiças e corrediças.",
    steps:[
      { title:"Tipos de porta disponíveis", text:"Sem porta / Porta simples (uma folha, abertura esquerda ou direita) / Porta dupla (duas folhas, abertura para os lados). O sistema calcula automaticamente o número de dobradiças e as folgas." },
      { title:"Adicionar porta ao módulo selecionado", text:"Com a caixa selecionada, no painel esquerdo em 'Tipo de Porta' escolha Simples ou Dupla. A porta aparece imediatamente no viewer." },
      { title:"Abrir e fechar a porta (animação)", text:"Clique na porta no viewport para a animar. A abertura é calculada com as dobradiças reais — útil para verificar interferências com módulos adjacentes." },
      { title:"Gavetas: número e alturas", text:"Defina o número de gavetas (1-4). As alturas são distribuídas automaticamente respeitando as regras mínimas. O sistema calcula corrediças, recuos e dimensões do corpo interno." },
      { title:"Regras automáticas aplicadas", text:"Ao escolher gavetas: porta removida automaticamente. Ao escolher porta dupla em caixa estreita: aviso de largura mínima. Todas as folgas industriais são aplicadas sem intervenção." },
    ],
    alerts:[
      { type:"warning",      text:"Gavetas e portas são mutuamente exclusivas na mesma caixa. O sistema aplica esta regra automaticamente." },
      { type:"best-practice",text:"Para verificar colisões de abertura de porta com módulos adjacentes, use a animação de abertura antes de exportar." },
      { type:"tip",          text:"A lista de ferragens (dobradiças e corrediças) é gerada automaticamente com base nas configurações definidas." },
    ],
  },
  {
    id:"medicoes", icon:"ruler", label:"Medições e Cotas", accent:C.pink,
    title:"Medições, régua e cotas no viewport",
    intro:"A ferramenta de medição mostra as dimensões reais de cada módulo como etiquetas sobrepostas no viewer 3D. Útil para verificar dimensões antes de exportar.",
    steps:[
      { title:"Ativar medições (D)", text:"Prima D ou clique no ícone de régua na barra do viewer. As etiquetas surgem no módulo selecionado: L (largura, azul), A (altura, verde), P (profundidade, roxo)." },
      { title:"Interpretar os valores", text:"Os valores são em centímetros (ex.: L 80 cm = 800mm). Correspondem às dimensões externas da caixa conforme configurado." },
      { title:"Mudar de módulo", text:"Ao clicar noutro módulo, as etiquetas atualizam automaticamente para as dimensões desse módulo." },
      { title:"Régua manual (medição entre pontos)", text:"No painel de Medições Internas (botão na barra inferior), pode criar medições entre dois pontos específicos da cena — útil para verificar espaços e alinhamentos." },
      { title:"Desativar", text:"Prima D novamente ou clique no ícone de régua. As etiquetas desaparecem." },
    ],
    alerts:[
      { type:"tip", text:"As cotas mostradas são as dimensões externas do módulo. As dimensões internas (dos painéis) são calculadas internamente e visíveis na lista de corte." },
    ],
  },
  {
    id:"lista-corte", icon:"cut", label:"Lista de Corte", accent:C.green,
    title:"Gerar e interpretar a lista de corte",
    intro:"A lista de corte (cutlist) é gerada automaticamente após 'Gerar Design 3D'. Contém todas as peças do projeto com dimensões exatas em milímetros, prontas para o operador CNC.",
    steps:[
      { title:"Aceder à lista de corte", text:"Na barra inferior do workspace, clique em 'Cutlist' ou 'Lista de Corte'. Vê todas as peças organizadas por módulo." },
      { title:"Interpretar cada linha", text:"Cada linha mostra: Nome da peça (ex.: LAT ESQ, TAMPO, COSTA), Comprimento × Largura × Espessura em mm, Material e Custo unitário." },
      { title:"Painéis estruturais incluídos", text:"Lateral esquerda e direita, tampo, fundo, costa (10mm fixo) e prateleiras. Altura das laterais = altura total − (tampo + fundo). Dimensões incluem todas as folgas industriais." },
      { title:"Peças de frente (portas/gavetas)", text:"As frentes das portas e gavetas aparecem separadas dos painéis estruturais. Podem ter material diferente da carcaça." },
      { title:"Ferragens associadas", text:"No separador 'Ferragens' (junto à lista de corte) vê a lista automática: dobradiças, corrediças, suportes de prateleira e cavilhas por módulo." },
    ],
    alerts:[
      { type:"best-practice", text:'Só clicar em "Gerar Design 3D" depois de todas as caixas estarem configuradas — a lista de corte reflete o estado no momento do cálculo.' },
      { type:"tip",           text:"O módulo de nesting (layout de corte) mostra como distribuir as peças nas chapas para minimizar desperdício." },
    ],
  },
  {
    id:"nesting", icon:"grid", label:"Nesting / Layout de Corte", accent:C.purple,
    title:"Nesting e optimização do layout de corte",
    intro:"O módulo de Layout de Corte distribui automaticamente as peças nas chapas disponíveis, minimizando o desperdício de material. Disponível em dois modos.",
    steps:[
      { title:"Aceder ao Layout de Corte", text:"Na barra inferior, clique em 'Layout de Corte' ou 'Nesting'. Vê as chapas com as peças distribuídas visualmente." },
      { title:"Modo Fast", text:"Algoritmo rápido para estimativas. Distribui as peças de forma eficiente sem garantir o resultado ótimo. Ideal para orçamentação rápida." },
      { title:"Modo PRO", text:"Algoritmo otimizado que minimiza o desperdício de material. Considera rotação de 90° das peças para melhor aproveitamento. Recomendado para produção real." },
      { title:"Interpretar o resultado", text:"Cada chapa mostra: peças posicionadas com identificação, área útil usada, percentagem de desperdício e número de chapas necessárias." },
      { title:"Notas sobre furação", text:"Atenção: a rotação de peças no layout PRO pode afetar a orientação dos furos CNC. Verifique sempre o plano de furação antes de enviar para máquina." },
    ],
    alerts:[
      { type:"warning",      text:"Se uma peça for rotacionada 90° no layout PRO, o plano de furação deve ser ajustado manualmente — esta limitação está documentada no sistema." },
      { type:"best-practice",text:"Use o modo PRO apenas para produção final. Para estimativas de custo e material, o modo Fast é suficiente e mais rápido." },
    ],
  },
  {
    id:"exportacao", icon:"export", label:"Exportação", accent:C.accent,
    title:"Exportar ficheiros de produção",
    intro:"O PIMO gera todos os artefactos técnicos necessários para a produção. Cada tipo de exportação serve uma finalidade específica no fluxo industrial.",
    subsections:[
      {
        title:"PDF Técnico",
        steps:[
          { title:"O que inclui", text:"Imagem 3D do projeto, lista de corte completa, resumo de materiais, lista de ferragens e preço total. Formato profissional para apresentar ao cliente ou arquivo de projeto." },
          { title:"Como exportar", text:"Barra superior → botão 'Exportar' → 'PDF Técnico'. O ficheiro é gerado no browser e descarregado automaticamente." },
        ],
      },
      {
        title:"CNC / TCN",
        steps:[
          { title:"O que é o formato TCN", text:"Formato padrão para centros de furação CNC (compatível com Biesse, Homag, SCM e similares). Contém a posição exata de cada furo: diâmetro, profundidade, coordenadas X/Y por painel." },
          { title:"Como exportar", text:"Botão 'Exportar' → 'CNC/TCN'. O sistema gera um ficheiro por módulo. Inclui furação de cavilhas (32mm), corrediças, dobradiças e suportes de prateleira." },
        ],
        alerts:[
          { type:"warning", text:"O ficheiro TCN inclui furação de cavilhas com offset de 9.5mm. Para chapas com espessura diferente de 19mm, verifique o offset antes de maquinar." },
        ],
      },
      {
        title:"Drill XML",
        steps:[
          { title:"O que é o Drill XML", text:"Formato XML estruturado com o plano completo de furação. Mais legível que o TCN e compatível com software de importação personalizado." },
          { title:"Como exportar", text:"Botão 'Exportar' → 'Drill XML'. Um ficheiro por módulo com toda a informação de furação em estrutura hierárquica." },
        ],
      },
      {
        title:"Pacote ZIP completo",
        steps:[
          { title:"O que inclui", text:"PDF técnico + lista de corte CSV + ficheiros CNC/TCN + Drill XML + etiquetas de rastreio — tudo num único ficheiro ZIP." },
          { title:"Como exportar", text:"Botão 'Exportar' → 'Pacote Completo (ZIP)'. Recomendado para enviar para produção: o operador recebe tudo num só ficheiro." },
        ],
        alerts:[
          { type:"best-practice", text:"Use o pacote ZIP como entregável padrão para a fábrica — garante que nenhum ficheiro falta." },
        ],
      },
      {
        title:"Análise arquivo completo (online)",
        steps:[
          { title:"O que é", text:"Consulta e edição documental online dos PDFs industriais em páginas PROJETOS (/analise). Mostra tabelas editáveis — não substitui o ZIP." },
          { title:"Como aceder (Ações finais)", text:"Barra superior → Salvar e Gerar Design → Ações finais → «Análise arquivo completo». Abre o índice dos 9 documentos industriais." },
          { title:"Como aceder (work-orders)", text:"Em /industrial/work-orders, seleccione um projeto e use «Análise arquivo completo»." },
          { title:"Como navegar", text:"No índice, escolha um documento. Cada página mostra tabelas. Use o breadcrumb para voltar." },
          { title:"Como editar", text:"Clique em «Editar», altere células, adicione ou remova linhas, depois «Guardar». «Cancelar» descarta o draft." },
          { title:"Highlight", text:"Células e linhas modificadas ficam destacadas. Linhas novas mostram o badge «Nova»." },
          { title:"Histórico", text:"No índice vê o histórico global; em cada documento vê o histórico desse PDF. Clique numa entrada para saltar à célula (jump-to-cell) com highlight temporário." },
          { title:"Gerar PDF (documento)", text:"Em cada documento: «Gerar PDF» (com edições) ou «Gerar PDF original» (tabular sem overrides). Downloads não registam histórico." },
          { title:"Multi-download (índice)", text:"Seleccione documentos e use: Gerar selecionados / modificados / todos PDFs industriais / originais. Vários ficheiros saem num ZIP só com PDFs (não é o arquivo completo)." },
          { title:"Etiquetas e cutlist editada", text:"Edições na cutlist (material, qtd, observações, peça, caixa) passam às etiquetas UEE. Dimensões e CNC/TCN/drill não mudam. Linhas novas no documento não geram etiqueta; linhas apagadas no documento omitem só a etiqueta." },
          { title:"Validação ao Guardar", text:"Quantidade deve ser inteiro ≥ 1 e material não pode ficar vazio nas linhas que editou — caso contrário o Guardar é bloqueado." },
        ],
        alerts:[
          { type:"tip", text:"A funcionalidade pode estar desligada pela flag industrialOnlineAnalysis (default off em produção)." },
          { type:"warning", text:"Mesmo com a flag off, se o projecto já tiver edições na cutlist, PDFs e etiquetas UEE continuam a reflecti-las; CNC/TCN não mudam. O export mostra um aviso discreto." },
          { type:"best-practice", text:"Guarde o projeto antes de analisar/editar/descarregar, para o snapshot PROJETOS estar atualizado." },
        ],
      },
    ],
    steps:[],
    alerts:[
      { type:"tip", text:'Todos os ficheiros de exportação são gerados em segundos diretamente no browser — sem servidores externos.' },
    ],
  },
  {
    id:"rastreio", icon:"tag", label:"PIMO-TRAK", accent:C.amber,
    title:"Rastreio de peças com PIMO-TRAK",
    intro:"O PIMO-TRAK gera etiquetas com QR code único por peça do projeto. Permite rastrear o estado de cada peça ao longo de todas as fases de produção.",
    steps:[
      { title:"Gerar etiquetas de rastreio", text:"Botão 'Exportar' → 'Etiquetas PDF'. O sistema cria uma etiqueta por peça com QR code, nome do projeto, nome da peça e dimensões." },
      { title:"Imprimir as etiquetas", text:"Etiquetas em formato A4 (múltiplas por página) ou folha de autocolantes. Imprima diretamente do browser após abertura do PDF." },
      { title:"Colar na peça após o corte", text:"Cole a etiqueta na peça imediatamente após o corte CNC. O QR code vincula fisicamente a peça ao projeto digital." },
      { title:"Registar o estado em cada fase", text:"Digitalize o QR code em cada posto de trabalho (corte, furação, lacagem, montagem) para atualizar o estado da peça no sistema PIMO-TRAK." },
      { title:"Consultar estado do projeto", text:"No PIMO-TRAK, qualquer colaborador com acesso pode ver o estado de cada peça e do projeto completo em tempo real." },
    ],
    alerts:[
      { type:"tip",          text:"O QR code é único por peça e por projeto — mesmo peças com as mesmas dimensões têm códigos diferentes." },
      { type:"best-practice",text:"Cole as etiquetas antes de mover as peças da mesa de corte — evita confusões entre peças semelhantes." },
    ],
  },
  {
    id:"projetos", icon:"gear", label:"Gerir Projetos", accent:C.green,
    title:"Guardar, carregar e gerir projetos",
    intro:"O PIMO guarda projetos automaticamente em localStorage (navegador local). Pode também guardar manualmente e carregar projetos anteriores.",
    steps:[
      { title:"Guardar o projeto", text:"O PIMO guarda automaticamente o estado do projeto em intervalos regulares. Para guardar manualmente: barra superior → botão 'Guardar' (ícone de disquete)." },
      { title:"Aceder a projetos guardados", text:"Barra superior → 'Meus Projetos' (ícone de pasta). Lista todos os projetos guardados com data, dimensões e miniatura." },
      { title:"Carregar um projeto", text:"Em 'Meus Projetos', clique no projeto desejado → 'Abrir'. O workspace é restaurado com todos os módulos, materiais e configurações." },
      { title:"Duplicar ou renomear", text:"Clique com o botão direito num projeto → 'Duplicar' para criar uma cópia ou 'Renomear' para alterar o nome." },
      { title:"Exportar e importar projetos", text:"Use 'Exportar Projeto (JSON)' para guardar o ficheiro fora do browser. Útil para partilhar com colegas ou fazer backup externo." },
    ],
    alerts:[
      { type:"warning",      text:"Os projetos estão guardados no localStorage do browser. Se limpar os dados do browser, os projetos são apagados. Use 'Exportar Projeto (JSON)' para backup externo." },
      { type:"best-practice",text:"Dê sempre um nome descritivo ao projeto (ex.: 'Cozinha_JoaoSilva_2026') para facilitar a pesquisa em 'Meus Projetos'." },
    ],
  },
  {
    id:"atalhos", icon:"key", label:"Atalhos de Teclado", accent:C.muted,
    title:"Atalhos de teclado do viewport",
    intro:"O viewport 3D tem atalhos para as ações mais frequentes. Memorizar os principais acelera significativamente o fluxo de trabalho.",
    steps:[
      { title:"S — Selecionar",     text:"Ativa a ferramenta de seleção. Clique num módulo para o selecionar e ver as propriedades no painel esquerdo." },
      { title:"M — Mover",          text:"Ativa o gizmo de translação no módulo selecionado. Arraste nos eixos X (horizontal) ou Z (profundidade)." },
      { title:"R — Rodar",          text:"Ativa o gizmo de rotação. Arraste para rodar em torno do eixo Y (vertical)." },
      { title:"D — Cotas",          text:"Mostra/oculta as etiquetas de dimensão sobrepostas no módulo selecionado (L, A, P em centímetros)." },
      { title:"G — Grelha",         text:"Mostra ou oculta a grelha do chão no viewport." },
      { title:"Home — Câmara",      text:"Repõe a câmara à posição isométrica padrão." },
      { title:"Escape — Cancelar",  text:"Cancela a seleção ativa e volta à ferramenta de seleção." },
      { title:"Ctrl+Z — Desfazer",  text:"Desfaz a última ação no projeto (move, configuração de material, etc.)." },
      { title:"Ctrl+Y — Refazer",   text:"Refaz a última ação desfeita." },
      { title:"Botão direito",      text:"Abre o menu de contexto no módulo clicado: Duplicar, Renomear, Bloquear, Alinhar, Alterar material, Remover." },
    ],
    alerts:[
      { type:"tip", text:"O menu de contexto (botão direito) no viewport é o acesso mais rápido às ações por módulo. Explore todas as opções disponíveis." },
    ],
  },
  {
    id:"orcamentos-p39",
    icon:"ruler",
    label:"Orçamentos P3.9",
    accent:C.system,
    title:"Orçamentos — Centro de Tarifas P3.9",
    intro:"Sistema central de tarifas industriais e financeiras. Cada campo controla uma parte do Financeiro; valores 0 = sem impacto; flags ativam/desativam módulos.",
    subsections:[
      {
        title:"O que é / Como funciona",
        steps:[
          { title:"Abrir Orçamentos", text:"Admin → Sistema → Orçamentos. Persistência em System Settings (pimo_system_settings_v1)." },
          { title:"Defaults neutros", text:"Day-1: tarifas a 0 EUR e flags off. O Financeiro mantém o baseline pré-P3.9 até configurar valores." },
          { title:"Flags e tarifas", text:"Flags (ex.: enableDesperdicio, enableMaoDeObra, enableUnificacao) ligam módulos. Tarifas > 0 passam a entrar no Unificado e nas Peças." },
        ],
        alerts:[
          { type:"tip", text:"ADM / Montagem / Portes / IVA continuam no painel Financeiro (ADM / Montagem / Portes) — Orçamentos não os substitui." },
        ],
      },
      {
        title:"Perfurações / CNC",
        steps:[
          { title:"Drill (EUR / furo)", text:"Tarifa genérica por furo (F3a — computeOperacoesFinanceiras)." },
          { title:"Nesting / CNC (EUR / operação)", text:"Tarifa por peça nestável (área + espessura)." },
        ],
      },
      {
        title:"Custos Industriais",
        steps:[
          { title:"Desperdício e serragem", text:"€/m² com flags enableDesperdicio / enableSerragem; rateio por área nas Peças." },
          { title:"Chapas reais — default", text:"O default de fábrica é «Por peça». Chapas reais no Unificado ficam a 0 € até activar o modo exclusivo no Admin." },
          { title:"Activar Chapas reais (Admin)", text:"Admin → Sistema → Orçamentos → Modo custo material → «Por chapas reais (exclusivo)» → confirmar o procedimento → Guardar. €/chapa = €/m² × área da chapa (derivado; sem tarifa manual)." },
          { title:"Validar no Unificado", text:"Painéis a 0 €; Chapas reais = N × €/chapa só com nesting Real (sheets[]). Se Estimado → 0 € + avisos. Gavetas (montagem), ferragens, orla e ops mantêm-se." },
          { title:"Mão de obra / logística", text:"valorHoraMaquina e logística (€/kg); logística não altera portes P3.6." },
        ],
        alerts:[
          { type:"warning", text:"Não mude o default global no código para por_chapas_reais. Activação é só por configuração Admin (Fase 5E)." },
          { type:"best-practice", text:"Antes de activar: confirme €/m² do material e que o painel Chapas mostra modo Real num projecto de teste." },
        ],
      },
      {
        title:"Operações Industriais Avançadas",
        steps:[
          { title:"Foros tipados", text:"Foro 5mm, cavilha 10×13, cavilha 10×30 — por furo." },
          { title:"Grupos", text:"Calço (grupo de 3) e dobradiça da porta (1 caneco + 2 fixação) — preço por grupo." },
          { title:"Rasgo / corte / quadrilha", text:"Rasgo da gaveta por operação; corte manual por metro (max L,A); me quadrilha por peça." },
        ],
        alerts:[
          { type:"best-practice", text:"Exemplo: 1,30 € em foro 5mm → cada furo Ø5mm soma 1,30 € à peça (e ao Unificado)." },
        ],
      },
      {
        title:"Integração",
        steps:[
          { title:"Peças", text:"precoFinalDaPeca inclui precoOperacoesAvancadas e restantes quotas Orçamentos." },
          { title:"Unificado", text:"custosComputed (operacoes, desperdicio, serragem, chapasReais, maoDeObra, logistica, operacoesAvancadas)." },
          { title:"Industrial intacto", text:"Nenhum impacto em CNC/TCN/cutlist/drill/PDFs industriais." },
        ],
      },
    ],
    steps:[],
    alerts:[
      { type:"warning", text:"Não confundir Orçamentos com portes: logística (€/kg) é independente dos portes P3.6." },
    ],
  },
  {
    id:"sistema-industrial",
    icon:"engineering",
    label:"Sistema Industrial",
    accent:C.system,
    title:"Sistema Industrial — Documentação Completa",
    intro:"O módulo Industrial do PIMO Criativo consolida o chão de fábrica em painéis visuais (estação, operador e supervisor): do QR ao runtime completo, sem alterar APIs, rotas ou lógica de execução existente.",
    subsections:[
      {
        title:"Introdução",
        steps:[
          { title:"O que é o sistema industrial", text:"Camada visual unificada sobre dados já presentes no UI: work-orders, estações, peças, operadores, custos estimados, produtividade e consolidação final." },
          { title:"Onde aparece", text:"Estações (/industrial/work-orders/…), sessão do operador (/industrial/operador) e dashboard do supervisor (/industrial/supervisor)." },
          { title:"Princípio KHALED‑PRO", text:"Tudo é cosmético + leitura leve. As APIs de QR, execução, dados e work-orders permanecem intactas." },
        ],
      },
      {
        title:"Fases Visuais (1 → 6)",
        steps:[
          { title:"Fase Visual 1 — Página principal", text:"Layout industrial de entrada com colunas e canvas stub, alinhado ao shell das estações." },
          { title:"Fase Visual 2 — Shell e rails", text:"Reforço de bordas, toolbar e labels curtos (SUP/NES/DRI…) nos rails." },
          { title:"Fase Visual 3 — Tipografia e densidade", text:"Espaçamento, tipografia e controlos com foco industrial consistente." },
          { title:"Fase Visual 4 — Motion", text:"Transições e entradas suaves em painéis, listas e rails activos." },
          { title:"Fase Visual 5 — Clarity", text:"Contraste, sombras e densidades para leitura rápida no chão de fábrica." },
          { title:"Fase Visual 6 — Vision Tracking", text:"Glows, bordas de fluxo e ênfase na peça seleccionada no canvas." },
        ],
      },
      {
        title:"Fases Industriais (1 → 12)",
        steps:[
          { title:"Fase 1 — QR / execução / dados", text:"Chips visuais de QR e estados waiting/in-progress/completed/blocked sobre dados UI." },
          { title:"Fase 2 — Work Orders Engine", text:"Timeline NES→EMB, progresso, ligação peça→estação, alertas e resumo no supervisor." },
          { title:"Fase 3 — Productivity Engine", text:"Métricas, heatmap, score, timeline e avisos de produtividade (estimativas visuais)." },
          { title:"Fase 4 — Cost Engine", text:"Breakdown, heatmap e resumo de custos estimados por etapa/estação/operador." },
          { title:"Fase 5 — Real Execution Engine", text:"Fluxo actual/seguinte/concluída, sinais e timeline de execução visual." },
          { title:"Fase 6 — Real Data Engine", text:"Indicadores de dados reais (carregados/pendentes/incompletos/inconsistentes)." },
          { title:"Fase 7 — Full Production Engine", text:"Fluxo de produção, sinais, timeline e resumo por estação/operador/etapa." },
          { title:"Fase 8 — Real Integration Engine", text:"Mapa peça→estação→operador→fluxo→produção e sinais de integração." },
          { title:"Fase 9 — Full Industrial Runtime", text:"Runtime activo/pendente/concluído/bloqueado com timeline e resumo." },
          { title:"Fase 10 — Real Operations Engine", text:"Operações activas/pendentes/concluídas/bloqueadas com sinais e resumo." },
          { title:"Fase 11 — Industrial Performance Engine", text:"Eficiência, velocidade, estabilidade, qualidade e heatmap de performance." },
          { title:"Fase 12 — Final Industrial Consolidation", text:"Mapa de consolidação de todos os motores visuais e avisos finais de estabilidade." },
        ],
      },
      {
        title:"Fluxos Industriais",
        steps:[
          { title:"QR", text:"Indicador válido/inválido/pendente a partir da peça seleccionada e do código no painel." },
          { title:"Dados reais", text:"Estado visual dos dados já carregados no UI (snapshot, secções, peças)." },
          { title:"Work-orders", text:"Timeline industrial e progresso derivados de operationType/status existentes." },
          { title:"Produção", text:"Representação activa/pendente/concluída/bloqueada sem alterar produção real." },
          { title:"Runtime", text:"Visão do runtime industrial completo, apenas cosmético." },
          { title:"Integração", text:"Ligações visuais entre peça, estação, operador, fluxo e produção." },
          { title:"Performance", text:"Scores e heatmaps calculados no render a partir de estados UI." },
          { title:"Operações", text:"Sinais e timelines operacionais espelhados no painel." },
          { title:"Consolidação", text:"Resumo final que agrega todos os motores visuais no supervisor." },
        ],
      },
      {
        title:"Como funciona no UI",
        steps:[
          { title:"Só leitura de estado existente", text:"Os painéis leem props/hooks já ligados (selectedTask, pieces, filteredTasks, snapshot)." },
          { title:"Sem APIs novas", text:"Nenhum endpoint, handler ou caminho core/* foi criado ou reescrito nestas fases." },
          { title:"Estimativas visuais", text:"Tempos e custos são constantes/heurísticas de UI para leitura humana — não são facturação real." },
        ],
        alerts:[
          { type:"tip", text:"Use o supervisor para a visão macro; a estação e o operador mostram o mesmo vocabulário visual no contexto local." },
        ],
      },
      {
        title:"Garantias Industriais",
        steps:[
          { title:"Sem APIs novas", text:"QR, execução, dados, work-orders, custos e produção reais mantêm-se intactos." },
          { title:"Sem rotas novas", text:"As rotas /industrial existentes não foram alteradas." },
          { title:"Sem lógica nova de execução", text:"StationPageShell, hooks de operador/supervisor e backend não foram modificados nestas camadas." },
          { title:"Impacto operacional zero", text:"Alterações cosméticas e documentais — o chão de fábrica continua a operar como antes." },
        ],
        alerts:[
          { type:"best-practice", text:"Qualquer integração real futura deve ligar-se às APIs existentes; as camadas visuais já estão preparadas para reflectir esses estados." },
          { type:"warning", text:"Não interpretar scores/custos/tempos desta camada como valores financeiros ou SLA reais." },
        ],
      },
      {
        title:"Finalização",
        steps:[
          { title:"Sistema completo", text:"Fases Visuais 1–6 e Industriais 1–12 estão consolidadas nos painéis StationPanel, OperatorSessionPanel e SupervisorMainArea." },
          { title:"Pronto para integração real futura", text:"A documentação e a UI visual estão fechadas; a ligação a pipelines reais pode evoluir sem reescrever estes painéis." },
          { title:"Tag de finalização", text:"Release industrial final documentada no Centro de Ajuda e nos comentários internos (Finalization Layer)." },
        ],
      },
    ],
    steps:[],
    alerts:[
      { type:"tip", text:"Esta secção descreve apenas a camada visual industrial. A execução real continua nas APIs e fluxos já existentes do PIMO." },
    ],
  },
];

// ── Componentes internos ──────────────────────────────────────────────────────

function Kbd({ label }: { label: string }) {
  return (
    <kbd style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:28,padding:"2px 7px",background:ciTint("var(--ci-chalk, #ffffff)", 7),border:`1px solid ${ciTint("var(--ci-chalk, #ffffff)", 15)}`,borderBottom:`2px solid ${ciTint("var(--ci-chalk, #ffffff)", 10)}`,borderRadius:5,fontSize:11,fontWeight:600,fontFamily:"monospace",color:C.text,flexShrink:0 }}>
      {label}
    </kbd>
  );
}

const ALERT_CFG: Record<AlertType,{ color:string; icon:string; label:string }> = {
  tip:           { color:C.accent,  icon:P.info, label:"Dica"           },
  warning:       { color:C.amber,   icon:P.warn, label:"Atenção"        },
  "best-practice":{ color:C.green, icon:P.star, label:"Boa prática"    },
};

function AlertBox({ type, text }: Alert) {
  const cfg = ALERT_CFG[type];
  return (
    <div style={{ display:"flex",gap:9,padding:"9px 12px",background:ciTint(cfg.color, 6),border:`1px solid ${ciTint(cfg.color, 16)}`,borderRadius:8 }}>
      <Ico d={cfg.icon} size={13} color={cfg.color}/>
      <p style={{ margin:0,fontSize:12,color:C.muted,lineHeight:1.6,fontFamily:font }}>
        <strong style={{ color:cfg.color }}>{cfg.label}: </strong>{text}
      </p>
    </div>
  );
}

function StepList({ steps, alerts }: { steps:Step[]; alerts?:Alert[] }) {
  return (
    <div style={{ display:"flex",flexDirection:"column",gap:12 }}>
      {steps.map((step,i)=>(
        <div key={i} style={{ display:"flex",gap:12,alignItems:"flex-start" }}>
          <div style={{ width:24,height:24,borderRadius:"50%",flexShrink:0,background:C.accentBg,border:`1px solid ${C.accentBd}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:C.accent }}>{i+1}</div>
          <div>
            <p style={{ margin:"1px 0 3px",fontSize:13,fontWeight:600,color:C.text,fontFamily:font }}>{step.title}</p>
            <p style={{ margin:0,fontSize:12,color:C.muted,lineHeight:1.65,fontFamily:font }}>{step.text}</p>
            {step.code&&<code style={{ display:"block",marginTop:6,padding:"5px 9px",background:ciTint("var(--ci-chalk, #ffffff)", 4),border:`1px solid ${ciTint("var(--ci-chalk, #ffffff)", 7)}`,borderRadius:6,fontSize:11,color:C.accent,fontFamily:"monospace" }}>{step.code}</code>}
          </div>
        </div>
      ))}
      {alerts?.map((a,i)=><AlertBox key={i} {...a}/>)}
    </div>
  );
}

function SectionCard({
  section,
  isActive,
  externalGuideUrl,
}: {
  section: Section;
  isActive: boolean;
  externalGuideUrl?: string;
}) {
  const isShortcuts = section.id === "atalhos";
  return (
    <div id={section.id} style={{ background:C.surface,border:`1px solid ${isActive?ciTint(section.accent, 27):C.border}`,borderRadius:14,overflow:"hidden",scrollMarginTop:80,transition:"border-color 0.2s" }}>
      {/* Header */}
      <div style={{ display:"flex",alignItems:"center",gap:12,padding:"15px 20px",borderBottom:`1px solid ${C.border}`,background:ciTint("var(--ci-chalk, #ffffff)", 1.5) }}>
        <div style={{ width:34,height:34,borderRadius:9,flexShrink:0,background:ciTint(section.accent, 9),border:`1px solid ${ciTint(section.accent, 19)}`,display:"flex",alignItems:"center",justifyContent:"center" }}>
          <Ico d={P[section.icon]} size={15} color={section.accent}/>
        </div>
        <div>
          <p style={{ margin:0,fontSize:14,fontWeight:700,color:C.text,fontFamily:font }}>{section.title}</p>
          <p style={{ margin:0,fontSize:11,color:C.muted,fontFamily:font }}>{section.label}</p>
        </div>
      </div>
      {/* Body */}
      <div style={{ padding:"18px 20px",display:"flex",flexDirection:"column",gap:16 }}>
        <p style={{ margin:0,fontSize:13,color:C.muted,lineHeight:1.65,fontFamily:font }}>{section.intro}</p>
        {externalGuideUrl ? (
          <a
            href={externalGuideUrl}
            target="_blank"
            rel="noopener"
            style={{
              display: "inline-flex",
              alignItems: "center",
              width: "fit-content",
              gap: 6,
              padding: "5px 9px",
              borderRadius: 8,
              fontSize: 11,
              color: section.accent,
              textDecoration: "none",
              background: ciTint(section.accent, 8),
              border: `1px solid ${ciTint(section.accent, 19)}`,
              fontFamily: font,
              fontWeight: 600,
            }}
          >
            Ver guia completo em pimo.info ↗
          </a>
        ) : null}

        {isShortcuts ? (
          <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(210px,1fr))",gap:8 }}>
            {section.steps.map((step)=>{
              const [key,...rest] = step.title.split(" — ");
              return (
                <div key={step.title} style={{ display:"flex",alignItems:"flex-start",gap:9,padding:"9px 11px",background:ciTint("var(--ci-chalk, #ffffff)", 2),border:`1px solid ${ciTint("var(--ci-chalk, #ffffff)", 5)}`,borderRadius:8 }}>
                  <Kbd label={key}/>
                  <div>
                    <p style={{ margin:"0 0 2px",fontSize:12,fontWeight:600,color:C.text,fontFamily:font }}>{rest.join(" — ")}</p>
                    <p style={{ margin:0,fontSize:11,color:C.muted,lineHeight:1.5,fontFamily:font }}>{step.text}</p>
                  </div>
                </div>
              );
            })}
            {section.alerts?.map((a,i)=><AlertBox key={i} {...a}/>)}
          </div>
        ) : section.subsections ? (
          <div style={{ display:"flex",flexDirection:"column",gap:22 }}>
            {section.subsections.map((sub)=>(
              <div key={sub.title}>
                <p style={{ margin:"0 0 12px",fontSize:12,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:section.accent,fontFamily:font }}>{sub.title}</p>
                <StepList steps={sub.steps} alerts={sub.alerts}/>
              </div>
            ))}
            {section.alerts?.map((a,i)=><AlertBox key={i} {...a}/>)}
          </div>
        ) : (
          <StepList steps={section.steps} alerts={section.alerts}/>
        )}
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const [active, setActive] = useState("criar-caixa");
  const [viewMode, setViewMode] = useState<"user" | "system">("user");
  const [systemCategory, setSystemCategory] = useState<SystemDocCategoryId>("drawers");

  const openSystemDocs = (category: SystemDocCategoryId = "drawers") => {
    setViewMode("system");
    setSystemCategory(category);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const backToUserHelp = () => {
    setViewMode("user");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div style={{ minHeight:"100vh",background:C.bg,color:C.text,fontFamily:font }}>
      <div style={{ maxWidth: viewMode === "system" ? 1200 : 1080, margin:"0 auto", padding:"0 20px 80px" }}>

        {/* Header */}
        <div style={{ padding:"48px 0 36px",borderBottom:`1px solid ${C.border}`,marginBottom:36 }}>
          <div style={{ display:"inline-flex",alignItems:"center",gap:6,marginBottom:12,padding:"3px 10px",borderRadius:999,fontSize:10,fontWeight:700,letterSpacing:"0.07em",textTransform:"uppercase",background: viewMode === "system" ? "var(--bg-selected, color-mix(in srgb, var(--ci-prussian-400, #38bdf8) 10%, transparent))" : C.accentBg,color: viewMode === "system" ? C.system : C.accent,border: viewMode === "system" ? "1px solid var(--border-selected, color-mix(in srgb, var(--ci-prussian-400, #38bdf8) 25%, transparent))" : `1px solid ${C.accentBd}` }}>
            {viewMode === "system" ? "System Documentation" : "Documentação"}
          </div>
          <h1 style={{ fontSize:"clamp(1.7rem,4vw,2.3rem)",fontWeight:800,margin:"0 0 10px",letterSpacing:"-0.02em" }}>
            {viewMode === "system" ? "Centro de Documentação do Sistema" : "Centro de Ajuda — PIMO Criativo"}
          </h1>
          <p style={{ fontSize:"0.98rem",color:C.muted,maxWidth:640,margin:0,lineHeight:1.6 }}>
            {viewMode === "system"
              ? "Referência técnica READ-ONLY: Master Plan, pipelines industriais, certificação e arquitetura por domínio."
              : "Guias passo a passo baseados no funcionamento real do sistema: do primeiro módulo ao ficheiro CNC."}
          </p>
          {viewMode === "user" ? (
          <div style={{ display:"flex",gap:16,marginTop:20,flexWrap:"wrap" }}>
            {[["12 secções","cobrindo todo o fluxo",C.accent],["Baseado em","código real",C.green],["PT-PT","português europeu",C.purple]].map(([a,b,c])=>(
              <div key={a} style={{ display:"flex",alignItems:"center",gap:6,fontSize:11,color:C.muted }}>
                <div style={{ width:6,height:6,borderRadius:"50%",background:c as string,flexShrink:0 }}/>
                <strong style={{ color:C.text }}>{a}</strong> — {b}
              </div>
            ))}
          </div>
          ) : (
            <button
              type="button"
              onClick={backToUserHelp}
              style={{ marginTop: 16, padding: "8px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, color: C.accent, fontSize: 12, cursor: "pointer" }}
            >
              ← Voltar aos guias de utilizador
            </button>
          )}
        </div>

        {viewMode === "system" ? (
          <SystemDocumentationPage
            category={systemCategory}
            onCategoryChange={setSystemCategory}
            onBackToUserHelp={backToUserHelp}
          />
        ) : (
        <>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
            marginBottom: 18,
            padding: "14px 16px",
            borderRadius: 12,
            background: ciTint(C.accent, 6),
            border: `1px solid ${ciTint(C.accent, 18)}`,
          }}
        >
          <div>
            <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: C.text }}>
              Centro de Ajuda completo em pimo.info
            </p>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: C.muted }}>
              Guias completos, perguntas frequentes, contacto e novidades sempre atualizados.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {[
              { label: "Abrir pimo.info", href: PIMO_INFO_HELP_CENTER_URL },
              { label: "Perguntas frequentes", href: PIMO_INFO_FAQ_URL },
              { label: "Contacto", href: PIMO_INFO_CONTACTO_URL },
              { label: "Novidades", href: PIMO_INFO_NOVIDADES_URL },
            ].map((item) => (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noopener"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "7px 10px",
                  borderRadius: 8,
                  fontSize: 12,
                  color: C.accent,
                  textDecoration: "none",
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  fontWeight: 600,
                }}
              >
                {item.label} ↗
              </a>
            ))}
          </div>
        </div>

        <div style={{ display:"grid",gridTemplateColumns:"198px 1fr",gap:28,alignItems:"start" }}>

          {/* Sidebar nav */}
          <nav style={{ position:"sticky",top:16,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:"8px 6px" }}>
            <p style={{ fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,padding:"4px 10px 8px",margin:0 }}>Conteúdo</p>
            {SECTIONS.map((s)=>(
              <a key={s.id} href={`#${s.id}`} onClick={()=>setActive(s.id)} style={{ display:"flex",alignItems:"center",gap:7,padding:"6px 10px",borderRadius:7,fontSize:12,fontWeight:active===s.id?600:400,color:active===s.id?s.accent:C.muted,background:active===s.id?ciTint(s.accent, 7):"transparent",border:`1px solid ${active===s.id?ciTint(s.accent, 19):"transparent"}`,textDecoration:"none",transition:"all 0.1s",fontFamily:font }}>
                <Ico d={P[s.icon]} size={12} color={active===s.id?s.accent:C.muted}/>
                {s.label}
              </a>
            ))}
            <Link
              to={AJUDA_WHATS_NEW_PATH}
              style={{ display:"flex",alignItems:"center",gap:7,padding:"6px 10px",borderRadius:7,fontSize:12,fontWeight:400,color:C.muted,background:"transparent",border:"1px solid transparent",textDecoration:"none",transition:"all 0.1s",fontFamily:font,marginTop:4 }}
            >
              <span aria-hidden style={{ fontSize:12,lineHeight:1 }}>🆕</span>
              Novidades do Sistema
            </Link>

            <p style={{ fontSize:10,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",color:C.muted,padding:"14px 10px 8px",margin:0,borderTop:`1px solid ${C.border}`,marginTop:8 }}>
              System Documentation
            </p>
            <button
              type="button"
              onClick={() => openSystemDocs("drawers")}
              style={{ display:"flex",alignItems:"center",gap:7,padding:"6px 10px",borderRadius:7,fontSize:12,width:"100%",textAlign:"left",fontWeight:600,color:C.system,background:"var(--bg-selected, color-mix(in srgb, var(--ci-prussian-400, #38bdf8) 8%, transparent))",border:"1px solid var(--border-selected, color-mix(in srgb, var(--ci-prussian-400, #38bdf8) 22%, transparent))",cursor:"pointer",fontFamily:font,marginBottom:4 }}
            >
              <Ico d={P.engineering} size={12} color={C.system}/>
              Índice técnico
            </button>
            {SYSTEM_DOC_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => openSystemDocs(cat.id)}
                style={{ display:"flex",alignItems:"center",gap:7,padding:"5px 10px 5px 22px",borderRadius:7,fontSize:11,width:"100%",textAlign:"left",color: cat.available ? C.muted : C.muted + "88", background:"transparent", border:"none", cursor:"pointer", fontFamily:font }}
              >
                {cat.label}
                {!cat.available ? " (em breve)" : ""}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div style={{ display:"flex",flexDirection:"column",gap:20 }}>
            {SECTIONS.map((s) => (
              <SectionCard
                key={s.id}
                section={s}
                isActive={active === s.id}
                externalGuideUrl={PIMO_INFO_SECTION_URLS[s.id]}
              />
            ))}
          </div>
        </div>
        </>
        )}
      </div>
    </div>
  );
}
