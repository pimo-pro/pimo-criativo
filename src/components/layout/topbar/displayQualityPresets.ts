import type {
  UltraPerformanceModeOptions,
  ViewerMaterialQuality,
  ViewerSettings,
} from "../../../context/projectTypes";

export type DisplayQualityLevel = "baixa" | "media" | "alta";

export type DisplayQualitySettingsPatch = Pick<
  ViewerSettings,
  | "materialQuality"
  | "enableReflections"
  | "ultraPerformanceModeOptions"
  | "matteMode"
  | "glossIntensity"
  | "globalLightIntensity"
  | "shadowIntensity"
>;

export type DisplayQualityViewerApi = {
  setUltraPerformanceModeOptions?: (_options: UltraPerformanceModeOptions) => void;
  setUltraPerformanceMode?: (_active: boolean) => void;
  setMaterialQuality?: (_quality: ViewerMaterialQuality) => void;
  setReflectionsEnabled?: (_enabled: boolean) => void;
  setShowcaseMode?: (_active: boolean, _turntable?: boolean) => void;
  setGlobalLightIntensity?: (_value: number) => void;
  setShadowIntensity?: (_value: number) => void;
  setGlossIntensity?: (_value: number) => void;
  setMatteMode?: (_enabled: boolean) => void;
};

const ULTRA_OFF: UltraPerformanceModeOptions = {
  enabled: false,
  mode: "balanced",
};

const LIGHTS_RESET = {
  ultraPerformanceModeOptions: ULTRA_OFF,
  matteMode: false,
  glossIntensity: 1,
  globalLightIntensity: 1,
  shadowIntensity: 1,
} as const;

/**
 * Mapeia Baixa / Média / Alta para campos já existentes em viewerSettings.
 * Não adiciona campos novos ao ProjectState.
 *
 * Baixa — luz simples, sem efeitos (performance, sem reflexos).
 * Média — bloom leve via showcase; persistido com materialQuality premium.
 * Alta — bloom contido, reflexos, luz global mais forte e materiais premium.
 * Ultra fica fora deste painel (só Photo Mode).
 */
export function buildDisplayQualitySettingsPatch(level: DisplayQualityLevel): DisplayQualitySettingsPatch {
  switch (level) {
    case "baixa":
      return {
        ...LIGHTS_RESET,
        materialQuality: "standard",
        enableReflections: false,
        // "Sem efeitos" = sem bloom/reflexos/material premium; luz e sombra
        // ficam iguais a "Média" (não deve haver imagem mais escura em Baixa).
        globalLightIntensity: 1.0,
        shadowIntensity: 0.82,
      };
    case "media":
      return {
        ...LIGHTS_RESET,
        materialQuality: "premium",
        enableReflections: false,
        // Equilíbrio: luz neutra + sombras presentes mas suaves.
        globalLightIntensity: 1.0,
        shadowIntensity: 0.82,
      };
    case "alta":
      return {
        ...LIGHTS_RESET,
        materialQuality: "premium",
        enableReflections: true,
        // Reduz overexposure face a reflexos + bloom; compensado por tone mapping e bloom no Composer.
        globalLightIntensity: 1.06,
        shadowIntensity: 0.9,
        glossIntensity: 1,
      };
  }
}

export function shouldEnableShowcaseForQualitySettings(
  settings: Pick<ViewerSettings, "materialQuality" | "enableReflections">
): boolean {
  return (
    settings.materialQuality === "premium" ||
    settings.materialQuality === "lacquered" ||
    settings.enableReflections
  );
}

export function resolveDisplayQualityLevel(
  settings: Pick<ViewerSettings, "materialQuality" | "enableReflections">
): DisplayQualityLevel {
  if (settings.enableReflections) return "alta";
  if (settings.materialQuality === "premium" || settings.materialQuality === "lacquered") {
    return "media";
  }
  return "baixa";
}

export function applyDisplayQualityPresetToViewer(
  viewerApi: DisplayQualityViewerApi | null | undefined,
  level: DisplayQualityLevel
): void {
  const patch = buildDisplayQualitySettingsPatch(level);
  viewerApi?.setUltraPerformanceModeOptions?.(patch.ultraPerformanceModeOptions);
  viewerApi?.setUltraPerformanceMode?.(false);
  viewerApi?.setMaterialQuality?.(patch.materialQuality);
  viewerApi?.setReflectionsEnabled?.(patch.enableReflections);
  viewerApi?.setShowcaseMode?.(shouldEnableShowcaseForQualitySettings(patch), false);
  viewerApi?.setGlobalLightIntensity?.(patch.globalLightIntensity);
  viewerApi?.setShadowIntensity?.(patch.shadowIntensity);
  viewerApi?.setGlossIntensity?.(patch.glossIntensity);
  viewerApi?.setMatteMode?.(patch.matteMode);
}
