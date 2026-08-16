import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useProject } from "../../../context/useProject";
import { useUiStore } from "../../../stores/uiStore";
import type {
  CreateRematePieceInput,
  RemateMountSlot,
  RemateProductOptions,
  RemateProductType,
} from "../../../core/remate/rematePieceTypes";
import {
  REMATE_MOUNT_SLOT_LABELS,
  REMATE_PRODUCT_TYPE_LABELS,
} from "../../../core/remate/rematePieceTypes";
import {
  DEFAULT_AVISTA_WIDTH_MM,
  defaultMountSlotForProduct,
  inferProductTypeFromLegacy,
} from "../../../core/remate/remateProductRules";
import BoxRodapeSection from "../rodape/BoxRodapeSection";
import { resolveRematePieceNomeForRemate } from "../../../core/remate/labels";
import TampoPresetSelector from "./TampoPresetSelector";

const PRODUCTS: RemateProductType[] = [
  "AVISTA",
  "COMPLETO",
  "L",
  "RODAPE",
  "RODAPE_L",
  "TAMPO_COZINHA",
];
const MOUNT_SLOTS: RemateMountSlot[] = ["FRENTE", "DIR", "ESQ", "CIMA", "FUNDO"];

const drawerShellStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1350,
  pointerEvents: "none",
};

const backdropStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(0,0,0,0.35)",
  pointerEvents: "auto",
};

const panelStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  right: 0,
  width: "min(360px, 92vw)",
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  borderLeft: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(7, 11, 24, 0.98)",
  boxShadow: "-10px 0 30px rgba(0,0,0,0.35)",
  pointerEvents: "auto",
  zIndex: 1351,
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  borderBottom: "1px solid rgba(255,255,255,0.12)",
  fontSize: 14,
  fontWeight: 600,
  color: "var(--text-main)",
};

const bodyStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  padding: "14px",
  display: "flex",
  flexDirection: "column",
  gap: 14,
};

type Props = {
  boxId: string;
  open?: boolean;
  onClose?: () => void;
  defaultMaterialId?: string;
  /** Conteúdo inline (sem portal/drawer lateral). */
  embedded?: boolean;
};

export default function BoxRemateDrawer({
  boxId,
  open = false,
  onClose,
  defaultMaterialId,
  embedded = false,
}: Props) {
  const { project, actions } = useProject();
  const setSelectedObject = useUiStore((s) => s.setSelectedObject);
  const [productType, setProductType] = useState<RemateProductType>("AVISTA");
  const [mountSlot, setMountSlot] = useState<RemateMountSlot>("FRENTE");
  const [productOptions, setProductOptions] = useState<RemateProductOptions>({});

  const remates = useMemo(
    () => (project.remates ?? []).filter((r) => r.parentBoxId === boxId),
    [project.remates, boxId]
  );

  const remateDisplayNames = useMemo(() => {
    const boxNameById: Record<string, string> = {};
    for (const box of project.workspaceBoxes) {
      if (box?.id) boxNameById[box.id] = typeof box.nome === "string" ? box.nome : box.id;
    }
    return new Map(remates.map((r) => [r.id, resolveRematePieceNomeForRemate(r, boxNameById)]));
  }, [remates, project.workspaceBoxes]);

  const mountSlotSelectable = productType === "AVISTA" || productType === "COMPLETO";
  const activeMountSlots = MOUNT_SLOTS;

  const materialPreset =
    defaultMaterialId || project.materialId || project.material.tipo || "default";

  const handleCreate = () => {
    const input: CreateRematePieceInput = {
      productType,
      mountSlot: mountSlotSelectable ? mountSlot : defaultMountSlotForProduct(productType),
      productOptions,
      parentBoxId: boxId,
      followBox: true,
      materialPresetId: materialPreset,
    };
    actions.createRematePiece(input);
  };

  const handleProductChange = (next: RemateProductType) => {
    setProductType(next);
    setMountSlot(defaultMountSlotForProduct(next));
    setProductOptions({});
  };

  const bodyContent = (
    <>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
        Remate do módulo — escolha o tipo de produto e a face de montagem.
      </p>

      <div
        style={{
          padding: 12,
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main)" }}>Adicionar remate</div>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
          Tipo de produto
          <select
            className="select input-sm"
            value={productType}
            onChange={(e) => handleProductChange(e.target.value as RemateProductType)}
          >
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {REMATE_PRODUCT_TYPE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        {mountSlotSelectable ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
            Face de montagem
            <select
              className="select input-sm"
              value={mountSlot}
              onChange={(e) => setMountSlot(e.target.value as RemateMountSlot)}
            >
              {activeMountSlots.map((slot) => (
                <option key={slot} value={slot}>
                  {REMATE_MOUNT_SLOT_LABELS[slot]}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {productType === "AVISTA" ? (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Largura avista (mm)
              <input
                className="input input-sm"
                type="number"
                min={10}
                value={productOptions.avistaWidthMm ?? DEFAULT_AVISTA_WIDTH_MM}
                onChange={(e) =>
                  setProductOptions((o) => ({
                    ...o,
                    avistaWidthMm: Math.max(10, Number(e.target.value) || DEFAULT_AVISTA_WIDTH_MM),
                  }))
                }
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={productOptions.avistaFlushToDoor ?? false}
                onChange={(e) =>
                  setProductOptions((o) => ({ ...o, avistaFlushToDoor: e.target.checked }))
                }
              />
              Encostar à porta (~20 mm)
            </label>
          </>
        ) : null}

        {productType === "COMPLETO" ? (
          <>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12 }}>
              Largura extra (mm)
              <input
                className="input input-sm"
                type="number"
                min={0}
                value={productOptions.coverageExtraMm ?? 0}
                onChange={(e) =>
                  setProductOptions((o) => ({
                    ...o,
                    coverageExtraMm: Math.max(0, Number(e.target.value) || 0),
                  }))
                }
              />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={productOptions.includeTopBottomRemates ?? false}
                onChange={(e) =>
                  setProductOptions((o) => ({ ...o, includeTopBottomRemates: e.target.checked }))
                }
              />
              Remate cima + remate fundo
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={productOptions.asPuxador ?? false}
                onChange={(e) =>
                  setProductOptions((o) => ({ ...o, asPuxador: e.target.checked }))
                }
              />
              Modo puxador
            </label>
          </>
        ) : null}

        {productType === "TAMPO_COZINHA" ? (
          <TampoPresetSelector
            parentBoxId={boxId}
            onConfirm={(input) => {
              actions.createRematePiece({
                ...input,
                parentBoxId: boxId,
                followBox: true,
                materialPresetId: materialPreset,
              });
            }}
          />
        ) : null}

        <button type="button" className="button button-primary" onClick={handleCreate}>
          Criar remate
        </button>
      </div>

      <BoxRodapeSection boxId={boxId} embedded />

      {remates.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main)" }}>
            Remates deste módulo ({remates.length})
          </div>
          {remates.map((remate) => {
            const pt = remate.productType ?? inferProductTypeFromLegacy(remate);
            const slotLabel = remate.mountSlot
              ? REMATE_MOUNT_SLOT_LABELS[remate.mountSlot]
              : "";
            return (
              <button
                key={remate.id}
                type="button"
                className="btn"
                style={{
                  textAlign: "left",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  padding: "10px 12px",
                }}
                onClick={() => {
                  setSelectedObject({ type: "remate", id: remate.id });
                  window.viewerCore?.selectRemate?.(remate.id);
                  if (!embedded) onClose?.();
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 12 }}>
                  {remateDisplayNames.get(remate.id) ?? remate.name}
                </span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {REMATE_PRODUCT_TYPE_LABELS[pt]}
                  {slotLabel ? ` · ${slotLabel}` : ""}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
          Nenhum remate neste módulo. Use o formulário acima para criar.
        </p>
      )}
    </>
  );

  if (embedded) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{bodyContent}</div>
    );
  }

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="box-remate-drawer" style={drawerShellStyle} role="presentation">
      <div style={backdropStyle} onClick={onClose} aria-hidden />
      <aside
        className="box-remate-drawer-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="box-remate-drawer-title"
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        <header style={headerStyle}>
          <span id="box-remate-drawer-title">Remate</span>
          <button type="button" className="btn btn-ghost" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </header>

        <div style={bodyStyle}>{bodyContent}</div>
      </aside>
    </div>,
    document.body
  );
}
