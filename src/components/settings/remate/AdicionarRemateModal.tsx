import { useState } from "react";
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
} from "../../../core/remate/remateProductRules";

const PRODUCTS: RemateProductType[] = [
  "AVISTA",
  "COMPLETO",
  "L",
  "RODAPE",
  "RODAPE_L",
  "TAMPO_COZINHA",
];
const MOUNT_SLOTS: RemateMountSlot[] = ["FRENTE", "DIR", "ESQ", "CIMA", "FUNDO"];

type Props = {
  boxId: string;
  open: boolean;
  onClose: () => void;
  onConfirm: (_input: CreateRematePieceInput) => void;
};

export default function AdicionarRemateModal({ open, onClose, onConfirm }: Props) {
  const [productType, setProductType] = useState<RemateProductType>("AVISTA");
  const [mountSlot, setMountSlot] = useState<RemateMountSlot>("FRENTE");
  const [productOptions, setProductOptions] = useState<RemateProductOptions>({});

  const mountSlotSelectable = productType === "AVISTA" || productType === "COMPLETO";
  const activeMountSlots = MOUNT_SLOTS;

  if (!open) return null;

  const handleProductChange = (next: RemateProductType) => {
    setProductType(next);
    setMountSlot(defaultMountSlotForProduct(next));
    setProductOptions({});
  };

  return (
    <div
      className="modal-overlay"
      role="presentation"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1400,
        background: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(400px, 92vw)",
          padding: 16,
          borderRadius: 12,
          background: "var(--modal-bg, rgba(15,23,42,0.98))",
          border: "1px solid var(--modal-border, rgba(255,255,255,0.10))",
        }}
      >
        <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>Adicionar Remate</h3>

        <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 10 }}>
          Tipo de produto
          <select
            className="select"
            value={productType}
            onChange={(e) => handleProductChange(e.target.value as RemateProductType)}
            style={{ width: "100%" }}
          >
            {PRODUCTS.map((p) => (
              <option key={p} value={p}>
                {REMATE_PRODUCT_TYPE_LABELS[p]}
              </option>
            ))}
          </select>
        </label>

        {mountSlotSelectable ? (
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, marginBottom: 10 }}>
            Face de montagem
            <select
              className="select"
              value={mountSlot}
              onChange={(e) => setMountSlot(e.target.value as RemateMountSlot)}
              style={{ width: "100%" }}
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
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
          </div>
        ) : null}

        {productType === "COMPLETO" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 10 }}>
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
          </div>
        ) : null}

        <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end" }}>
          <button type="button" className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onConfirm({
                productType,
                mountSlot: mountSlotSelectable ? mountSlot : defaultMountSlotForProduct(productType),
                productOptions,
              });
              onClose();
            }}
          >
            Criar
          </button>
        </div>
      </div>
    </div>
  );
}
