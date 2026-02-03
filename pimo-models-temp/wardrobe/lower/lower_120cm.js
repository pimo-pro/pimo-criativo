/**
 * Modelo 3D: Guarda-roupa Inferior 120cm
 * Categoria: Guarda-roupa - Inferior
 * Descrição: Caixa guarda-roupa inferior com largura fixa de 120cm
 * 
 * Estrutura:
 * - Laterais: 210cm altura x 55cm profundidade
 * - Base: 120cm largura x 55cm profundidade
 * - Topo: 120cm largura x 55cm profundidade
 * - Costas: 210cm altura x 120cm largura
 * 
 * Espessura padrão: 19mm (laterais, base, topo)
 * Espessura costa: 10mm
 */

// Metadados do modelo
const metadata = {
  name: "Guarda-roupa Inferior 120cm",
  category: "wardrobe_lower",
  description: "Caixa guarda-roupa inferior com largura fixa de 120cm",
  dimensions: {
    width: 1200, // mm
    height: 2100, // mm
    depth: 550   // mm
  },
  thickness: {
    main: 19,    // mm (laterais, base, topo)
    back: 10     // mm (costas)
  },
  rules: {
    height: { min: 1800, max: 2400 },   // mm
    depth: { min: 500, max: 600 },      // mm
    width: { min: 1200, max: 1200 }     // mm (fixo)
  }
};

/**
 * Gera as peças da caixa guarda-roupa inferior
 * @param {Object} dim - Dimensões { width, height, depth }
 * @returns {Array} Lista de peças com dimensões calculadas
 */
function generateParts(dim) {
  const { width, height, depth } = dim;
  const espessura = metadata.thickness.main;
  const espessuraCosta = metadata.thickness.back;
  
  // Cálculo das dimensões internas
  const larguraInterna = width - (2 * espessura);
  const profundidadeInterna = depth - espessura;
  const alturaInterna = height - (2 * espessura);
  
  const parts = [];
  
  // 1. Laterais (2 peças)
  parts.push({
    id: "lateral_esquerda",
    name: "Lateral Esquerda",
    type: "lateral",
    width: alturaInterna,
    height: profundidadeInterna,
    thickness: espessura,
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  });
  
  parts.push({
    id: "lateral_direita",
    name: "Lateral Direita",
    type: "lateral",
    width: alturaInterna,
    height: profundidadeInterna,
    thickness: espessura,
    position: { x: width - espessura, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  });
  
  // 2. Base
  parts.push({
    id: "base",
    name: "Base",
    type: "base",
    width: larguraInterna,
    height: profundidadeInterna,
    thickness: espessura,
    position: { x: espessura, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  });
  
  // 3. Topo
  parts.push({
    id: "topo",
    name: "Topo",
    type: "topo",
    width: larguraInterna,
    height: profundidadeInterna,
    thickness: espessura,
    position: { x: espessura, y: height - espessura, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  });
  
  // 4. Costas
  parts.push({
    id: "costas",
    name: "Costas",
    type: "costas",
    width: alturaInterna,
    height: larguraInterna,
    thickness: espessuraCosta,
    position: { x: espessura, y: espessura, z: 0 },
    rotation: { x: 0, y: 0, z: 0 }
  });
  
  return parts;
}

/**
 * Gera a estrutura 3D da caixa
 * @param {Object} dim - Dimensões { width, height, depth }
 * @returns {Object} Estrutura 3D pronta para renderização
 */
function generate3D(dim) {
  const parts = generateParts(dim);
  
  return {
    metadata: metadata,
    parts: parts,
    dimensions: dim,
    assembly: {
      type: "box",
      joints: "dovetail",
      finish: "melamine"
    }
  };
}

/**
 * Retorna as regras de dimensionamento
 * @returns {Object} Regras de altura, largura e profundidade
 */
function getRules() {
  return metadata.rules;
}

// Export padrão
export default {
  metadata,
  generateParts,
  generate3D,
  getRules
};