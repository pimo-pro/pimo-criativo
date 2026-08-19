import { V4_ROOM_SHAPES } from "../../v4/state/V4RoomShapes";

interface V4RoomShapeGridProps {
  selectedShapeId: string;
  onSelectShape: (shapeId: string) => void;
}

export function V4RoomShapeGrid({ selectedShapeId, onSelectShape }: V4RoomShapeGridProps) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, 1fr)",
      gap: 6,
    }}>
      {V4_ROOM_SHAPES.map((shape) => {
        const selected = shape.id === selectedShapeId;
        return (
          <button
            key={shape.id}
            type="button"
            title={shape.name}
            onClick={() => onSelectShape(shape.id)}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 4,
              background: selected ? "var(--v4-accent-subtle, rgba(59,130,246,0.15))" : "var(--v4-surface-2, #161b22)",
              border: `1.5px solid ${selected ? "var(--v4-accent, #3b82f6)" : "var(--v4-border, #30363d)"}`,
              borderRadius: 6,
              cursor: "pointer",
              transition: "border-color 0.12s, background 0.12s",
            }}
          >
            <svg
              width={40}
              height={40}
              viewBox="0 0 40 40"
              fill="none"
              stroke={selected ? "var(--v4-accent, #3b82f6)" : "var(--v4-text-subtle, #8b949e)"}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={shape.svgPath} />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
