/**
 * Exibe avisos de colisão e modelos fora dos limites da caixa.
 */

import type { LayoutWarnings } from "../../core/layout/layoutWarnings";

type Props = {
  warnings: LayoutWarnings;
  boxId: string | null;
};

export default function LayoutWarningsAlert({ warnings, boxId }: Props) {
  const forBox = boxId
    ? {
        collisions: warnings.collisions.filter((c) => c.boxId === boxId),
        outOfBounds: warnings.outOfBounds.filter((o) => o.boxId === boxId),
      }
    : { collisions: [] as typeof warnings.collisions, outOfBounds: [] as typeof warnings.outOfBounds };
  const hasAny = forBox.collisions.length > 0 || forBox.outOfBounds.length > 0;
  if (!hasAny) return null;

  return (
    <div
      className="panel"
      style={{
        marginTop: 8,
        padding: 10,
        background: "var(--surface)",
        borderRadius: "var(--radius)",
        border: "1px solid rgba(239,68,68,0.35)",
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-main)", marginBottom: 8 }}>
        Layout
      </div>
      <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {forBox.collisions.map((c) => (
          <li
            key={`${c.modelIdA}-${c.modelIdB}`}
            style={{
              padding: "6px 8px",
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--text-main)",
            }}
          >
            Colisão entre modelos.
          </li>
        ))}
        {forBox.outOfBounds.map((o) => (
          <li
            key={o.modelInstanceId}
            style={{
              padding: "6px 8px",
              background: "rgba(245,158,11,0.12)",
              border: "1px solid rgba(245,158,11,0.4)",
              borderRadius: 6,
              fontSize: 12,
              color: "var(--text-main)",
            }}
          >
            Modelo fora dos limites da caixa.
          </li>
        ))}
      </ul>
    </div>
  );
}
