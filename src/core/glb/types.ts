/**
 * Tipos do pipeline GLB → Lista de Peças.
 * Peças extraídas de uma cena GLTF têm dimensões (bounding box), posição, rotação e material.
 */

export interface ExtractedPart {
  id: string;
  nome: string;
  /** Dimensões em mm (largura = X, altura = Y, profundidade = Z do bounding box). */
  dimensoes: {
    largura: number;
    altura: number;
    profundidade: number;
  };
  /** Espessura em mm (menor dimensão do bbox, ou profundidade se for chapa). */
  espessura: number;
  /** Posição em mm (centro do bounding box em coordenadas de mundo). */
  posicao: { x: number; y: number; z: number };
  /** Rotação em radianos (Euler). */
  rotacao?: { x: number; y: number; z: number };
  /** Sugestão de material a partir do mesh (nome ou cor). */
  materialHint?: string;
}
