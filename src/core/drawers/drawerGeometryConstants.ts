/** Folga vertical fixa entre frentes consecutivas no mesmo módulo (mm). */

export const DRAWER_VERTICAL_GAP_MM = 4;



/** Folga lateral padrão da frente (mm por lado) — espelha settings.gavetaFolgaFrenteMm. */

export const DRAWER_FRONT_LATERAL_GAP_MM = 2;



/**
 * Fração da altura da frente deixada livre no topo (documentação legado 0,25).
 * @deprecated Produção usa deltas absolutos (DRAWER_BODY_DELTA_*).
 */
export const DRAWER_SIDE_TOP_CLEARANCE_RATIO = 0.25;

/**
 * @deprecated Preferir DRAWER_LOWEST_SIDE_HEIGHT_RATIO (legado ratio).
 * Mantido como alias do antigo default Admin (25% → 0,75) para imports legado.
 */
export const DRAWER_SIDE_HEIGHT_RATIO = 0.75;

/**
 * @deprecated Modelo ratio (pré–gavita 8). Produção usa DRAWER_BODY_DELTA_*.
 * R_real = bodyH / frontH = 0,685 — não usar para geometria nova.
 */
export const DRAWER_LOWEST_SIDE_HEIGHT_RATIO = 0.685;
/** @deprecated Folga relativa no topo com R_real: 1 − 0,685. */
export const DRAWER_LOWEST_SIDE_TOP_CLEARANCE_RATIO =
  1 - DRAWER_LOWEST_SIDE_HEIGHT_RATIO;

/**
 * Elevação da base das laterais/costa em relação à base da frente (mm).
 * Intervalo: 12,5 … 60. Produção: DRAWER_BODY_ELEVATION_FROM_FRONT_MM = 48.
 */
export const DRAWER_SIDE_BASE_ELEVATION_MIN_MM = 12.5;
export const DRAWER_SIDE_BASE_ELEVATION_MAX_MM = 60;

/**
 * Elevação corpo ↔ base da frente (mm) — SSOT industrial gavita 8 / drill certo.
 * Unificada em todas as gavetas (lowest/middle/highest/single).
 * Furos frente: elev+15 / elev+sideH−35 / rasgo elev+sideH−13.
 */
export const DRAWER_BODY_ELEVATION_FROM_FRONT_MM = 48;

/** Alias de produção — aponta para elevação unificada 48. */
export const DRAWER_SIDE_BASE_ELEVATION_MM = DRAWER_BODY_ELEVATION_FROM_FRONT_MM;

/**
 * @deprecated Valor legado de `highest` antes da unificação (12,5).
 * Não usar para gerar geometria nova.
 */
export const DRAWER_HIGHEST_BODY_ELEVATION_FROM_FRONT_MM = 12.5;

/**
 * Offset da 1.ª frente relativamente à base do módulo (B0, mm).
 * Diff 3 / gavita 8: B0 = 0 — frente inferior flush à base do vão.
 * bodyBottom = B0 + E(48) = 48 mm.
 */
export const DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM = 0;

/** Alias SSOT do stack — igual a B0. */
export const DRAWER_STACK_BASE_OFFSET_MM =
  DRAWER_LOWEST_FRONT_BOTTOM_FROM_MODULE_BASE_MM;

/**
 * Ajuste da 1.ª frente no modo equal (equal_quase interno, mm).
 * hEqual = (distributable − ajuste) / n
 * frente(0) = hEqual + ajuste; frente(i>0) = (distributable − frente(0)) / (n−1)
 */
export const DRAWER_STACK_GAVETA1_ADJUST_MM = -2;

/**
 * Alias GAV_1 — mesma elevação unificada 48 (já não 16,5).
 * Furos da frente: pairing `elev+15` / `elev+sideH−35` / rasgo `elev+sideH−13`.
 */
export const DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM =
  DRAWER_BODY_ELEVATION_FROM_FRONT_MM;

/**
 * @deprecated Folga single T+18,5 — Diff 2 unifica elevação em 48.
 */
export const DRAWER_SINGLE_BODY_CLEARANCE_ABOVE_FLOOR_MM = 18.5;
/** @deprecated Alias — aponta para elevação unificada 48. */
export const DRAWER_LOWEST_CLEARANCE_ABOVE_FLOOR_PANEL_MM =
  DRAWER_LOWEST_BODY_ABOVE_MODULE_BASE_MM;

/**
 * Delta frente − lateral (mm) — modelo dinâmico gavita 8.
 * lateralHeight = frontHeight − delta(role)
 * GAV_1: 262,67 − 177,17 = 85,5 · 2ª/3ª: 264,67 − 196,17 = 68,5
 */
export const DRAWER_BODY_DELTA_LOWEST_MM = 85.5;
export const DRAWER_BODY_DELTA_UPPER_MM = 68.5;

/**
 * Furação industrial da frente do gaveta inferior (`stackRole = "lowest"`).
 * Legado / referência XML_COMPLITO: Y = W−56.5, X inset = 12.
 * Produção actual: mesmo padrão das frentes 2/3 via `computeDrawerFrenteExtStructuralHoles`
 * (rasgo elev+sideH−13; cavilhas elev+15 / elev+sideH−35).
 * `computeDrawerLowestFrenteExtFixedHoles` (legado golden) vive em
 * `drilling/drawerLowestFrenteExtFixedHoles.legacy.ts` — não usar em produção.
 * `DRAWER_LOWEST_FRONT_DOWEL_FROM_TOP_MM` (73.5) é legado — não usar para gerar furos.
 */
export const DRAWER_LOWEST_FRONT_GROOVE_FROM_TOP_MM = 56.5;
/** @deprecated Não usar na geração — substituído pelo pairing elev+Y_aresta. */
export const DRAWER_LOWEST_FRONT_DOWEL_FROM_TOP_MM = 73.5;
export const DRAWER_LOWEST_FRONT_GROOVE_X_INSET_MM = 12;
export const DRAWER_LOWEST_FRONT_DOWEL_X_INSET_MM = 33;

/** @deprecated Alias — valor é “desde o topo”; usar DRAWER_LOWEST_FRONT_GROOVE_FROM_TOP_MM. */
export const DRAWER_LOWEST_FRONT_GROOVE_Y_MM = DRAWER_LOWEST_FRONT_GROOVE_FROM_TOP_MM;
/** @deprecated Alias — valor é “desde o topo”; usar DRAWER_LOWEST_FRONT_DOWEL_FROM_TOP_MM. */
export const DRAWER_LOWEST_FRONT_DOWEL_Y_MM = DRAWER_LOWEST_FRONT_DOWEL_FROM_TOP_MM;

/**
 * Rasgos inferiores dos laterais (LAT_ESQ / LAT_DIR) — SSOT industrial permanente.
 * Y / Width / Depth são fixos relativos a W; só o comprimento CAD adapta-se a L
 * (BeginX=L+overcut … EndX=−overcut). Independente da frente / stack.
 *
 * Ref: GAVETA 1/XML_COMPLITO/caixa_1_gav_lat_esq_drill.xml
 */
/** Rasgo 1 (mais próximo da borda superior): Y=W−13, Width=13, Depth=3. */
export const DRAWER_LAT_GROOVE_TOP_FROM_TOP_MM = 13;
export const DRAWER_LAT_GROOVE_TOP_WIDTH_MM = 13;
export const DRAWER_LAT_GROOVE_TOP_DEPTH_MM = 3;
/** Rasgo 2 (mais acima do fundo / mais baixo no painel): Y=W−23, Width=11, Depth=10. */
export const DRAWER_LAT_GROOVE_BOTTOM_FROM_TOP_MM = 23;
export const DRAWER_LAT_GROOVE_BOTTOM_WIDTH_MM = 11;
export const DRAWER_LAT_GROOVE_BOTTOM_DEPTH_MM = 10;
/** Sangria CAD: BeginX=L+10, EndX=−10. */
export const DRAWER_LAT_GROOVE_OVERCUT_MM = 10;
/** Correction KDT nos rasgos laterais. */
export const DRAWER_LAT_GROOVE_CORRECTION = 2;
/** Ferramenta KDT dos rasgos laterais. */
export const DRAWER_LAT_GROOVE_TOOL_NAME = "FRESA_DESBASTE_10MM";

/**
 * Costa = altura_lateral − K (mm). SSOT industrial gavita 8 / drill certo.
 * Já não é lateral × 0,685.
 */
export const DRAWER_COSTA_HEIGHT_BELOW_LATERAL_MM = 23;

/** Entrada do fundo no rasgo da frente (mm). */
export const DRAWER_BOTTOM_FRONT_ENTRY_MM = 10;
/** Entrada do fundo no rasgo de cada lateral (mm). */
export const DRAWER_BOTTOM_SIDE_ENTRY_MM = 10;
/**
 * Profundidade do rasgo na frente: espessura do fundo + 1 mm.
 * Ex.: fundo 10 → rasgo 11.
 */
export const DRAWER_BOTTOM_GROOVE_DEPTH_EXTRA_MM = 1;
/**
 * SSOT industrial — profundidade do rasgo na frente (GAV_FRENT_EXT / GAV_FRENTE).
 * Sempre 11 mm (= T_fundo 10 + 1). Não confundir com Width do TypeNo=3.
 */
export const DRAWER_FRONT_BOTTOM_GROOVE_DEPTH_MM = 10 + DRAWER_BOTTOM_GROOVE_DEPTH_EXTRA_MM;
/**
 * Largura (Width) do rasgo inferior da frente — TypeNo=3.
 * Fundo 10 mm → Width 11 mm (folga 1 mm). Laterais usam DRAWER_LAT_GROOVE_* próprias.
 */
export const DRAWER_BOTTOM_GROOVE_WIDTH_MM = 11;
/** Distância do topo da lateral ao eixo do rasgo (mm). */
export const DRAWER_BOTTOM_GROOVE_Y_FROM_TOP_MM = 13;
/**
 * Furos inferiores da costa (TypeNo1 em Y=W, X=8 / L−8): Ø e Depth industriais.
 * Qualquer legado Ø5 nestes dois furos deve ser Ø10 (XML_COMPLITO).
 */
export const DRAWER_COSTA_BOTTOM_FACE_DIAMETER_MM = 10;
export const DRAWER_COSTA_BOTTOM_FACE_DEPTH_MM = 10;

/**
 * @deprecated Usar `DRAWER_SIDE_TOP_CLEARANCE_RATIO` — delta fixo substituído por 25% proporcional.
 */
export const DRAWER_BODY_HEIGHT_BELOW_FRONT_MM = 12;


