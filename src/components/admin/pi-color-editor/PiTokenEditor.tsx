import { useState, type CSSProperties } from "react";
import {
  setPiTokenOverride,
  type ThemeMode,
} from "../../../theme/palettes/piTokenOverridesApi";
import PiTokenPreview from "./PiTokenPreview";
import PiTokenResetButton from "./PiTokenResetButton";
import PiTokenSourceBadge from "./PiTokenSourceBadge";
import {
  baselineTokenValue,
  describeTokenSource,
  isCssColorPickerValue,
} from "./piTokenEditorShared";

const fieldStyle: CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  fontSize: 12,
  borderRadius: "var(--radius)",
  border: "1px solid var(--input-border, var(--card-border))",
  background: "var(--input-bg, var(--card-bg))",
  color: "var(--text-main)",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
};

export default function PiTokenEditor({
  mode,
  token,
}: {
  mode: ThemeMode;
  token: string | null;
}) {
  const source = token ? describeTokenSource(mode, token) : null;
  const baseline = token ? baselineTokenValue(mode, token) : undefined;
  const effective = source?.value;
  const hasOverride = source?.layer === "userOverrides";

  const [draft, setDraft] = useState(effective ?? "");
  const [draftSourceKey, setDraftSourceKey] = useState(`${mode}:${token}:${effective ?? ""}`);
  const nextDraftSourceKey = `${mode}:${token}:${effective ?? ""}`;
  if (nextDraftSourceKey !== draftSourceKey) {
    setDraftSourceKey(nextDraftSourceKey);
    setDraft(effective ?? "");
  }

  if (!token) {
    return (
      <div style={{ fontSize: 12, color: "var(--text-muted)", padding: 12 }}>
        Selecione um token na lista para editar o override do modo atual.
      </div>
    );
  }

  const canPick = isCssColorPickerValue(draft) || isCssColorPickerValue(effective ?? "");
  const pickerValue = isCssColorPickerValue(draft)
    ? draft
    : isCssColorPickerValue(effective ?? "")
      ? (effective as string)
      : "#000000";

  const apply = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setPiTokenOverride(mode, token, trimmed);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <PiTokenPreview token={token} value={effective} />

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Fonte:</span>
        <PiTokenSourceBadge layer={source?.layer ?? "none"} />
        {hasOverride ? <PiTokenResetButton mode={mode} token={token} /> : null}
      </div>

      <div>
        <label style={{ display: "block", fontSize: 11, color: "var(--text-muted)", marginBottom: 4 }}>
          Valor ({mode})
        </label>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {canPick ? (
            <input
              type="color"
              value={pickerValue.length === 4 ? expandShortHex(pickerValue) : pickerValue.slice(0, 7)}
              onChange={(e) => {
                const next = e.target.value;
                setDraft(next);
                apply(next);
              }}
              aria-label={`Cor de --${token}`}
              style={{ width: 40, height: 34, padding: 0, border: "1px solid var(--card-border)", borderRadius: 6, background: "transparent", cursor: "pointer" }}
            />
          ) : null}
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft.trim() && draft.trim() !== (effective ?? "")) apply(draft);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur();
              }
            }}
            placeholder={baseline ?? "ex. #1C4A7A ou rgba(...)"}
            style={fieldStyle}
            spellCheck={false}
          />
        </div>
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: "6px 0 0" }}>
          Baseline:{" "}
          <code style={{ color: "var(--text-main)" }}>{baseline ?? "(ausente na paleta Pi)"}</code>
        </p>
      </div>
    </div>
  );
}

function expandShortHex(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 3) return hex;
  return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`;
}
