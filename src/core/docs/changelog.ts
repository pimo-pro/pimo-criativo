/**
 * Changelog industrial / técnico do PIMO-Criativo.
 * Entradas recentes primeiro. Complementa NovidadesDoSistema.md e
 * public/updates/news.json (Whats New).
 */
export const changelog = [
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
