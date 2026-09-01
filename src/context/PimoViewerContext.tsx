import { useCallback, useMemo, useRef, useState } from "react";
import { PimoViewerContext } from "./PimoViewerContextCore";
import type { PimoViewerApi } from "./PimoViewerContextCore";
import { getPimoViewerStubApi } from "./pimoViewerStubApi";
import { setActivePimoViewerApi } from "../core/viewer/pimoViewerRuntime";

const VIEWER_STUB_API = getPimoViewerStubApi();

export const PimoViewerProvider = ({ children }: { children: React.ReactNode }) => {
  const [viewerApi, setViewerApi] = useState<PimoViewerApi>(VIEWER_STUB_API);
  const registeredApiRef = useRef<PimoViewerApi | null>(null);

  const registerViewerApi = useCallback((api: PimoViewerApi | null) => {
    if (api === null) {
      registeredApiRef.current = null;
      setActivePimoViewerApi(null);
      setViewerApi(VIEWER_STUB_API);
      return;
    }
    const safeApi = api ?? VIEWER_STUB_API;
    if (registeredApiRef.current === safeApi) return;
    registeredApiRef.current = safeApi;
    setActivePimoViewerApi(safeApi);
    setViewerApi(safeApi);
  }, []);

  const value = useMemo(
    () => ({
      viewerApi,
      registerViewerApi,
    }),
    [viewerApi, registerViewerApi]
  );

  return <PimoViewerContext.Provider value={value}>{children}</PimoViewerContext.Provider>;
};
