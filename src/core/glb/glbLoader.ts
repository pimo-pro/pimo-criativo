import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

/**
 * Carrega um ficheiro GLB/GLTF e devolve o Group pronto para inserir no Viewer.
 */
export async function loadGLB(modelPath: string): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(modelPath);
  return gltf.scene;
}
