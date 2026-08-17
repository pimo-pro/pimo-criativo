/**
 * Changelog industrial / técnico do PIMO-Criativo.
 * Entradas recentes primeiro. Complementa NovidadesDoSistema.md e
 * public/updates/news.json (Whats New).
 */
export const changelog = [
  {
    data: "2026-08-17",
    versao: "tampo-industrial-v1",
    descricao:
      "Integração industrial completa do TAMPO (A–F): chapa MDB 3660×630×30, geometria tipada sem Three.js, PDF/TCN poligonais, XML excluído; caixaria 19 mm intacta.",
  },
  {
    data: "2026-08-17",
    versao: "tampo-angle-geometry",
    descricao:
      "Correção TAMPO angular — geometria estável, frente≠trás, ângulo real, postforming seguro; montagem retangular intacta.",
  },
  {
    data: "2026-08-17",
    versao: "tampo-angular-pose",
    descricao:
      "Correção TAMPO angular — frente≠trás, pose horizontal, rotação preservada; montagem retangular intacta.",
  },
  {
    data: "2026-08-16",
    versao: "tampo-v1",
    descricao:
      "TAMPO Cozinha Fases 1–4: matéria MDB Laminado 30 (3660×630); TAMPO_COZINHA industrial+viewer postforming; recortes fogão/pia/retangular/circular; união entre tampos overlap 5–10 mm.",
  },
  {
    data: "2026-08-15",
    versao: "viewer-drawer-visual-flip",
    descricao:
      "Flip visual Viewer-only do corpo da gaveta (drawerVisualBodyFlip): desnível grande 48 mm no topo, pequeno ~20,5 mm na base; indústria intacta; flag DRAWER_VIEWER_BODY_VERTICAL_FLIP removível.",
  },
  {
    data: "2026-08-14",
    versao: "Diff1+Diff2+Diff3",
    descricao:
      "Publicação completa — Sistema de Gavetas Industrial (gavita 8): corrediças Y pitch 41/288,67/555,33; corpo laterais/costa/elev 48; stack equal_quase frentes 262,67/264,67/264,67; laterais 177,17/196,17/196,17; costas 154,17/173,17/173,17. Testes 97/97 OK.",
  },
  {
    data: "2026-08-11",
    versao: "P3.15",
    descricao:
      "Release P3.11–P3.15 — prateleiras independentes; gaveteiro certificado (orientação XML, SSOT gav_fundo, meta elev=, docs sideDepth=bodyDepth−10, legado 53 mm isolado).",
  },
  {
    data: "2026-08-05",
    versao: "v6.0805.1648",
    descricao:
      "ESTÁVEL — Quadro V6 furos intermédios industriais: 38+b1(NL); lookup SSOT 250–500; 550/600 fallback proporcional; removido setback −1. Referência: v-ref-quadroV6-38b1-0805.",
  },
  {
    data: "2026-08-05",
    versao: "v6.0805.1621",
    descricao:
      "Folga vertical DIV↔SEP ≥ 5 mm: alturaDIV = floor(SEP.bottomY − T − 5). Furos LAT no centro do SEP.",
  },
  {
    data: "2026-08-05",
    versao: "v6.0805.1551",
    descricao:
      "gav_fundo: eixos corrigidos — width=vão+20, depth=sideDepth+10+T_costa (550×500 → 486×466).",
  },
  {
    data: "2026-08-05",
    versao: "v6.0805.1519",
    descricao:
      "SEP LAT Y = absoluteY−T (Viewer/cutlist/DRILL/TCN alinhados, delta=0). Rasgo frente gaveta Width 11 mm (Depth 11, centro intacto).",
  },
  {
    data: "2026-08-05",
    versao: "v6.0805.1229",
    descricao:
      "Materiais SSOT na seleção (família + espessura), texturas reais e cartas por família.",
  },
  {
    data: "2026-08-04",
    versao: "v6.0804.1713",
    descricao: "Restaurar ORLA completa e gavetas a 15 EUR.",
  },
  {
    data: "2026-08-03",
    versao: "v6.0803.2052",
    descricao: "Elevação real do gaveta inferior — 18,5 mm acima do FUNDO.",
  },
];
