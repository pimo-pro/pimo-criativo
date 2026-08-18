import { useCallback, useState } from "react";
import { useProject } from "../context/useProject";
import { useToast } from "../context/ToastContext";
import { usePimoViewerContext } from "./usePimoViewerContext";
import { useToolbarModal } from "../context/ToolbarModalContext";
import {
  cutlistComPrecoFromBoxes,
  ferragensFromBoxes,
} from "../core/manufacturing/cutlistFromBoxes";
import { setReportCoverImage } from "../core/projectReport/reportCoverImageCache";
import {
  calcularPrecoTotalPecas,
  calcularPrecoTotalProjeto,
} from "../core/pricing/pricing";

export type SendMethod = "whatsapp" | "email" | "download";

export type SendSelections = {
  image: boolean;
  viewerSnapshot: boolean;
  projectSnapshot: boolean;
  cutlist: boolean;
  ferragens: boolean;
  precos: boolean;
};

export const defaultSendSelections: SendSelections = {
  image: true,
  viewerSnapshot: true,
  projectSnapshot: true,
  cutlist: true,
  ferragens: true,
  precos: true,
};

/**
 * Estado e lógica do envio de pacote (ex-ToolbarModals, modal "send").
 * Mantém o mesmo comportamento; `reset` alinha ao fecho send/integration.
 */
export function useSendProjectPackage() {
  const { project } = useProject();
  const { showToast } = useToast();
  const { viewerApi } = usePimoViewerContext();
  const { openModal } = useToolbarModal();

  const [photoCaptureUrl, setPhotoCaptureUrl] = useState<string | null>(null);
  const [sendMethod, setSendMethod] = useState<SendMethod>("download");
  const [sendSelections, setSendSelections] = useState<SendSelections>(defaultSendSelections);

  const reset = useCallback(() => {
    setSendMethod("download");
    setSendSelections(defaultSendSelections);
    setPhotoCaptureUrl(null);
  }, []);

  const toggleSendSelection = useCallback((key: keyof SendSelections) => {
    setSendSelections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const slugifyName = (value: string) => {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const serializeProjectState = () => {
    return JSON.parse(
      JSON.stringify(project, (_key, value) => {
        if (value instanceof Date) {
          return { __date: value.toISOString() };
        }
        return value;
      })
    );
  };

  const buildSendPackage = () => {
    const timestamp = new Date();
    const shouldCaptureViewer = sendSelections.viewerSnapshot || sendSelections.projectSnapshot;
    const viewerSnapshot = shouldCaptureViewer ? null : null;
    const payload: Record<string, unknown> = {};

    if (sendSelections.viewerSnapshot) {
      payload.viewerSnapshot = viewerSnapshot;
    }

    if (sendSelections.projectSnapshot) {
      payload.projectSnapshot = {
        projectState: serializeProjectState(),
        viewerSnapshot,
      };
    }

    if (sendSelections.image) {
      payload.imagem = photoCaptureUrl ?? null;
    }

    const boxes = project.boxes ?? [];
    const cutlistFromBoxes = cutlistComPrecoFromBoxes(
      boxes,
      project.rules,
      project.materialId,
      project.projectName
    );
    const ferragensFromBoxesList = ferragensFromBoxes(boxes, project.rules);
    const totalPecasFromBoxes =
      cutlistFromBoxes.length > 0 ? calcularPrecoTotalPecas(cutlistFromBoxes) : null;
    const totalAcessoriosFromBoxes =
      ferragensFromBoxesList.length > 0
        ? ferragensFromBoxesList.reduce((s, a) => s + a.precoTotal, 0)
        : null;
    const totalProjetoFromBoxes =
      totalPecasFromBoxes != null && totalAcessoriosFromBoxes != null
        ? calcularPrecoTotalProjeto(totalPecasFromBoxes + totalAcessoriosFromBoxes)
        : null;

    if (sendSelections.cutlist) {
      payload.cutlist = cutlistFromBoxes.length > 0 ? cutlistFromBoxes : null;
    }

    if (sendSelections.ferragens) {
      payload.ferragens = ferragensFromBoxesList.length > 0 ? ferragensFromBoxesList : null;
    }

    if (sendSelections.precos) {
      payload.precos = {
        cutListComPreco: cutlistFromBoxes.length > 0 ? cutlistFromBoxes : null,
        acessorios: ferragensFromBoxesList.length > 0 ? ferragensFromBoxesList : null,
        totalPecas: totalPecasFromBoxes,
        totalAcessorios: totalAcessoriosFromBoxes,
        totalProjeto: totalProjetoFromBoxes,
      };
    }

    return {
      meta: {
        createdAt: timestamp.toISOString(),
        projectName: project.projectName,
        version: "fase-6-g",
      },
      payload,
    };
  };

  const downloadSendPackage = () => {
    const pacote = buildSendPackage();
    const projectSlug = slugifyName(project.projectName || "projeto");
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `pimo-envio-${projectSlug || "projeto"}-${timestamp}.json`;
    const blob = new Blob([JSON.stringify(pacote, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const handleSendPackage = () => {
    if (sendMethod === "download") {
      downloadSendPackage();
      return;
    }
    const channelLabel = sendMethod === "whatsapp" ? "WhatsApp" : "Email";
    openModal("integration", {
      integrationMessage: `Integração ${channelLabel} em desenvolvimento.`,
    });
  };

  const captureImageForSend = useCallback(async () => {
    if (!viewerApi?.renderScene) {
      showToast("Renderizador indisponível para captura.", "warning");
      return;
    }
    try {
      const result = await viewerApi.renderScene({
        size: "4k",
        preset: "current",
        background: "white",
        mode: "pbr",
        watermark: false,
        shadowIntensity: 1,
        format: "png",
        quality: 1,
        advancedRealism: true,
      });
      if (result?.dataUrl) {
        setPhotoCaptureUrl(result.dataUrl);
        [project.currentProjectId, project.projectName].forEach((key) => {
          if (key) setReportCoverImage(String(key), result.dataUrl);
        });
        showToast("Captura pronta para envio.", "info", 1400);
      } else {
        showToast("Não foi possível capturar a imagem do Viewer.", "warning");
      }
    } catch {
      showToast("Erro ao gerar imagem para envio.", "error");
    }
  }, [viewerApi, showToast, project.currentProjectId, project.projectName]);

  return {
    sendMethod,
    setSendMethod,
    sendSelections,
    toggleSendSelection,
    photoCaptureUrl,
    setPhotoCaptureUrl,
    reset,
    buildSendPackage,
    downloadSendPackage,
    handleSendPackage,
    captureImageForSend,
  };
}
