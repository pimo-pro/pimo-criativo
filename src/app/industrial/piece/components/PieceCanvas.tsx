import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Edges, OrbitControls, PerspectiveCamera, TransformControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';

import type { RematePiece } from '@/core/remate/remateTypes';
import type { ProjectRodape } from '@/core/rodape/rodapeTypes';
import type { IndustrialPiece } from '@/industrial/core/pieces/types';

import type { EntityTransform, PieceSelectableType, PieceToolMode, PieceTransformMap } from '../types';

interface PieceCanvasProps {
  piece: IndustrialPiece;
  remates: RematePiece[];
  rodapes: ProjectRodape[];
  selectedId: string | null;
  selectedType: PieceSelectableType | null;
  toolMode: PieceToolMode;
  transforms: PieceTransformMap;
  onSelect: (id: string, type: PieceSelectableType) => void;
  onClearSelection: () => void;
  onApplyMatrix: (id: string, matrix: THREE.Matrix4) => void;
}

interface SceneEntity {
  id: string;
  type: PieceSelectableType;
  widthM: number;
  heightM: number;
  depthM: number;
  color: string;
  basePosition: [number, number, number];
  baseRotation: [number, number, number];
}

function buildEntities(
  piece: IndustrialPiece,
  remates: RematePiece[],
  rodapes: ProjectRodape[],
): SceneEntity[] {
  const main: SceneEntity = {
    id: piece.id,
    type: 'piece',
    widthM: Math.max(0.001, piece.dimensions.widthMm / 1000),
    heightM: Math.max(0.001, piece.dimensions.thicknessMm / 1000),
    depthM: Math.max(0.001, piece.dimensions.heightMm / 1000),
    color: '#8b9cb3',
    basePosition: [0, Math.max(0.001, piece.dimensions.thicknessMm / 2000), 0],
    baseRotation: [0, 0, 0],
  };

  const remateEntities = remates.map((remate, index) => ({
    id: remate.id,
    type: 'remate' as const,
    widthM: Math.max(0.001, remate.width / 1000),
    heightM: Math.max(0.001, remate.height / 1000),
    depthM: Math.max(0.001, remate.depth / 1000),
    color: remate.tipo === 'RODAPE' ? '#b08968' : '#6c8f7c',
    basePosition: [
      (remate.position?.xMm ?? 0) / 1000,
      (remate.position?.yMm ?? 0) / 1000 + 0.02,
      (remate.position?.zMm ?? 0) / 1000 - 0.25 - index * 0.05,
    ] as [number, number, number],
    baseRotation: [
      remate.rotation?.xRad ?? 0,
      remate.rotation?.yRad ?? 0,
      remate.rotation?.zRad ?? 0,
    ] as [number, number, number],
  }));

  const rodapeEntities = rodapes.map((rodape, index) => ({
    id: rodape.id,
    type: 'rodape' as const,
    widthM: Math.max(0.001, (rodape.dimensions?.widthMm ?? 600) / 1000),
    heightM: Math.max(0.001, (rodape.heightMm ?? 100) / 1000),
    depthM: Math.max(0.001, (rodape.dimensions?.depthMm ?? 18) / 1000),
    color: '#a47148',
    basePosition: [
      (rodape.transform?.xMm ?? 0) / 1000,
      (rodape.heightMm ?? 100) / 2000,
      (rodape.transform?.zMm ?? 0) / 1000 - 0.35 - index * 0.06,
    ] as [number, number, number],
    baseRotation: [
      0,
      ((rodape.transform?.rotacaoYRad ?? 0) * Math.PI) / 180,
      0,
    ] as [number, number, number],
  }));

  return [main, ...remateEntities, ...rodapeEntities];
}

function mergeTransform(base: EntityTransform, override?: EntityTransform): EntityTransform {
  if (!override) return base;
  return {
    position: [
      base.position[0] + override.position[0],
      base.position[1] + override.position[1],
      base.position[2] + override.position[2],
    ],
    rotation: [
      base.rotation[0] + override.rotation[0],
      base.rotation[1] + override.rotation[1],
      base.rotation[2] + override.rotation[2],
    ],
  };
}

function SelectableMesh({
  entity,
  transform,
  selected,
  meshRef,
  onSelect,
}: {
  entity: SceneEntity;
  transform: EntityTransform;
  selected: boolean;
  meshRef: (node: THREE.Mesh | null) => void;
  onSelect: () => void;
}) {
  return (
    <mesh
      ref={meshRef}
      position={transform.position}
      rotation={transform.rotation}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[entity.widthM, entity.heightM, entity.depthM]} />
      <meshStandardMaterial color={entity.color} roughness={0.65} metalness={0.05} />
      {selected ? <Edges color="#38bdf8" /> : null}
    </mesh>
  );
}

function SceneGizmo({
  target,
  mode,
  onCommit,
  onDragging,
}: {
  target: THREE.Object3D | null;
  mode: 'translate' | 'rotate';
  onCommit: (matrix: THREE.Matrix4) => void;
  onDragging: (dragging: boolean) => void;
}) {
  if (!target) return null;

  return (
    <TransformControls
      object={target}
      mode={mode}
      size={0.75}
      onMouseDown={() => onDragging(true)}
      onMouseUp={() => {
        onDragging(false);
        onCommit(target.matrix.clone());
      }}
    />
  );
}

function PieceCanvasScene({
  entities,
  transforms,
  selectedId,
  toolMode,
  onSelect,
  onClearSelection,
  onApplyMatrix,
}: {
  entities: SceneEntity[];
  transforms: PieceTransformMap;
  selectedId: string | null;
  toolMode: PieceToolMode;
  onSelect: (id: string, type: PieceSelectableType) => void;
  onClearSelection: () => void;
  onApplyMatrix: (id: string, matrix: THREE.Matrix4) => void;
}) {
  const orbitRef = useRef<OrbitControlsImpl>(null);
  const meshRefs = useRef<Record<string, THREE.Mesh | null>>({});
  const [dragging, setDragging] = useState(false);
  const [selectedMesh, setSelectedMesh] = useState<THREE.Object3D | null>(null);

  const resolved = useMemo(
    () =>
      entities.map((entity) => {
        const base: EntityTransform = {
          position: entity.basePosition,
          rotation: entity.baseRotation,
        };
        const override = transforms[entity.id];
        return { entity, transform: mergeTransform(base, override) };
      }),
    [entities, transforms],
  );

  useEffect(() => {
    if (!selectedId) {
      setSelectedMesh(null);
      return;
    }
    setSelectedMesh(meshRefs.current[selectedId] ?? null);
  }, [selectedId, resolved]);

  return (
    <>
      <PerspectiveCamera makeDefault position={[1.8, 1.2, 2.2]} fov={42} near={0.01} far={200} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 6, 3]} intensity={1.1} castShadow />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow onClick={onClearSelection}>
        <planeGeometry args={[8, 8]} />
        <meshStandardMaterial color="#0b1220" />
      </mesh>
      <gridHelper args={[8, 32, '#1e293b', '#1e293b']} position={[0, 0.001, 0]} />

      {resolved.map(({ entity, transform }) => (
        <SelectableMesh
          key={entity.id}
          entity={entity}
          transform={transform}
          selected={selectedId === entity.id}
          meshRef={(node) => {
            meshRefs.current[entity.id] = node;
            if (selectedId === entity.id) setSelectedMesh(node);
          }}
          onSelect={() => onSelect(entity.id, entity.type)}
        />
      ))}

      {selectedMesh && toolMode !== 'select' ? (
        <SceneGizmo
          target={selectedMesh}
          mode={toolMode === 'move' ? 'translate' : 'rotate'}
          onCommit={(matrix) => {
            if (selectedId) onApplyMatrix(selectedId, matrix);
          }}
          onDragging={(value) => {
            setDragging(value);
            if (orbitRef.current) orbitRef.current.enabled = !value;
          }}
        />
      ) : null}

      <OrbitControls
        ref={orbitRef}
        enableDamping
        dampingFactor={0.06}
        enabled={!dragging}
        minDistance={0.4}
        maxDistance={12}
        target={[0, 0.2, 0]}
      />
    </>
  );
}

export default function PieceCanvas({
  piece,
  remates,
  rodapes,
  selectedId,
  selectedType,
  toolMode,
  transforms,
  onSelect,
  onClearSelection,
  onApplyMatrix,
}: PieceCanvasProps) {
  const entities = useMemo(() => buildEntities(piece, remates, rodapes), [piece, remates, rodapes]);

  return (
    <div
      style={{
        position: 'relative',
        minHeight: 480,
        height: 'calc(100vh - 240px)',
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid var(--border, #334155)',
        background: '#020617',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 8,
          zIndex: 2,
          fontSize: 11,
          color: '#94a3b8',
          background: 'rgba(2,6,23,0.7)',
          padding: '4px 8px',
          borderRadius: 6,
        }}
      >
        {selectedId ? `Seleccionado: ${selectedType} · ${selectedId}` : 'Clique para seleccionar · M mover · R rodar · Setas mover · Q/E rodar'}
      </div>
      <Canvas
        shadows
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
        }}
      >
        <Suspense fallback={null}>
          <PieceCanvasScene
            entities={entities}
            transforms={transforms}
            selectedId={selectedId}
            toolMode={toolMode}
            onSelect={onSelect}
            onClearSelection={onClearSelection}
            onApplyMatrix={onApplyMatrix}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
