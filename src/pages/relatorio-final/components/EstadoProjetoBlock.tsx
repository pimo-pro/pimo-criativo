import { useState } from "react";
import Button from "@/components/ui/Button";
import {
  makeReportId,
  type ProjectReportDesign,
  type ProjectReportMontagem,
  type ProjectReportProducao,
  type ReportOperador,
  type ReportPeca,
  type ReportStyle,
} from "@/core/projectReport";
import {
  reportClickable,
  reportGrid3,
  reportInput,
  reportLabel,
  reportSection,
  reportSectionTitle,
  reportTable,
  reportTableWrap,
  reportTd,
  reportTh,
} from "../reportStyles";
import { R } from "../uiLabels";
import EditableModal from "./EditableModal";
import ReportItemsList from "./ReportItemsList";

type Props = {
  style: ReportStyle;
  design: ProjectReportDesign;
  producao: ProjectReportProducao;
  montagem: ProjectReportMontagem;
  onDesign: (next: ProjectReportDesign) => void;
  onProducao: (next: ProjectReportProducao, path?: string) => void;
  onMontagem: (next: ProjectReportMontagem, path?: string) => void;
};

type ModalKind = "operadores" | "caixas" | "pecas" | "instaladores" | null;

function OperadoresEditor({
  list,
  onChange,
}: {
  list: ReportOperador[];
  onChange: (next: ReportOperador[]) => void;
}) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {list.map((op, idx) => (
        <div
          key={op.id}
          style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr auto", gap: 8 }}
        >
          <input
            style={reportInput}
            placeholder="Nome"
            value={op.nome}
            onChange={(e) => {
              const next = [...list];
              next[idx] = { ...op, nome: e.target.value };
              onChange(next);
            }}
          />
          <input
            type="number"
            min={0}
            step={0.5}
            style={reportInput}
            placeholder="Horas"
            value={op.horas}
            onChange={(e) => {
              const next = [...list];
              next[idx] = { ...op, horas: Math.max(0, Number(e.target.value) || 0) };
              onChange(next);
            }}
          />
          <input
            style={reportInput}
            placeholder="Tarefas"
            value={op.tarefas}
            onChange={(e) => {
              const next = [...list];
              next[idx] = { ...op, tarefas: e.target.value };
              onChange(next);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            onClick={() => onChange(list.filter((_, i) => i !== idx))}
          >
            {R.remover}
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="secondary"
        onClick={() =>
          onChange([...list, { id: makeReportId("op"), nome: "", horas: 0, tarefas: "" }])
        }
      >
        {R.adicionarPessoa}
      </Button>
    </div>
  );
}

export default function EstadoProjetoBlock({
  style,
  design,
  producao,
  montagem,
  onDesign,
  onProducao,
  onMontagem,
}: Props) {
  const [modal, setModal] = useState<ModalKind>(null);

  return (
    <section style={reportSection(style)}>
      <h2 style={reportSectionTitle}>{R.estadoProjeto}</h2>

      <div style={{ display: "grid", gap: 16 }}>
        <div style={reportSection("classic")}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>{R.design}</h3>
          <div style={reportGrid3}>
            <label>
              <span style={reportLabel}>{R.inicioDesign}</span>
              <input
                type="date"
                style={reportInput}
                value={design.dataInicio}
                onChange={(e) => onDesign({ ...design, dataInicio: e.target.value })}
              />
            </label>
            <label>
              <span style={reportLabel}>{R.conclusaoDesign}</span>
              <input
                type="date"
                style={reportInput}
                value={design.dataConclusao}
                onChange={(e) => onDesign({ ...design, dataConclusao: e.target.value })}
              />
            </label>
            <label>
              <span style={reportLabel}>{R.revisoesAntes}</span>
              <input
                type="number"
                min={0}
                style={reportInput}
                value={design.revisoesAntesProducao}
                onChange={(e) =>
                  onDesign({
                    ...design,
                    revisoesAntesProducao: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </label>
            <label>
              <span style={reportLabel}>{R.revisoesApos}</span>
              <input
                type="number"
                min={0}
                style={reportInput}
                value={design.revisoesAposProducao}
                onChange={(e) =>
                  onDesign({
                    ...design,
                    revisoesAposProducao: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </label>
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <ReportItemsList
              label={R.errosDesign}
              items={design.errosDesign}
              onChange={(errosDesign) => onDesign({ ...design, errosDesign })}
            />
            <ReportItemsList
              label={R.solucoes}
              items={design.solucoesAplicadas}
              onChange={(solucoesAplicadas) => onDesign({ ...design, solucoesAplicadas })}
            />
            <ReportItemsList
              label={R.melhoriasPropostas}
              items={design.melhoriasPropostas}
              onChange={(melhoriasPropostas) => onDesign({ ...design, melhoriasPropostas })}
            />
            <ReportItemsList
              label={R.melhoriasImpl}
              items={design.melhoriasImplementadas}
              onChange={(melhoriasImplementadas) =>
                onDesign({ ...design, melhoriasImplementadas })
              }
            />
          </div>
        </div>

        <div style={reportSection("classic")}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>{R.producao}</h3>
          <div style={reportGrid3}>
            <div>
              <span style={reportLabel}>{R.operadores}</span>
              <button type="button" style={reportClickable} onClick={() => setModal("operadores")}>
                {producao.operadores.length}
              </button>
            </div>
            <div>
              <span style={reportLabel}>{R.totalCaixas}</span>
              <button type="button" style={reportClickable} onClick={() => setModal("caixas")}>
                {producao.caixas.length}
              </button>
            </div>
            <div>
              <span style={reportLabel}>{R.totalPecas}</span>
              <button type="button" style={reportClickable} onClick={() => setModal("pecas")}>
                {producao.pecas.length}
              </button>
            </div>
            <label>
              <span style={reportLabel}>{R.inicioProducao}</span>
              <input
                type="date"
                style={reportInput}
                value={producao.dataInicio}
                onChange={(e) => onProducao({ ...producao, dataInicio: e.target.value })}
              />
            </label>
            <label>
              <span style={reportLabel}>{R.fimProducao}</span>
              <input
                type="date"
                style={reportInput}
                value={producao.dataFim}
                onChange={(e) => onProducao({ ...producao, dataFim: e.target.value })}
              />
            </label>
            <label>
              <span style={reportLabel}>{R.horasEfetivas}</span>
              <input
                type="number"
                min={0}
                step={0.5}
                style={reportInput}
                value={producao.horasEfetivas}
                onChange={(e) =>
                  onProducao({
                    ...producao,
                    horasEfetivas: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </label>
            <label>
              <span style={reportLabel}>{R.reProducoes}</span>
              <input
                type="number"
                min={0}
                style={reportInput}
                value={producao.reProducoes}
                onChange={(e) =>
                  onProducao({
                    ...producao,
                    reProducoes: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </label>
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <ReportItemsList
              label={R.errosProducao}
              items={producao.erros}
              onChange={(erros) => onProducao({ ...producao, erros })}
            />
            <ReportItemsList
              label={R.solucoes}
              items={producao.solucoesAplicadas}
              onChange={(solucoesAplicadas) => onProducao({ ...producao, solucoesAplicadas })}
            />
            <ReportItemsList
              label={R.melhoriasImpl}
              items={producao.melhoriasImplementadas}
              onChange={(melhoriasImplementadas) =>
                onProducao({ ...producao, melhoriasImplementadas })
              }
            />
          </div>
        </div>

        <div style={reportSection("classic")}>
          <h3 style={{ margin: "0 0 10px", fontSize: 14 }}>{R.montagem}</h3>
          <div style={reportGrid3}>
            <label>
              <span style={reportLabel}>{R.dataEnvio}</span>
              <input
                type="date"
                style={reportInput}
                value={montagem.dataEnvio}
                onChange={(e) => onMontagem({ ...montagem, dataEnvio: e.target.value })}
              />
            </label>
            <div>
              <span style={reportLabel}>{R.instaladores}</span>
              <button type="button" style={reportClickable} onClick={() => setModal("instaladores")}>
                {montagem.instaladores.length}
              </button>
            </div>
            <label>
              <span style={reportLabel}>{R.inicioMontagem}</span>
              <input
                type="date"
                style={reportInput}
                value={montagem.dataInicio}
                onChange={(e) => onMontagem({ ...montagem, dataInicio: e.target.value })}
              />
            </label>
            <label>
              <span style={reportLabel}>{R.fimMontagem}</span>
              <input
                type="date"
                style={reportInput}
                value={montagem.dataFim}
                onChange={(e) => onMontagem({ ...montagem, dataFim: e.target.value })}
              />
            </label>
            <label>
              <span style={reportLabel}>{R.intervencoes}</span>
              <input
                type="number"
                min={0}
                style={reportInput}
                value={montagem.intervencoesPos}
                onChange={(e) =>
                  onMontagem({
                    ...montagem,
                    intervencoesPos: Math.max(0, Number(e.target.value) || 0),
                  })
                }
              />
            </label>
          </div>
          <div style={{ display: "grid", gap: 12, marginTop: 10 }}>
            <ReportItemsList
              label={R.errosMontagem}
              items={montagem.erros}
              onChange={(erros) => onMontagem({ ...montagem, erros })}
            />
            <ReportItemsList
              label={R.solucoes}
              items={montagem.solucoesAplicadas}
              onChange={(solucoesAplicadas) => onMontagem({ ...montagem, solucoesAplicadas })}
            />
            <ReportItemsList
              label={R.melhoriasImpl}
              items={montagem.melhoriasImplementadas}
              onChange={(melhoriasImplementadas) =>
                onMontagem({ ...montagem, melhoriasImplementadas })
              }
            />
          </div>
        </div>
      </div>

      <EditableModal
        open={modal === "operadores"}
        title={R.operadores}
        onClose={() => setModal(null)}
      >
        <OperadoresEditor
          list={producao.operadores}
          onChange={(operadores) => onProducao({ ...producao, operadores }, "producao.operadores")}
        />
      </EditableModal>

      <EditableModal open={modal === "caixas"} title={R.listaCaixas} onClose={() => setModal(null)}>
        <div style={reportTableWrap}>
          <table style={reportTable}>
            <thead>
              <tr>
                <th style={reportTh}>{R.nome}</th>
                <th style={reportTh}>{R.dimensoes}</th>
                <th style={reportTh}>{R.tipo}</th>
              </tr>
            </thead>
            <tbody>
              {producao.caixas.map((c) => (
                <tr key={c.id}>
                  <td style={reportTd}>{c.nome}</td>
                  <td style={reportTd}>{c.dimensoes}</td>
                  <td style={reportTd}>{c.tipo}</td>
                </tr>
              ))}
              {producao.caixas.length === 0 ? (
                <tr>
                  <td style={reportTd} colSpan={3}>
                    {R.semCaixas}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </EditableModal>

      <EditableModal open={modal === "pecas"} title={R.listaPecas} onClose={() => setModal(null)}>
        <div style={reportTableWrap}>
          <table style={reportTable}>
            <thead>
              <tr>
                {[
                  "REF",
                  R.peca,
                  "MATERIAL",
                  "QTD",
                  "COMP",
                  "LARG",
                  "ESP",
                  R.erro,
                  R.notas,
                  R.correcao,
                ].map((h) => (
                  <th key={h} style={reportTh}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {producao.pecas.map((p, idx) => (
                <tr key={p.id}>
                  <td style={reportTd}>{p.ref}</td>
                  <td style={reportTd}>{p.peca}</td>
                  <td style={reportTd}>{p.material}</td>
                  <td style={reportTd}>{p.qtd}</td>
                  <td style={reportTd}>{p.comp}</td>
                  <td style={reportTd}>{p.larg}</td>
                  <td style={reportTd}>{p.esp}</td>
                  <td style={reportTd}>
                    <input
                      type="checkbox"
                      checked={p.temErro}
                      onChange={(e) => {
                        const pecas = [...producao.pecas];
                        pecas[idx] = { ...p, temErro: e.target.checked };
                        onProducao({ ...producao, pecas }, "producao.pecas");
                      }}
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      style={{ ...reportInput, minHeight: 32 }}
                      value={p.notasErro}
                      onChange={(e) => {
                        const pecas: ReportPeca[] = [...producao.pecas];
                        pecas[idx] = { ...p, notasErro: e.target.value };
                        onProducao({ ...producao, pecas }, "producao.pecas");
                      }}
                    />
                  </td>
                  <td style={reportTd}>
                    <input
                      style={{ ...reportInput, minHeight: 32 }}
                      value={p.propostaCorrecao}
                      onChange={(e) => {
                        const pecas: ReportPeca[] = [...producao.pecas];
                        pecas[idx] = { ...p, propostaCorrecao: e.target.value };
                        onProducao({ ...producao, pecas }, "producao.pecas");
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EditableModal>

      <EditableModal
        open={modal === "instaladores"}
        title={R.instaladores}
        onClose={() => setModal(null)}
      >
        <OperadoresEditor
          list={montagem.instaladores}
          onChange={(instaladores) =>
            onMontagem({ ...montagem, instaladores }, "montagem.instaladores")
          }
        />
      </EditableModal>
    </section>
  );
}
