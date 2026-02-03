/**
 * Modal com visualização 3D isolada da caixa selecionada.
 * Rotação livre, zoom independente.
 */

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { buildBoxLegacy } from "../../3d/objects/BoxBuilder";
import { createWoodMaterial } from "../../3d/materials/WoodMaterial";
import { getMaterialPreset, defaultMaterialSet, mergeMaterialSet } from "../../3d/materials/MaterialLibrary";
import { mmToM } from "../../utils/units";
import type { WorkspaceBox } from "../../core/types";

type Piece3DModalProps = {
  box: WorkspaceBox | null;
  materialTipo?: string;
  /** Se false, não renderiza o modal (evita criar canvas antes de abrir). */
  open?: boolean;
  onClose: () => void;
};

function materialNameToPreset(name: string): string {
  const m: Record<string, string> = {
    "MDF Branco": "mdf_branco",
    "MDF Cinza": "mdf_cinza",
    "MDF Preto": "mdf_preto",
    "Carvalho Natural": "carvalho_natural",
    "Carvalho Escuro": "carvalho_escuro",
    "Nogueira": "nogueira",
  };
  return m[name] ?? "mdf_branco";
}

export default function Piece3DModal({
  box,
  materialTipo = "MDF Branco",
  open = true,
  onClose,
}: Piece3DModalProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open || !box || !containerRef.current) return;

    const w = mmToM(box.dimensoes.largura);
    const h = mmToM(box.dimensoes.altura);
    const d = mmToM(box.dimensoes.profundidade);
    const thickness = mmToM(box.espessura ?? 19);
    const preset = materialNameToPreset(box.models?.[0]?.material ?? materialTipo);
    const materialSet = mergeMaterialSet(defaultMaterialSet);
    const matPreset = getMaterialPreset(materialSet, preset);
    const loaded = matPreset?.maps?.colorMap
      ? createWoodMaterial(matPreset.maps, { envMapIntensity: 0.4 })
      : null;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9);

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(1.2, 1, 1.2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const ambient = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(3, 4, 2);
    dir.castShadow = true;
    scene.add(dir);

    const boxOpts = {
      width: w,
      height: h,
      depth: d,
      thickness,
      material: loaded?.material ?? undefined,
      materialName: preset,
    };
    const boxMesh = buildBoxLegacy(boxOpts);
    boxMesh.position.set(0, h / 2, 0);
    boxMesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
    scene.add(boxMesh);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, h / 2, 0);

    const el = containerRef.current;
    el.appendChild(renderer.domElement);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.display = "block";

    const resize = () => {
      const rect = el.getBoundingClientRect();
      const width = rect.width || 300;
      const height = rect.height || 280;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);

    let raf: number;
    const animate = () => {
      raf = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      el.removeChild(renderer.domElement);
      renderer.dispose();
      controls.dispose();
      boxMesh.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) child.material.forEach((m) => m.dispose());
            else child.material.dispose();
          }
        }
      });
      loaded?.textures?.forEach((t) => t.dispose());
    };
  }, [box, open]);

  if (!box || !open) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <div className="modal-title">Ver Peça em 3D — {box.nome}</div>
          <button type="button" className="modal-close" onClick={onClose}>
            Fechar
          </button>
        </div>
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: 280,
            background: "#f1f5f9",
            borderRadius: 8,
            overflow: "hidden",
          }}
        />
        <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8, padding: "0 16px 16px" }}>
          Arraste para rotacionar. Scroll para zoom.
        </p>
      </div>
    </div>
  );
}
