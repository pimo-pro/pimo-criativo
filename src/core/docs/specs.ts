export const specs = `
Workspace:
Área principal de posicionamento dos caixotes. Permite distribuir módulos no espaço e organizar o projeto antes do cálculo.

Drop‑in System:
Camada de posicionamento baseada em placeholders. O cálculo só acontece após o utilizador confirmar com “Gerar Design 3D”.

Manufacturing Model:
Modelo industrial que transforma cada caixote em painéis, portas, gavetas e ferragens com regras específicas.

Painéis:
Cima, fundo, laterais (lateral_esquerda, lateral_direita), COSTA (10 mm fixo) e prateleiras. Altura das laterais = altura_total - (espessura_cima + espessura_fundo). Dimensões respeitam espessuras e folgas industriais.

Portas:
Geradas com folgas e critérios de dobradiças. Suporta regras de overlay e inset.

Gavetas:
Respeitam recuos para corrediças e dimensões internas. Frente segue regras das portas.

Ferragens:
Lista automática de dobradiças, corrediças e suportes de prateleira.

Materiais:
Biblioteca com espessura padrão e custo por m², aplicada aos painéis.

Custos:
Cálculo do custo total por m² dos painéis e custos fixos de ferragens.
`;
