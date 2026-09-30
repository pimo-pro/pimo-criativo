export const PIMO_INFO_BASE_URL = "https://pimo.info";

const buildPimoInfoUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${PIMO_INFO_BASE_URL}${normalizedPath}`;
};

export const PIMO_INFO_HELP_CENTER_URL = buildPimoInfoUrl("/pt-pt/");
export const PIMO_INFO_FAQ_URL = buildPimoInfoUrl("/pt-pt/perguntas-frequentes/");
export const PIMO_INFO_CONTACTO_URL = buildPimoInfoUrl("/pt-pt/contacto/");
export const PIMO_INFO_NOVIDADES_URL = buildPimoInfoUrl("/pt-pt/novidades/");

export const PIMO_INFO_SECTION_URLS: Record<string, string> = {
  "criar-caixa": buildPimoInfoUrl("/pt-pt/guias-utilizador/criar-caixa/"),
  "workspace-mover": buildPimoInfoUrl("/pt-pt/guias-utilizador/mover-e-posicionar/"),
  materials: buildPimoInfoUrl("/pt-pt/guias-utilizador/materiais/"),
  "portas-gavetas": buildPimoInfoUrl("/pt-pt/guias-utilizador/portas-e-gavetas/"),
  medicoes: buildPimoInfoUrl("/pt-pt/guias-utilizador/medicoes-e-cotas/"),
  "lista-corte": buildPimoInfoUrl("/pt-pt/guias-utilizador/lista-de-corte/"),
  nesting: buildPimoInfoUrl("/pt-pt/guias-utilizador/nesting-layout-corte/"),
  exportacao: buildPimoInfoUrl("/pt-pt/guias-utilizador/exportacao/"),
  rastreio: buildPimoInfoUrl("/pt-pt/guias-utilizador/pimo-trak/"),
  projetos: buildPimoInfoUrl("/pt-pt/guias-utilizador/gerir-projetos/"),
  atalhos: buildPimoInfoUrl("/pt-pt/guias-utilizador/atalhos-teclado/"),
  "orcamentos-p39": buildPimoInfoUrl("/pt-pt/documentacao-tecnica/orcamentos-p39/"),
  "sistema-industrial": buildPimoInfoUrl("/pt-pt/documentacao-tecnica/sistema-industrial/"),
};
