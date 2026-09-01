import type { ChangeEvent } from "react";
import type { DrawerLayerItem, DrawerLayerMetadata } from "../../models/BoxLayers";
import type { WorkspaceBox } from "../../core/types";
import { getSettings } from "../../core/settings/settingsService";
import { listOfficialMaterials } from "../../core/materials/materials.api";
import GroupedMaterialSelect from "../settings/material/GroupedMaterialSelect";
import {
  DRAWER_HANDLE_POSITIONS,
  DRAWER_HANDLE_TYPES,
  DRAWER_METAL_BOX_TYPES,
  DRAWER_SLIDE_TYPES,
  isDrawerSlideTypeActive,
  isDrawerMetalBoxTypeActive,
  drawerSlideTypeOptionLabel,
  drawerMetalBoxTypeOptionLabel,
} from "../../core/drawers/drawerUiConstants";
import {
  getDefaultProfileForHandleType,
  listProfilesForHandleType,
  STANDARD_HANDLE_CENTER_DISTANCES_MM,
} from "../../core/drawers/drawerHandleCatalog";
import {
  isMetalBoxCatalogType,
  listMetalBoxProfilesForType,
  pickCompatibleMetalDepth,
  resolveMetalBoxHeightMm,
  resolveMetalBoxProfile,
} from "../../core/drawers/drawerMetalBoxCatalog";
import { validateDrawerLayerItem } from "../../core/drawers/drawerUiValidation";
import {
  resolveDrawerBodyHeightMm,
  resolveDrawerExternalFrontHeightMm,
  resolveDrawerInternalFrontHeightMm,
} from "../../core/drawers/drawerLayerCustomization";
import type {
  DrawerHandlePosition,
  DrawerHandleType,
  DrawerMetalBoxType,
  DrawerSlideType,
} from "../../core/settings/settingsSchema";

export type DrawerConfigPanelProps = {
  drawer: DrawerLayerItem;
  index: number;
  box: WorkspaceBox;
  showHardware?: boolean;
  onUpdate: (partial: Partial<DrawerLayerItem>) => void;
  /** Atualização imediata do material da frente no viewer 3D (sem rebuild estrutural). */
  onFrontMaterialChange?: (materialId: string) => void;
};

function mergeDrawerMetadata(
  current: DrawerLayerMetadata | undefined,
  patch: DrawerLayerMetadata
): DrawerLayerMetadata {
  return { ...current, ...patch };
}

function buildDrawerConfigPatch(
  drawer: DrawerLayerItem,
  patch: Partial<DrawerLayerItem> & { metadata?: DrawerLayerMetadata }
): Partial<DrawerLayerItem> {
  const metadata = mergeDrawerMetadata(drawer.metadata, {
    ...drawer.metadata,
    ...patch.metadata,
    slideType: (patch.slideType ?? drawer.slideType) as DrawerSlideType | undefined,
    metalBoxType: (patch.metalBoxType ?? drawer.metalBoxType) as DrawerMetalBoxType | undefined,
    softClose: patch.softClose ?? drawer.softClose,
    handleType: (patch.handleType ?? drawer.handleType) as DrawerHandleType | undefined,
    handlePosition: (patch.handlePosition ?? drawer.handlePosition) as DrawerHandlePosition | undefined,
    handleOffsetMm: patch.handleOffsetMm ?? drawer.handleOffsetMm,
    handleProfileId: patch.metadata?.handleProfileId ?? drawer.metadata?.handleProfileId,
    handleCenterDistanceMm: patch.metadata?.handleCenterDistanceMm ?? drawer.metadata?.handleCenterDistanceMm,
    handleOffsetXMm: patch.metadata?.handleOffsetXMm ?? drawer.metadata?.handleOffsetXMm,
    handleOffsetYMm: patch.metadata?.handleOffsetYMm ?? drawer.metadata?.handleOffsetYMm,
    handlePositionPercent: patch.metadata?.handlePositionPercent ?? drawer.metadata?.handlePositionPercent,
    drawerType: (patch.type ?? patch.drawerType ?? drawer.type ?? drawer.drawerType) as
      | "normal"
      | "pro"
      | undefined,
    nominalDepth: patch.metadata?.nominalDepth ?? drawer.metadata?.nominalDepth,
    metalBoxProfileId: patch.metadata?.metalBoxProfileId ?? drawer.metadata?.metalBoxProfileId,
    metalBoxHeightMm: patch.metadata?.metalBoxHeightMm ?? drawer.metadata?.metalBoxHeightMm,
    frontMaterial: patch.material ?? patch.metadata?.frontMaterial ?? drawer.material,
    frontHeightMm: patch.metadata?.frontHeightMm ?? drawer.metadata?.frontHeightMm,
    frontPieceName: patch.metadata?.frontPieceName ?? drawer.metadata?.frontPieceName,
    frontIntPieceName: patch.metadata?.frontIntPieceName ?? drawer.metadata?.frontIntPieceName,
    frontExtPieceName: patch.metadata?.frontExtPieceName ?? drawer.metadata?.frontExtPieceName,
    drawerGroupName: patch.metadata?.drawerGroupName ?? drawer.metadata?.drawerGroupName,
  });

  const bodyHeight = resolveDrawerBodyHeightMm(drawer);
  const nextFrontHeightMm = patch.metadata?.frontHeightMm ?? drawer.metadata?.frontHeightMm;
  const resolvedFrontHeight =
    nextFrontHeightMm != null && Number.isFinite(nextFrontHeightMm) && nextFrontHeightMm > 0
      ? nextFrontHeightMm
      : bodyHeight;

  return {
    ...patch,
    metadata,
    material: patch.material ?? drawer.material,
    materialId: patch.materialId ?? patch.material ?? drawer.materialId,
    height: resolvedFrontHeight,
    bodyHeight: patch.bodyHeight ?? drawer.bodyHeight ?? bodyHeight,
  };
}

// eslint-disable-next-line react-refresh/only-export-components
export function getDrawerStatusBadges(drawer: DrawerLayerItem): string[] {
  const badges: string[] = [];
  const type = drawer.type ?? drawer.drawerType ?? "normal";
  if (type === "pro") badges.push("PRO");
  else badges.push("Normal");
  if (drawer.metalBoxType && drawer.metalBoxType !== "Nenhuma") {
    badges.push("Metálica");
  }
  if (drawer.softClose) badges.push("Soft-close");
  if (drawer.metadata?.hardwareSource === "individual") badges.push("Individual");
  else if (drawer.metadata?.hardwareSource === "global") badges.push("Global");
  return badges;
}

const alertStyle = (level: "warning" | "error") => ({
  fontSize: 11,
  padding: "6px 8px",
  borderRadius: 6,
  marginTop: 6,
  background: level === "error" ? "rgba(239,68,68,0.12)" : "rgba(234,179,8,0.12)",
  color: level === "error" ? "#fca5a5" : "#fde68a",
  border: `1px solid ${level === "error" ? "rgba(239,68,68,0.35)" : "rgba(234,179,8,0.35)"}`,
});

export default function DrawerConfigPanel({
  drawer,
  index,
  box,
  showHardware = true,
  onUpdate,
  onFrontMaterialChange,
}: DrawerConfigPanelProps) {
  const settings = getSettings().gavetas;
  const woodMaterials = listOfficialMaterials().filter((m) => m.industrial && m.visual);
  const alerts = validateDrawerLayerItem(drawer, box, settings);

  const drawerType = drawer.type ?? drawer.drawerType ?? "normal";
  const slideType = drawer.slideType ?? settings.gavetaTipoCorredica;
  const metalBoxType = drawer.metalBoxType ?? settings.gavetaTipoCaixaMetalica;
  const metalProfile = isMetalBoxCatalogType(metalBoxType)
    ? resolveMetalBoxProfile(
        metalBoxType,
        drawer.metadata?.metalBoxProfileId,
        drawer.metadata?.metalBoxHeightMm
      )
    : null;
  const metalHeightOptions = metalProfile?.allowedHeightsMm ?? [];
  const metalHeightMm =
    drawer.metadata?.metalBoxHeightMm ??
    (metalProfile ? resolveMetalBoxHeightMm(metalProfile) : settings.gavetaAlturaCaixaMetalicaMm);
  const depthOptions = metalProfile
    ? metalProfile.compatibleDepthsMm
    : settings.gavetaProfundidadesDisponiveisMm;
  const handleType = drawer.handleType ?? settings.gavetaTipoHandle;
  const handlePosition = drawer.handlePosition ?? settings.gavetaPosicaoHandle;
  const handleProfileId =
    drawer.metadata?.handleProfileId ?? getDefaultProfileForHandleType(handleType)?.id ?? "";
  const handleCenterDistanceMm =
    drawer.metadata?.handleCenterDistanceMm ??
    getDefaultProfileForHandleType(handleType)?.defaultCenterDistanceMm ??
    80;
  const handleOffsetX = drawer.metadata?.handleOffsetXMm ?? 0;
  const handleOffsetY = drawer.metadata?.handleOffsetYMm ?? drawer.handleOffsetMm ?? settings.gavetaOffsetHandleMm;
  const handlePositionPercent = drawer.metadata?.handlePositionPercent ?? 50;
  const profileOptions = listProfilesForHandleType(handleType);
  const nominalDepth = drawer.metadata?.nominalDepth ?? drawer.depth;
  const material = drawer.material ?? drawer.materialId ?? "";
  const bodyHeight = Math.round(resolveDrawerBodyHeightMm(drawer));
  const internalFrontHeight = Math.round(resolveDrawerInternalFrontHeightMm(drawer));
  const externalFrontHeight = Math.round(resolveDrawerExternalFrontHeightMm(drawer));
  const frontHeightOverride = drawer.metadata?.frontHeightMm;
  const frontPieceName = drawer.metadata?.frontExtPieceName ?? drawer.metadata?.frontPieceName ?? "";
  const frontIntPieceName = drawer.metadata?.frontIntPieceName ?? "";
  const drawerGroupName = drawer.metadata?.drawerGroupName ?? "";

  const update = (patch: Partial<DrawerLayerItem> & { metadata?: DrawerLayerMetadata }) => {
    onUpdate(buildDrawerConfigPatch(drawer, patch));
  };

  const parseOptionalPositiveMm = (raw: string): number | undefined => {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
      {alerts.map((alert, i) => (
        <div key={`${alert.level}-${i}`} style={alertStyle(alert.level)}>
          {alert.message}
        </div>
      ))}

      {showHardware && (
        <>
          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Tipo de gaveta</span>
            <select
              className="select select-xs"
              value={drawerType}
              onChange={(e) =>
                update({
                  type: e.target.value as "normal" | "pro",
                  drawerType: e.target.value as "normal" | "pro",
                })
              }
            >
              <option value="normal">Normal</option>
              <option value="pro">PRO (caixa metálica)</option>
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Corrediça</span>
            <select
              className="select select-xs"
              value={slideType}
              onChange={(e) => update({ slideType: e.target.value as DrawerSlideType })}
            >
              {DRAWER_SLIDE_TYPES.map((option) => (
                <option key={option} value={option} disabled={!isDrawerSlideTypeActive(option)}>
                  {drawerSlideTypeOptionLabel(option)}
                </option>
              ))}
            </select>
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Caixa metálica</span>
            <select
              className="select select-xs"
              value={metalBoxType}
              onChange={(e) => {
                const nextType = e.target.value as DrawerMetalBoxType;
                if (nextType === "Nenhuma") {
                  update({ metalBoxType: nextType, metadata: { metalBoxProfileId: undefined, metalBoxHeightMm: undefined } });
                  return;
                }
                const profiles = listMetalBoxProfilesForType(nextType);
                const profile = profiles[0] ?? null;
                const height = profile ? resolveMetalBoxHeightMm(profile) : settings.gavetaAlturaCaixaMetalicaMm;
                const depth = profile
                  ? pickCompatibleMetalDepth(profile, drawer.metadata?.nominalDepth ?? drawer.depth)
                  : drawer.metadata?.nominalDepth ?? drawer.depth;
                update({
                  metalBoxType: nextType,
                  slideType: profile?.defaultSlideType ?? drawer.slideType,
                  bodyHeight: height,
                  metadata: {
                    metalBoxProfileId: profile?.id,
                    metalBoxHeightMm: height,
                    nominalDepth: depth,
                  },
                });
              }}
            >
              {DRAWER_METAL_BOX_TYPES.map((option) => (
                <option
                  key={option}
                  value={option}
                  disabled={option !== "Nenhuma" && !isDrawerMetalBoxTypeActive(option)}
                >
                  {option === "Nenhuma" ? option : drawerMetalBoxTypeOptionLabel(option)}
                </option>
              ))}
            </select>
          </label>

          {metalBoxType !== "Nenhuma" && metalProfile && (
            <>
              {listMetalBoxProfilesForType(metalBoxType).length > 1 && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Perfil / série</span>
                  <select
                    className="select select-xs"
                    value={metalProfile.id}
                    onChange={(e) => {
                      const profile = listMetalBoxProfilesForType(metalBoxType).find((p) => p.id === e.target.value);
                      if (!profile) return;
                      const height = resolveMetalBoxHeightMm(profile, metalHeightMm);
                      update({
                        slideType: profile.defaultSlideType,
                        bodyHeight: height,
                        metadata: {
                          metalBoxProfileId: profile.id,
                          metalBoxHeightMm: height,
                          nominalDepth: pickCompatibleMetalDepth(
                            profile,
                            drawer.metadata?.nominalDepth ?? drawer.depth
                          ),
                        },
                      });
                    }}
                  >
                    {listMetalBoxProfilesForType(metalBoxType).map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Altura da caixa (mm)</span>
                <select
                  className="select select-xs"
                  value={metalHeightMm}
                  onChange={(e) => {
                    const height = Number(e.target.value) || metalHeightOptions[0];
                    update({
                      bodyHeight: height,
                      metadata: { metalBoxHeightMm: height },
                    });
                  }}
                >
                  {metalHeightOptions.map((h) => (
                    <option key={h} value={h}>
                      {h} mm
                    </option>
                  ))}
                </select>
              </label>

              <div style={alertStyle("warning")}>
                Peças internas de madeira omitidas — apenas frente + caixa metálica ({metalProfile.brand}).
              </div>
            </>
          )}

          {metalBoxType !== "Nenhuma" && !metalProfile && (
            <div style={alertStyle("warning")}>
              Peças internas da gaveta serão omitidas (caixa metálica).
            </div>
          )}

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={Boolean(drawer.softClose)}
              onChange={(e) => update({ softClose: e.target.checked })}
            />
            Soft-close
          </label>

          <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Puxador / handle</span>
            <select
              className="select select-xs"
              value={handleType}
              onChange={(e) => {
                const nextType = e.target.value as DrawerHandleType;
                const defaultProfile = getDefaultProfileForHandleType(nextType);
                update({
                  handleType: nextType,
                  metadata: {
                    handleProfileId: defaultProfile?.id,
                    handleCenterDistanceMm: defaultProfile?.defaultCenterDistanceMm,
                  },
                });
              }}
            >
              {DRAWER_HANDLE_TYPES.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          {handleType !== "Nenhum" && (
            <>
              {profileOptions.length > 1 && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Perfil de puxador</span>
                  <select
                    className="select select-xs"
                    value={handleProfileId}
                    onChange={(e) => {
                      const profile = profileOptions.find((p) => p.id === e.target.value);
                      update({
                        metadata: {
                          handleProfileId: e.target.value || undefined,
                          handleCenterDistanceMm: profile?.defaultCenterDistanceMm,
                        },
                      });
                    }}
                  >
                    {profileOptions.map((profile) => (
                      <option key={profile.id} value={profile.id}>
                        {profile.nome}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              {handleType === "Puxador" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>CC (mm)</span>
                  <select
                    className="select select-xs"
                    value={handleCenterDistanceMm}
                    onChange={(e) =>
                      update({
                        metadata: { handleCenterDistanceMm: Number(e.target.value) || 80 },
                      })
                    }
                  >
                    {STANDARD_HANDLE_CENTER_DISTANCES_MM.map((cc) => (
                      <option key={cc} value={cc}>
                        {cc} mm
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Posição automática</span>
                <select
                  className="select select-xs"
                  value={handlePosition}
                  onChange={(e) =>
                    update({ handlePosition: e.target.value as DrawerHandlePosition })
                  }
                >
                  {DRAWER_HANDLE_POSITIONS.map((option) => (
                    <option key={option} value={option}>
                      {option === "Percentual" ? "% da altura" : option}
                    </option>
                  ))}
                </select>
              </label>

              {handlePosition === "Percentual" && (
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>% da altura (topo→base)</span>
                  <input
                    className="input input-xs"
                    type="number"
                    min={5}
                    max={95}
                    value={handlePositionPercent}
                    onChange={(e) =>
                      update({
                        metadata: { handlePositionPercent: Number(e.target.value) || 50 },
                      })
                    }
                  />
                </label>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Offset X (mm)</span>
                  <input
                    className="input input-xs"
                    type="number"
                    value={handleOffsetX}
                    onChange={(e) =>
                      update({
                        metadata: { handleOffsetXMm: Number(e.target.value) || 0 },
                      })
                    }
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Offset Y (mm)</span>
                  <input
                    className="input input-xs"
                    type="number"
                    value={handleOffsetY}
                    onChange={(e) =>
                      update({
                        handleOffsetMm: Number(e.target.value) || 0,
                        metadata: { handleOffsetYMm: Number(e.target.value) || 0 },
                      })
                    }
                  />
                </label>
              </div>
            </>
          )}
        </>
      )}

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Profundidade nominal (Gaveta {index + 1})
        </span>
        <select
          className="select select-xs"
          value={nominalDepth}
          onChange={(e) =>
            update({
              metadata: { nominalDepth: Number(e.target.value) },
            })
          }
        >
          {depthOptions.map((depth) => (
            <option key={depth} value={depth}>
              {depth} mm
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Nome da Gaveta</span>
        <input
          className="input input-xs"
          type="text"
          placeholder={`Gaveta ${index + 1}`}
          value={drawerGroupName}
          onChange={(e) =>
            update({
              metadata: {
                drawerGroupName: e.target.value.trim() || undefined,
              },
            })
          }
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Nome da Frente Externa</span>
        <input
          className="input input-xs"
          type="text"
          placeholder="Automático (industrial)"
          value={frontPieceName}
          onChange={(e) =>
            update({
              metadata: {
                frontExtPieceName: e.target.value.trim() || undefined,
                frontPieceName: e.target.value.trim() || undefined,
              },
            })
          }
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Nome da Frente Interna</span>
        <input
          className="input input-xs"
          type="text"
          placeholder="Automático (industrial)"
          value={frontIntPieceName}
          onChange={(e) =>
            update({
              metadata: {
                frontIntPieceName: e.target.value.trim() || undefined,
              },
            })
          }
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          Altura da Frente Externa (mm)
        </span>
        <input
          className="input input-xs"
          type="number"
          min={settings.gavetaAlturaMinimaMm}
          max={settings.gavetaAlturaMaximaMm}
          placeholder={`Padrão: ${bodyHeight}`}
          value={frontHeightOverride != null && frontHeightOverride > 0 ? frontHeightOverride : ""}
          onChange={(e) =>
            update({
              metadata: {
                frontHeightMm: parseOptionalPositiveMm(e.target.value),
              },
            })
          }
        />
      </label>

      <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Material da frente</span>
        <GroupedMaterialSelect
          materials={woodMaterials}
          value={material}
          onChange={(materialId) => {
            update({
              material: materialId,
              materialId,
              metadata: { frontMaterial: materialId },
            });
            onFrontMaterialChange?.(materialId);
          }}
          selectClassName="select select-xs"
        />
      </label>

      <div className="muted-text" style={{ fontSize: 10 }}>
        {metalProfile ? (
          <>
            Caixa metálica: {metalHeightMm} mm · Frente ext.: {externalFrontHeight} mm · Frente int.:{" "}
            {internalFrontHeight} mm · Profundidade: {Math.round(nominalDepth)} mm
          </>
        ) : (
          <>
            Frente ext.: {externalFrontHeight} mm · Frente int.: {internalFrontHeight} mm · Corpo:{" "}
            {bodyHeight} mm · Profundidade: {Math.round(drawer.depth)} mm
          </>
        )}
      </div>
    </div>
  );
}

export function DrawerCustomHeightsTable({
  box,
  onHeightChange,
}: {
  box: WorkspaceBox;
  onHeightChange: (drawerId: string, height: number) => void;
}) {
  const settings = getSettings().gavetas;
  const drawers = box.drawersLayer ?? [];
  const internalHeight = Math.max(1, box.dimensoes.altura - 10);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Altura interna do módulo: {internalHeight} mm (mín. {settings.gavetaAlturaMinimaMm} / máx.{" "}
        {settings.gavetaAlturaMaximaMm} mm por gaveta)
      </div>
      <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 4 }}>Gaveta</th>
            <th style={{ textAlign: "left", padding: 4 }}>Altura (mm)</th>
          </tr>
        </thead>
        <tbody>
          {drawers.map((drawer, index) => (
            <tr key={drawer.id}>
              <td style={{ padding: 4 }}>{index + 1}</td>
              <td style={{ padding: 4 }}>
                <input
                  className="input input-xs"
                  type="number"
                  min={settings.gavetaAlturaMinimaMm}
                  max={settings.gavetaAlturaMaximaMm}
                  value={Math.round(drawer.bodyHeight ?? drawer.height)}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    onHeightChange(drawer.id, Number(e.target.value) || settings.gavetaAlturaMinimaMm)
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
