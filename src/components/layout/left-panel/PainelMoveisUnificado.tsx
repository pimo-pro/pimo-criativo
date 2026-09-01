 
import {
  useMemo, useState, useCallback, useRef, useEffect, useLayoutEffect,
} from "react";
import { createPortal } from "react-dom";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { useProject } from "../../../context/useProject";
import {
  buildUnifiedMoveis,
  type UnifiedModelItem,
} from "../../../data/moveisUnificados";
import { buildBoxLegacy, type BoxOptions } from "../../../3d/objects/BoxBuilder";
import { buildCaixaFornoSeparadores, CAIXA_FORNO_ID } from "../../../core/moveis/generators/caixaFornoGenerator";
import type { BoxModule } from "../../../core/types";
import { REMATE_CATALOG_ITEMS, type RemateCatalogItem } from "../../../data/moveisUnificados/remateCatalog";

// ── Types ──────────────────────────────────────────────────────────────────────

type PortaTipo = BoxModule["portaTipo"];

interface BoxConfig {
  pes:        boolean;
  prateleiras: number;
  gavetas:    number;
  porta:      PortaTipo;
}

const DEFAULT_CONFIG: BoxConfig = {
  pes: false, prateleiras: 0, gavetas: 0, porta: "sem_porta",
};

const MAX_PRATELEIRAS = 5;
const MAX_GAVETAS     = 4;

function isSelectableMoveisItem(item: UnifiedModelItem): boolean {
  return item.tipo === "3d" || item.tipo === "moveis";
}

interface CatalogGroup {
  key: string;
  label: string;
  items: UnifiedModelItem[];
}

function buildGroups(items: UnifiedModelItem[]): CatalogGroup[] {
  const map = new Map<string, UnifiedModelItem[]>();
  for (const item of items) {
    const gc = item.grupoCatalogo;
    const key =
      item.subcategoriaCatalogo === "caixas-de-canto" ? "caixas-de-canto" :
      item.subcategoriaCatalogo === "moveis" ? "moveis" :
      gc === "pt" ? "cozinha-pt" :
      gc === "pi" ? "pi" :
      gc === "br" ? "cozinha-br" :
      item.categoriaId === "roupeiro" ? "roupeiro" :
      "outros";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(item);
  }
  const LABELS: Record<string, string> = {
    "caixas-de-canto": "Caixas de Canto",
    "moveis": "Móveis",
    "cozinha-br": "Cozinha — Branco",
    "cozinha-pt": "Cozinha — Carve",
    "pi":         "PI Models",
    "roupeiro":   "Roupeiro",
    "outros":     "Outros",
  };
  return [...map.entries()]
    .map(([key, items]) => ({ key, label: LABELS[key] ?? key, items }))
    .filter((g) => g.items.length > 0);
}

// ── Mini 3D Preview Canvas ────────────────────────────────────────────────────

function PreviewCanvas({ item, config }: { item: UnifiedModelItem; config: BoxConfig }) {
  const group = useMemo(() => {
    if (!item.dimensoes) return null;
    const opts: BoxOptions = {
      width:  item.dimensoes.largura_mm   / 1000,
      height: item.dimensoes.altura_mm    / 1000,
      depth:  item.dimensoes.profundidade_mm / 1000,
      shelves:     config.prateleiras,
      feetEnabled: item.tipo === "moveis" ? false : config.pes,
      baseCabinetId: item.tipo === "moveis" ? item.sourceId : undefined,
      separadores: item.tipo === "moveis" && item.sourceId === CAIXA_FORNO_ID
        ? buildCaixaFornoSeparadores({
            dimensoes: {
              largura: item.dimensoes.largura_mm,
              altura: item.dimensoes.altura_mm,
              profundidade: item.dimensoes.profundidade_mm,
            },
            espessura: 19,
            profundidadeExterna: item.dimensoes.profundidade_mm,
            portaTipo: "porta_simples",
            doorsLayer: [{ thickness: 19 } as import("../../../models/BoxLayers").DoorLayerItem],
            costaAtiva: true,
          })
        : undefined,
      castShadow: true, receiveShadow: true,
    };
    const g = buildBoxLegacy(opts);
    if (!g) return null;
    const bb = new THREE.Box3().setFromObject(g);
    g.position.y -= bb.min.y;
    g.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      if (mesh.children.some((c) => (c as THREE.LineSegments).isLineSegments)) return;
      const edges = new THREE.EdgesGeometry(mesh.geometry, 18);
      mesh.add(new THREE.LineSegments(edges,
        new THREE.LineBasicMaterial({ color: "#1e2535", transparent: true, opacity: 0.55 })));
      mesh.castShadow = mesh.receiveShadow = true;
    });
    return g;
  }, [item, config.prateleiras, config.pes]);

  return (
    <div style={{ width: "100%", aspectRatio: "4/3", background: "var(--navy, #0f172a)", borderRadius: "8px 8px 0 0", overflow: "hidden" }}>
      <Canvas shadows dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.0;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <color attach="background" args={["#0f172a"]} />
        <PerspectiveCamera makeDefault position={[1.4, 1.2, 2.2]} fov={42} near={0.05} far={80} />
        <OrbitControls enableDamping dampingFactor={0.06} maxPolarAngle={Math.PI / 2 - 0.01} target={[0, 0.45, 0]} />
        <ambientLight intensity={0.44} />
        <hemisphereLight args={[0xe8eeff, 0xd0d8e8, 0.4]} position={[0, 8, 0]} />
        <directionalLight castShadow position={[4, 6, 4]} intensity={0.5} color={0xfff8f0}
          shadow-mapSize-width={512} shadow-mapSize-height={512}
          shadow-camera-near={0.1} shadow-camera-far={12}
          shadow-camera-left={-4} shadow-camera-right={4}
          shadow-camera-top={4} shadow-camera-bottom={-4}
          shadow-bias={-0.0003} shadow-radius={3} />
        <directionalLight position={[-2, 3, 2]} intensity={0.18} color={0xe8ecf4} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <meshStandardMaterial color="#0f172a" roughness={0.92} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]} receiveShadow>
          <planeGeometry args={[20, 20]} />
          <shadowMaterial opacity={0.28} />
        </mesh>
        {group && <primitive object={group} />}
      </Canvas>
    </div>
  );
}

// ── Config chips ──────────────────────────────────────────────────────────────

function Chip({
  label, active, onClick,
}: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: 4,
        padding: "4px 11px",
        borderRadius: 999,
        fontSize: 11, fontWeight: active ? 600 : 400,
        border: `1px solid ${active ? "var(--primary, #38bdf8)" : "var(--border, rgba(255,255,255,0.12))"}`,
        background: active ? "var(--bg-selected, rgba(56,189,248,0.08))" : "transparent",
        color: active ? "var(--primary, #38bdf8)" : "var(--text-muted, #94a3b8)",
        cursor: "pointer",
        transition: "all 0.12s",
        whiteSpace: "nowrap",
      }}
    >
      {active && (
        <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--primary, #38bdf8)", flexShrink: 0 }} />
      )}
      {label}
    </button>
  );
}

function Counter({
  label, value, min, max, onChange,
}: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  const btnStyle: React.CSSProperties = {
    width: 24, height: 24,
    borderRadius: 6,
    border: "1px solid var(--border, rgba(255,255,255,0.12))",
    background: "var(--button-ghost-bg, rgba(255,255,255,0.04))",
    color: "var(--text-main, #e2e8f0)",
    fontSize: 14, lineHeight: 1, cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 0.1s",
    flexShrink: 0,
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
      <span style={{ flex: 1, fontSize: 11, color: "var(--text-muted, #94a3b8)" }}>{label}</span>
      <button type="button" style={btnStyle} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
      <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-main, #e2e8f0)", minWidth: 16, textAlign: "center", fontVariantNumeric: "tabular-nums" }}>{value}</span>
      <button type="button" style={btnStyle} disabled={value >= max} onClick={() => onChange(value + 1)}>+</button>
    </div>
  );
}

// ── Flyout card (portal, fixed position) ─────────────────────────────────────

interface FlyoutProps {
  item: UnifiedModelItem;
  anchorRect: DOMRect;
  panelWidth: number;
  config: BoxConfig;
  onConfigChange: (c: BoxConfig) => void;
  onAdd: () => void;
  onClose: () => void;
}

function Flyout({ item, anchorRect, panelWidth, config, onConfigChange, onAdd, onClose }: FlyoutProps) {
  const ref = useRef<HTMLDivElement>(null);
  const FLYOUT_W = 316;

  // Position to the right of the left panel
  const left = panelWidth + 8;
  const topRaw = anchorRect.top - 12;
  const maxTop = window.innerHeight - 500;
  const top = Math.max(8, Math.min(topRaw, maxTop));

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        // Don't close if clicking inside the left panel list
        const target = e.target as Element;
        if (target.closest(".moveis-panel")) return;
        onClose();
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handler);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const dims = item.dimensoes;
  const PORTA_OPTS: { value: PortaTipo; label: string }[] = [
    { value: "sem_porta",    label: "Sem porta"  },
    { value: "porta_simples", label: "Simples"  },
    { value: "porta_dupla",  label: "Dupla"     },
  ];

  return createPortal(
    <div
      ref={ref}
      style={{
        position: "fixed",
        top,
        left,
        width: FLYOUT_W,
        zIndex: 1200,
        background: "var(--modal-bg, rgba(15,23,42,0.98))",
        border: "1px solid var(--modal-border, rgba(255,255,255,0.10))",
        borderRadius: 12,
        boxShadow: "var(--modal-shadow, 0 24px 60px rgba(0,0,0,0.4))",
        backdropFilter: "blur(12px)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        maxHeight: "calc(100vh - 24px)",
        animation: "moveis-flyout-in 0.16s ease",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "flex-start", justifyContent: "space-between",
        padding: "14px 14px 8px", gap: 8, flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: "var(--text-main, #e2e8f0)", lineHeight: 1.3 }}>
            {item.nome}
          </p>
          {dims && (
            <p style={{ margin: "4px 0 0", fontSize: 11, color: "var(--text-muted, #94a3b8)", fontVariantNumeric: "tabular-nums" }}>
              {(dims.largura_mm / 10).toFixed(0)} × {(dims.altura_mm / 10).toFixed(0)} × {(dims.profundidade_mm / 10).toFixed(0)} cm
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} style={{
          width: 24, height: 24, borderRadius: 6,
          border: "1px solid var(--border, rgba(255,255,255,0.12))",
          background: "transparent", color: "var(--text-muted, #94a3b8)",
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 16, flexShrink: 0, transition: "background 0.1s",
        }}>×</button>
      </div>

      {/* 3D Preview */}
      <div style={{ flexShrink: 0 }}>
        <PreviewCanvas item={item} config={config} />
      </div>

      {/* Scrollable options */}
      <div style={{ overflowY: "auto", flex: 1 }}>
        {/* Options block — all chips in one unified area, no separators */}
        <div style={{ padding: "12px 12px 8px", display: "flex", flexDirection: "column", gap: 10 }}>

          {/* Chips row: Pés + Porta options together */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            <Chip label="Pés" active={config.pes} onClick={() => onConfigChange({ ...config, pes: !config.pes })} />
            {PORTA_OPTS.map((o) => (
              <Chip key={o.value} label={o.label} active={config.porta === o.value} onClick={() => onConfigChange({ ...config, porta: o.value })} />
            ))}
          </div>

          {/* Counters */}
          <Counter label="Prateleiras" value={config.prateleiras} min={0} max={MAX_PRATELEIRAS}
            onChange={(v) => onConfigChange({ ...config, prateleiras: v })} />
          <Counter label="Gavetas" value={config.gavetas} min={0} max={MAX_GAVETAS}
            onChange={(v) => onConfigChange({ ...config, gavetas: v })} />
        </div>

        {/* Add button */}
        <div style={{ padding: "0 12px 12px" }}>
          <button
            type="button"
            onClick={onAdd}
            style={{
              width: "100%", padding: "10px 14px",
              border: "none", borderRadius: 8,
              background: "var(--blue-light, #3b82f6)",
              color: "#fff", fontSize: 13, fontWeight: 600,
              cursor: "pointer", transition: "background 0.12s",
              fontFamily: "inherit",
            }}
          >
            + Adicionar ao projeto
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

const REMATE_GROUP_KEY = "remates";

export default function PainelMoveisUnificado() {
  const { actions } = useProject();
  const panelRef   = useRef<HTMLDivElement>(null);
  const [search, setSearch]         = useState("");
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ "cozinha-br": true, "caixas-de-canto": true, [REMATE_GROUP_KEY]: true });
  const [activeItem, setActiveItem] = useState<UnifiedModelItem | null>(null);
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null);
  const [config, setConfig]         = useState<BoxConfig>(DEFAULT_CONFIG);
  const [panelWidth, setPanelWidth] = useState(300);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (el) setPanelWidth(el.getBoundingClientRect().right);
  }, [activeItem]);

  const allItems = useMemo(() => buildUnifiedMoveis(), []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return term
      ? allItems.filter((i) => i.nome.toLowerCase().includes(term) || (i.descricao ?? "").toLowerCase().includes(term))
      : allItems;
  }, [allItems, search]);

  const groups = useMemo(() => buildGroups(filtered), [filtered]);

  const toggleGroup = useCallback((key: string) => {
    setOpenGroups((p) => ({ ...p, [key]: !p[key] }));
  }, []);

  const handleSelectItem = useCallback((item: UnifiedModelItem, buttonEl: HTMLButtonElement) => {
    if (activeItem?.id === item.id) {
      setActiveItem(null);
      return;
    }
    setActiveItem(item);
    setAnchorRect(buttonEl.getBoundingClientRect());
    setConfig(DEFAULT_CONFIG);
  }, [activeItem]);

  const handleAddRemateCatalog = useCallback((item: RemateCatalogItem) => {
    actions.createStandaloneRematePiece({
      productType: item.productType,
      mountSlot: item.defaultMountSlot,
    });
  }, [actions]);

  const handleAdd = useCallback(() => {
    if (!activeItem) return;
    if (activeItem.tipo === "moveis") {
      actions.addWorkspaceBoxFromMoveis(activeItem.sourceId);
      setActiveItem(null);
      return;
    }
    if (activeItem.tipo !== "3d") return;
    actions.addWorkspaceBoxFromCatalog(activeItem.sourceId);
    setTimeout(() => {
      if (config.prateleiras > 0) actions.setPrateleiras(config.prateleiras);
      if (config.gavetas > 0)     actions.setGavetas(config.gavetas);
      if (config.porta !== "sem_porta") actions.setPortaTipo(config.porta);
    }, 80);
    setActiveItem(null);
  }, [activeItem, config, actions]);

  return (
    <>
      <div ref={panelRef} className="moveis-panel left-panel-content">

        {/* Search */}
        <div style={{ padding: "8px 10px 6px", borderBottom: "1px solid var(--border, rgba(255,255,255,0.12))", flexShrink: 0 }}>
          <input
            type="search"
            className="input input-sm"
            placeholder="Pesquisar módulos…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", boxSizing: "border-box" }}
          />
        </div>

        {/* Groups list */}
        <div className="left-panel-scroll" style={{ flex: 1, padding: "4px 0 16px" }}>
          <div key={REMATE_GROUP_KEY}>
            <button
              type="button"
              onClick={() => toggleGroup(REMATE_GROUP_KEY)}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                width: "100%", padding: "7px 12px",
                border: "none", background: "transparent",
                color: "var(--text-muted, #94a3b8)",
                fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
                cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              }}
            >
              <span style={{
                display: "inline-block",
                transition: "transform 0.15s",
                transform: (openGroups[REMATE_GROUP_KEY] ?? false) ? "rotate(90deg)" : "none",
                fontSize: 12,
              }}>›</span>
              <span style={{ flex: 1 }}>REMATES</span>
              <span style={{
                fontSize: 9, background: "var(--card-bg, rgba(255,255,255,0.03))",
                border: "1px solid var(--card-border, rgba(255,255,255,0.06))",
                borderRadius: 8, padding: "1px 5px",
              }}>{REMATE_CATALOG_ITEMS.length}</span>
            </button>
            {(openGroups[REMATE_GROUP_KEY] ?? false) && (
              <div style={{ padding: "0 6px 4px", display: "flex", flexDirection: "column", gap: 1 }}>
                {REMATE_CATALOG_ITEMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleAddRemateCatalog(item)}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "7px 10px",
                      borderRadius: 7, border: "1px solid transparent",
                      background: "transparent", cursor: "pointer",
                      textAlign: "left", fontFamily: "inherit",
                    }}
                  >
                    <span style={{ flex: 1, fontSize: 12, color: "var(--text-main, #e2e8f0)" }}>{item.nome}</span>
                    <span style={{ fontSize: 13, color: "var(--text-muted, #94a3b8)" }}>+</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {groups.length === 0 && (
            <p style={{ padding: "12px 14px", fontSize: 12, color: "var(--text-muted, #94a3b8)", margin: 0 }}>
              Sem resultados para "{search}"
            </p>
          )}

          {groups.map((group) => {
            const isOpen = openGroups[group.key] ?? false;
            return (
              <div key={group.key}>

                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    width: "100%", padding: "7px 12px",
                    border: "none", background: "transparent",
                    color: "var(--text-muted, #94a3b8)",
                    fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em",
                    cursor: "pointer", textAlign: "left", fontFamily: "inherit",
                    transition: "color 0.1s",
                  }}
                >
                  <span style={{
                    display: "inline-block",
                    transition: "transform 0.15s",
                    transform: isOpen ? "rotate(90deg)" : "none",
                    fontSize: 12,
                  }}>›</span>
                  <span style={{ flex: 1 }}>{group.label}</span>
                  <span style={{
                    fontSize: 9, background: "var(--card-bg, rgba(255,255,255,0.03))",
                    border: "1px solid var(--card-border, rgba(255,255,255,0.06))",
                    borderRadius: 8, padding: "1px 5px",
                    color: "var(--text-muted, #94a3b8)",
                  }}>{group.items.length}</span>
                </button>

                {/* Items */}
                {isOpen && (
                  <div style={{ padding: "0 6px 4px", display: "flex", flexDirection: "column", gap: 1 }}>
                    {group.items.map((item) => {
                      const isActive = activeItem?.id === item.id;
                      const dims = item.dimensoes;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          disabled={!isSelectableMoveisItem(item)}
                          onClick={(e) => handleSelectItem(item, e.currentTarget)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8,
                            width: "100%", padding: "7px 10px",
                            borderRadius: 7,
                            border: `1px solid ${isActive ? "var(--border-selected, rgba(56,189,248,0.35))" : "transparent"}`,
                            background: isActive ? "var(--bg-selected, rgba(56,189,248,0.08))" : "transparent",
                            cursor: isSelectableMoveisItem(item) ? "pointer" : "not-allowed",
                            textAlign: "left", fontFamily: "inherit",
                            opacity: isSelectableMoveisItem(item) ? 1 : 0.4,
                            transition: "background 0.1s, border-color 0.1s",
                          }}
                          onMouseEnter={(e) => {
                            if (!isActive && isSelectableMoveisItem(item))
                              e.currentTarget.style.background = "var(--bg-item-hover, rgba(255,255,255,0.07))";
                          }}
                          onMouseLeave={(e) => {
                            if (!isActive)
                              e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
                            <span style={{
                              fontSize: 12, fontWeight: 500, color: "var(--text-main, #e2e8f0)",
                              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                            }}>{item.nome}</span>
                            {dims && (
                              <span style={{
                                fontSize: 10, color: "var(--text-muted, #94a3b8)",
                                fontVariantNumeric: "tabular-nums",
                              }}>
                                {dims.largura_mm} × {dims.altura_mm} mm
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: 13, color: "var(--text-muted, #94a3b8)", flexShrink: 0 }}>›</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Flyout portal */}
      {activeItem && anchorRect && (
        <Flyout
          item={activeItem}
          anchorRect={anchorRect}
          panelWidth={panelWidth}
          config={config}
          onConfigChange={setConfig}
          onAdd={handleAdd}
          onClose={() => setActiveItem(null)}
        />
      )}

      <style>{`
        @keyframes moveis-flyout-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
