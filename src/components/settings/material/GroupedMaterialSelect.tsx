import { useMemo } from "react";
import type { OfficialWoodMaterial } from "../../../core/materials/materials.api";
import { resolveFamiliaAppearance } from "../../../core/catalog/materiaisFamiliaAppearance";
import {
  findGrupoByMaterialId,
  getMaterialEspessuraMm,
  groupMaterialsByPadronizado,
  resolveVariantInGrupo,
} from "./materialGrouping";

type Props = {
  materials: OfficialWoodMaterial[];
  value: string;
  onChange: (canonicalId: string) => void;
  className?: string;
  selectClassName?: string;
  materialSelectId?: string;
  thicknessSelectId?: string;
  disabled?: boolean;
};

function FamiliaSwatch({ familia }: { familia: string }) {
  const appearance = resolveFamiliaAppearance(familia, []);
  if (appearance.textureUrl) {
    return (
      <span
        aria-hidden
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          flexShrink: 0,
          border: "1px solid rgba(255,255,255,0.25)",
          backgroundImage: `url(${appearance.textureUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: 18,
        height: 18,
        borderRadius: 4,
        flexShrink: 0,
        border: "1px solid rgba(255,255,255,0.25)",
        background: appearance.color || "rgba(255,255,255,0.12)",
      }}
    />
  );
}

/**
 * Selecção em 2 passos alinhada ao SSOT: família (Nome novo padronizado) + espessura (mm).
 * Não altera IDs canónicos — onChange continua a emitir o canonicalId industrial.
 */
export default function GroupedMaterialSelect({
  materials,
  value,
  onChange,
  className,
  selectClassName = "select",
  materialSelectId,
  thicknessSelectId,
  disabled = false,
}: Props) {
  const grupos = useMemo(() => groupMaterialsByPadronizado(materials), [materials]);

  const currentGrupo =
    findGrupoByMaterialId(grupos, value) ?? grupos[0] ?? null;

  const currentThickness = useMemo(() => {
    const current = materials.find((m) => m.canonicalId === value);
    return current ? getMaterialEspessuraMm(current) : 0;
  }, [materials, value]);

  const thicknessOptions = currentGrupo?.listaDeEspessuras ?? [];
  const thicknessSelectValue = thicknessOptions.some(
    (m) => getMaterialEspessuraMm(m) === currentThickness
  )
    ? currentThickness
    : getMaterialEspessuraMm(thicknessOptions[0] ?? { label: "" });

  const handleFamilyChange = (materialPadronizado: string) => {
    const grupo = grupos.find((g) => g.materialPadronizado === materialPadronizado);
    if (!grupo) return;
    const next = resolveVariantInGrupo(grupo, currentThickness);
    if (next?.canonicalId) onChange(next.canonicalId);
  };

  const handleThicknessChange = (thicknessMm: number) => {
    if (!currentGrupo) return;
    const next = resolveVariantInGrupo(currentGrupo, thicknessMm);
    if (next?.canonicalId) onChange(next.canonicalId);
  };

  if (grupos.length === 0) {
    return (
      <select className={selectClassName} value="" disabled>
        <option value="">Sem materiais</option>
      </select>
    );
  }

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: 6, width: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
        {currentGrupo ? <FamiliaSwatch familia={currentGrupo.materialPadronizado} /> : null}
        <select
          id={materialSelectId}
          className={selectClassName}
          value={currentGrupo?.materialPadronizado ?? ""}
          onChange={(e) => handleFamilyChange(e.target.value)}
          style={{ width: "100%", flex: 1 }}
          aria-label="Família de material"
          disabled={disabled}
        >
          {grupos.map((g) => (
            <option key={g.materialPadronizado} value={g.materialPadronizado}>
              {g.materialPadronizado}
            </option>
          ))}
        </select>
      </div>
      <select
        id={thicknessSelectId}
        className={selectClassName}
        value={thicknessSelectValue || ""}
        onChange={(e) => handleThicknessChange(Number(e.target.value))}
        style={{ width: "100%" }}
        aria-label="Espessura"
        disabled={disabled}
      >
        {thicknessOptions.map((m) => {
          const t = getMaterialEspessuraMm(m);
          return (
            <option key={m.canonicalId} value={t}>
              {t} mm
            </option>
          );
        })}
      </select>
    </div>
  );
}
