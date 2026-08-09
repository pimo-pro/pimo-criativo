import { useMemo } from "react";
import type { WorkspaceBox } from "../../../core/types";
import type { ProjectActions } from "../../../context/projectTypes";
import Panel from "../../ui/Panel";
import { NumericInput } from "../../ui/NumericInput";
import {
  getDivSepInternalDims,
  resolveDivisorDimensions,
  resolveSeparadorDimensions,
} from "../../../core/divSep/dimensions";
import { resolveDivShelfGridYs } from "../../../core/divSep/shelfDrilling";
import type {
  DivisorPosicaoRelativaAoSep,
  DivisorPrateleiraLado,
  DivisorReferenceEdge,
  SeparadorAncoraHorizontal,
  SeparadorReferenceEdge,
} from "../../../core/divSep/types";
import {
  resolveAncoraHorizontal,
  resolvePosicaoRelativaAoSep,
} from "../../../core/divSep/types";

type DivSepPanelProps = {
  box: WorkspaceBox;
  actions: Pick<
    ProjectActions,
    "addSeparador" | "addDivisor" | "removeSeparador" | "removeDivisor" | "updateSeparador" | "updateDivisor"
  >;
  /** Sem Panel wrapper (ex.: dentro de UnifiedPopover). */
  embedded?: boolean;
  /** Filtra apresentação: divisórios, separadores ou ambos (padrão). */
  section?: "div" | "sep" | "both";
};

export default function DivSepPanel({
  box,
  actions,
  embedded = false,
  section = "both",
}: DivSepPanelProps) {
  const internal = useMemo(() => getDivSepInternalDims(box), [box]);
  const separadores = box.separadores ?? [];
  const divisores = box.divisores ?? [];
  const hasShelves = Math.max(0, Math.floor(box.prateleiras ?? 0)) > 0;
  const showSeparadores = section === "sep" || section === "both";
  const showDivisores = section === "div" || section === "both";

  const content = (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {showSeparadores ? (
          <button type="button" className="button button-ghost button-sm" onClick={() => actions.addSeparador()}>
            Adicionar SEPARADOR
          </button>
        ) : null}
        {showDivisores ? (
          <button type="button" className="button button-ghost button-sm" onClick={() => actions.addDivisor()}>
            Adicionar DIVISÓRIO
          </button>
        ) : null}
      </div>

      {showSeparadores && section !== "both" && separadores.length === 0 ? (
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
          Nenhum separador. As peças herdam material e espessura da caixa.
        </p>
      ) : null}

      {showDivisores && section !== "both" && divisores.length === 0 ? (
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
          Nenhum divisório. As peças herdam material e espessura da caixa.
        </p>
      ) : null}

      {section === "both" && separadores.length === 0 && divisores.length === 0 ? (
        <p style={{ fontSize: 11, color: "var(--text-muted)", margin: 0 }}>
          Nenhum separador ou divisório. As peças herdam material e espessura da caixa.
        </p>
      ) : null}

      {showSeparadores
        ? separadores.map((sep, index) => {
            const dims = resolveSeparadorDimensions(box, sep);
            const maxPos = internal.alturaInterna - dims.alturaMm / 2;
            const ancora = resolveAncoraHorizontal(sep);
            return (
              <div
                key={sep.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>SEP {index + 1}</div>
                <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                  Referência
                  <select
                    className="input input-sm"
                    value={ancora}
                    onChange={(e) =>
                      actions.updateSeparador(sep.id, {
                        ancoraHorizontal: e.target.value as SeparadorAncoraHorizontal,
                      })
                    }
                  >
                    <option value="completo">Completo</option>
                    <option value="esquerda">Esquerda</option>
                    <option value="direita">Direita</option>
                  </select>
                </label>
                <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                  Altura a partir de
                  <select
                    className="input input-sm"
                    value={sep.referenceEdge}
                    onChange={(e) =>
                      actions.updateSeparador(sep.id, {
                        referenceEdge: e.target.value as SeparadorReferenceEdge,
                      })
                    }
                  >
                    <option value="bottom">FUNDO</option>
                    <option value="top">CIMA</option>
                  </select>
                </label>
                <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                  Posição (mm)
                  <input
                    type="range"
                    min={dims.alturaMm / 2}
                    max={maxPos}
                    step={1}
                    value={sep.positionMm}
                    onChange={(e) => actions.updateSeparador(sep.id, { positionMm: Number(e.target.value) })}
                    style={{ width: "100%" }}
                  />
                  <NumericInput
                    value={sep.positionMm}
                    onChange={(v) => actions.updateSeparador(sep.id, { positionMm: v })}
                    min={dims.alturaMm / 2}
                    max={maxPos}
                  />
                </label>
                <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                  Profundidade (mm)
                  <NumericInput
                    value={sep.profundidadeMm ?? dims.profundidadeMm}
                    onChange={(v) => actions.updateSeparador(sep.id, { profundidadeMm: v })}
                    min={50}
                    max={internal.profundidadeInterna}
                  />
                </label>
                <label style={{ display: "block", fontSize: 11, marginBottom: 8 }}>
                  Largura (mm)
                  <NumericInput
                    value={sep.larguraMm ?? dims.larguraMm}
                    onChange={(v) => actions.updateSeparador(sep.id, { larguraMm: v })}
                    min={50}
                    max={internal.larguraInterna}
                  />
                  {ancora !== "completo" && sep.larguraMm == null ? (
                    <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                      Largura calculada automaticamente pela âncora e pelos DIV.
                    </span>
                  ) : null}
                </label>
                <button
                  type="button"
                  className="button button-ghost button-sm"
                  onClick={() => actions.removeSeparador(sep.id)}
                >
                  Remover
                </button>
              </div>
            );
          })
        : null}

      {showDivisores
        ? divisores.map((div, index) => {
            const dims = resolveDivisorDimensions(box, div);
            const maxPos = internal.larguraInterna - dims.larguraMm / 2;
            const linked = Boolean(div.linkedSeparadorId);
            const modo = linked ? "ligado" : "completo";
            const posicao = resolvePosicaoRelativaAoSep(div);
            const defaultSepId = separadores[separadores.length - 1]?.id;

            return (
              <div
                key={div.id}
                style={{
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>DIV {index + 1}</div>
                <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                  Modo
                  <select
                    className="input input-sm"
                    value={modo}
                    onChange={(e) => {
                      const next = e.target.value;
                      if (next === "completo") {
                        actions.updateDivisor(div.id, {
                          linkedSeparadorId: undefined,
                          posicaoRelativaAoSep: undefined,
                        });
                        return;
                      }
                      const sepId = div.linkedSeparadorId ?? defaultSepId;
                      if (!sepId) return;
                      actions.updateDivisor(div.id, {
                        linkedSeparadorId: sepId,
                        posicaoRelativaAoSep: div.posicaoRelativaAoSep ?? "baixo",
                        alturaMm: undefined,
                      });
                    }}
                    disabled={separadores.length === 0 && !linked}
                  >
                    <option value="completo">COMPLETO</option>
                    <option value="ligado" disabled={separadores.length === 0}>
                      LIGADO AO SEP
                    </option>
                  </select>
                </label>
                {linked && separadores.length > 0 ? (
                  <>
                    {separadores.length > 1 ? (
                      <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                        SEP ligado
                        <select
                          className="input input-sm"
                          value={div.linkedSeparadorId ?? ""}
                          onChange={(e) => {
                            const linkedSeparadorId = e.target.value || undefined;
                            if (!linkedSeparadorId) return;
                            actions.updateDivisor(div.id, {
                              linkedSeparadorId,
                              alturaMm: undefined,
                            });
                          }}
                        >
                          {separadores.map((sep, sepIndex) => (
                            <option key={sep.id} value={sep.id}>
                              SEP {sepIndex + 1}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                    <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                      Posição relativamente ao SEP
                      <select
                        className="input input-sm"
                        value={posicao}
                        onChange={(e) =>
                          actions.updateDivisor(div.id, {
                            posicaoRelativaAoSep: e.target.value as DivisorPosicaoRelativaAoSep,
                            alturaMm: undefined,
                          })
                        }
                      >
                        <option value="baixo">Abaixo do SEP</option>
                        <option value="cima">Acima do SEP</option>
                      </select>
                    </label>
                  </>
                ) : null}
                <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                  Referência
                  <select
                    className="input input-sm"
                    value={div.referenceEdge}
                    onChange={(e) =>
                      actions.updateDivisor(div.id, {
                        referenceEdge: e.target.value as DivisorReferenceEdge,
                      })
                    }
                  >
                    <option value="left">A partir da ESQ</option>
                    <option value="right">A partir da DIR</option>
                  </select>
                </label>
                <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                  Posição (mm)
                  <input
                    type="range"
                    min={dims.larguraMm / 2}
                    max={maxPos}
                    step={1}
                    value={div.positionMm}
                    onChange={(e) => actions.updateDivisor(div.id, { positionMm: Number(e.target.value) })}
                    style={{ width: "100%" }}
                  />
                  <NumericInput
                    value={div.positionMm}
                    onChange={(v) => actions.updateDivisor(div.id, { positionMm: v })}
                    min={dims.larguraMm / 2}
                    max={maxPos}
                  />
                </label>
                <label style={{ display: "block", fontSize: 11, marginBottom: 6 }}>
                  Profundidade (mm)
                  <NumericInput
                    value={div.profundidadeMm ?? dims.profundidadeMm}
                    onChange={(v) => actions.updateDivisor(div.id, { profundidadeMm: v })}
                    min={50}
                    max={internal.profundidadeInterna}
                  />
                </label>
                <label style={{ display: "block", fontSize: 11, marginBottom: hasShelves ? 6 : 8 }}>
                  Altura (mm)
                  {linked ? (
                    <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", marginBottom: 4 }}>
                      Altura ajustada automaticamente ao SEP ({posicao}): {dims.alturaMm} mm
                    </span>
                  ) : (
                    <NumericInput
                      value={dims.alturaMm}
                      onChange={(v) =>
                        actions.updateDivisor(div.id, { alturaMm: v, linkedSeparadorId: undefined })
                      }
                      min={50}
                      max={internal.alturaInterna}
                    />
                  )}
                </label>
                {hasShelves ? (
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                      <button
                        type="button"
                        className={`button button-sm ${(div.prateleiraLado ?? "direita") === "esquerda" ? "button-primary" : "button-ghost"}`}
                        onClick={() =>
                          actions.updateDivisor(div.id, { prateleiraLado: "esquerda" as DivisorPrateleiraLado })
                        }
                      >
                        Prateleiras Esquerda
                      </button>
                      <button
                        type="button"
                        className={`button button-sm ${(div.prateleiraLado ?? "direita") === "direita" ? "button-primary" : "button-ghost"}`}
                        onClick={() =>
                          actions.updateDivisor(div.id, { prateleiraLado: "direita" as DivisorPrateleiraLado })
                        }
                      >
                        Prateleiras Direita
                      </button>
                    </div>
                    {(() => {
                      const maxShelves = Math.max(0, Math.floor(box.prateleiras ?? 0));
                      const gridYs = resolveDivShelfGridYs(box, div);
                      const selected = div.prateleiraYsMm ?? [];
                      if (gridYs.length === 0 || maxShelves < 1) return null;
                      return (
                        <div style={{ fontSize: 11, marginBottom: 4 }}>
                          <div style={{ marginBottom: 4 }}>
                            Posição exacta das prateleiras (grelha 32 mm) — até {maxShelves}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: 2,
                              maxHeight: 140,
                              overflowY: "auto",
                            }}
                          >
                            {gridYs.map((y) => {
                              const checked = selected.some((s) => Math.abs(s - y) <= 0.6);
                              return (
                                <label
                                  key={y}
                                  style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}
                                >
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      let next: number[];
                                      if (checked) {
                                        next = selected.filter((s) => Math.abs(s - y) > 0.6);
                                      } else if (selected.length >= maxShelves) {
                                        next = [...selected.slice(1), y].sort((a, b) => a - b);
                                      } else {
                                        next = [...selected, y].sort((a, b) => a - b);
                                      }
                                      actions.updateDivisor(div.id, {
                                        prateleiraYsMm: next.length > 0 ? next : undefined,
                                      });
                                    }}
                                  />
                                  <span>{y} mm</span>
                                </label>
                              );
                            })}
                          </div>
                          {selected.length > 0 ? (
                            <button
                              type="button"
                              className="button button-ghost button-sm"
                              style={{ marginTop: 4 }}
                              onClick={() => actions.updateDivisor(div.id, { prateleiraYsMm: undefined })}
                            >
                              Usar posições automáticas
                            </button>
                          ) : (
                            <span style={{ display: "block", fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>
                              Sem selecção: distribuição automática das {maxShelves} prateleiras.
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                ) : null}
                <button
                  type="button"
                  className="button button-ghost button-sm"
                  onClick={() => actions.removeDivisor(div.id)}
                >
                  Remover
                </button>
              </div>
            );
          })
        : null}
    </>
  );

  if (embedded) return content;

  const panelTitle =
    section === "div"
      ? "DIVISÓRIOS"
      : section === "sep"
        ? "SEPARADORES"
        : "DIVISÓRIOS E SEPARADORES";

  return <Panel title={panelTitle}>{content}</Panel>;
}
