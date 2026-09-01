import { Suspense, useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, OrbitControls, PerspectiveCamera, useGLTF } from '@react-three/drei';

import { industrialBtnStyle, industrialSectionTitleStyle } from '@/industrial/ui/layouts/industrialStyles';

import { listFerragens3D, maxExtentMeters, type Ferragem3DEntry } from './ferragens3dCatalog';

interface Ferragens3DOverlayProps {
  open: boolean;
  onClose: () => void;
}

function FerragemModel({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const scene = useMemo(() => gltf.scene.clone(true), [gltf.scene]);
  return <primitive object={scene} />;
}

function Scene({ entry }: { entry: Ferragem3DEntry }) {
  const extent = maxExtentMeters(entry);
  const camDist = Math.max(0.08, extent * 2.4);

  return (
    <>
      <PerspectiveCamera makeDefault position={[camDist, camDist * 0.7, camDist]} fov={40} near={0.001} far={50} />
      <ambientLight intensity={0.65} />
      <directionalLight position={[2.5, 4, 2]} intensity={1.15} />
      <directionalLight position={[-2, 1.5, -1.5]} intensity={0.35} />
      <Suspense fallback={null}>
        <Bounds fit clip observe margin={1.35} key={entry.id}>
          <Center>
            <FerragemModel url={entry.modelUrl} />
          </Center>
        </Bounds>
      </Suspense>
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.01} maxDistance={20} />
    </>
  );
}

function MedidasPanel({ entry }: { entry: Ferragem3DEntry }) {
  const m = entry.medidas;
  const dims = m.bounding_box_mm?.dimensoes;
  return (
    <dl style={{ margin: 0, display: 'grid', gap: 6, fontSize: 11, color: '#cbd5e1' }}>
      <div>
        <dt style={{ color: '#94a3b8' }}>Tipo</dt>
        <dd style={{ margin: 0 }}>{m.tipo}</dd>
      </div>
      {m.norma ? (
        <div>
          <dt style={{ color: '#94a3b8' }}>Norma</dt>
          <dd style={{ margin: 0 }}>{m.norma}</dd>
        </div>
      ) : null}
      {m.material ? (
        <div>
          <dt style={{ color: '#94a3b8' }}>Material</dt>
          <dd style={{ margin: 0 }}>{m.material}</dd>
        </div>
      ) : null}
      {m.escala ? (
        <div>
          <dt style={{ color: '#94a3b8' }}>Escala</dt>
          <dd style={{ margin: 0 }}>{m.escala}</dd>
        </div>
      ) : null}
      {m.sistema_coordenadas ? (
        <div>
          <dt style={{ color: '#94a3b8' }}>Coordenadas</dt>
          <dd style={{ margin: 0 }}>{m.sistema_coordenadas}</dd>
        </div>
      ) : null}
      {dims ? (
        <div>
          <dt style={{ color: '#94a3b8' }}>Bounding box (mm)</dt>
          <dd style={{ margin: 0 }}>
            {dims[0]} × {dims[1]} × {dims[2]}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

export default function Ferragens3DOverlay({ open, onClose }: Ferragens3DOverlayProps) {
  const catalog = useMemo(() => listFerragens3D(), []);
  const [selectedId, setSelectedId] = useState(catalog[0]?.id ?? '');

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const resolvedSelectedId = catalog.some((e) => e.id === selectedId)
    ? selectedId
    : (catalog[0]?.id ?? '');
  const selected = catalog.find((e) => e.id === resolvedSelectedId) ?? catalog[0];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Ferragens 3D"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(2, 6, 23, 0.72)',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 'min(1100px, 100%)',
          height: 'min(720px, calc(100vh - 32px))',
          display: 'grid',
          gridTemplateColumns: '240px 1fr',
          gridTemplateRows: 'auto 1fr',
          borderRadius: 10,
          border: '1px solid var(--border, #334155)',
          background: 'rgba(15, 23, 42, 0.98)',
          boxShadow: '0 16px 48px rgba(0,0,0,0.55)',
          overflow: 'hidden',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <header
          style={{
            gridColumn: '1 / -1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 14px',
            borderBottom: '1px solid var(--border, #334155)',
          }}
        >
          <div style={{ display: 'grid', gap: 2 }}>
            <strong style={{ fontSize: 14, color: '#f8fafc' }}>Ferragens 3D</strong>
            <span style={{ fontSize: 11, color: '#94a3b8' }}>
              Biblioteca isolada · visualização 1:1 · sem integração industrial
            </span>
          </div>
          <button type="button" onClick={onClose} style={industrialBtnStyle(false)} title="Fechar (Esc)">
            Fechar
          </button>
        </header>

        <aside
          style={{
            borderRight: '1px solid var(--border, #334155)',
            padding: 10,
            overflow: 'auto',
            display: 'grid',
            gap: 8,
            alignContent: 'start',
          }}
        >
          <h3 style={industrialSectionTitleStyle}>Modelos ({catalog.length})</h3>
          {catalog.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>Nenhum modelo encontrado em /ferragens_3d/.</div>
          ) : (
            catalog.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setSelectedId(entry.id)}
                style={{
                  ...industrialBtnStyle(entry.id === resolvedSelectedId),
                  width: '100%',
                  textAlign: 'left',
                  fontSize: 11,
                  padding: '8px 10px',
                  whiteSpace: 'normal',
                  lineHeight: 1.35,
                }}
                title={entry.label}
              >
                {entry.id}
              </button>
            ))
          )}
        </aside>

        <section style={{ display: 'grid', gridTemplateRows: '1fr auto', minHeight: 0 }}>
          <div style={{ position: 'relative', minHeight: 0, background: '#0b1220' }}>
            {selected ? (
              <Canvas
                key={selected.id}
                dpr={[1, 2]}
                gl={{ antialias: true, alpha: false }}
                style={{ width: '100%', height: '100%' }}
              >
                <color attach="background" args={['#0b1220']} />
                <Scene entry={selected} />
              </Canvas>
            ) : (
              <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#94a3b8', fontSize: 13 }}>
                Sem modelo seleccionado
              </div>
            )}
          </div>

          {selected ? (
            <footer
              style={{
                borderTop: '1px solid var(--border, #334155)',
                padding: '10px 14px',
                background: 'rgba(2, 6, 23, 0.55)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0', marginBottom: 8 }}>{selected.id}</div>
              <MedidasPanel entry={selected} />
            </footer>
          ) : null}
        </section>
      </div>
    </div>
  );
}
