/**
 * Modelo 3D: Superior de Cozinha 35cm profundidade - 90cm largura
 * Categoria: Cozinha - Superior
 * Descrição: Caixa superior de cozinha com profundidade de 35cm e largura fixa de 90cm
 * 
 * Estrutura:
 * - Laterais: 72cm altura x 35cm profundidade
 * - Base: 90cm largura x 35cm profundidade
 * - Topo: 90cm largura x 35cm profundidade
 * - Costas: 72cm altura x 90cm largura
 * 
 * Espessura padrão: 19mm (laterais, base, topo)
 * Espessura costa: 10mm
 */

// Metadados do modelo
const metadata = {
  name: "Superior de Cozinha 35d - 90cm",
  category: "cozinha_superior",
  description: "Caixa superior de cozinha com profundidade de 35cm e largura fixa de 90cm",
  dimensions: {
    width: 900,  // mm
    height: 720, // mm
    depth: 350   // mm
  },
  thickness: {
    main: 19,    // mm (laterais, base, topo)
    back: 10     // mm (costas)
  },
  rules: {
    height: { min: 600, max: 800 },     // mm
    depth: { min: 350, max: 350 },      // mm (fixo)
    width: { min: 900, max: 900 }       // mm (fixo)
  }
};

/**
 * Gera as peças da caixa superior
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