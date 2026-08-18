import { useCallback, useMemo, useRef, useState } from "react";
import { PimoViewerContext } from "./PimoViewerContextCore";
import type { PimoViewerApi } from "./PimoViewerContextCore";
import { getPimoViewerStubApi } from "./pimoViewerStubApi";
import { setActivePimoViewerApi } from "../core/viewer/pimoViewerRuntime";

export const PimoViewerProvider = ({ children }: { children: React.ReactNode }) => {
  const stubApiRef = useRef(getPimoViewerStubApi());
  const [viewerApi, setViewerApi] = useState<PimoViewerApi>(stubApiRef.current);
  const registeredApiRef = useRef<PimoViewerApi | null>(null);

  const registerViewerApi = useCallback((api: PimoViewerApi | null) => {
    if (api === null) {
      registeredApiRef.current = null;
      setActivePimoViewerApi(null);
      setViewerApi(stubApiRef.current);
      return;
    }
    const safeApi = api ?? stubApiRef.current;
    if (registeredApiRef.current === safeApi) return;
    registeredApiRef.current = safeApi;
    setActivePimoViewerApi(safeApi);
    setViewerApi(safeApi);
  }, []);

  const value = useMemo(
    () => ({
      viewerApi: viewerApi ?? stubApiRef.current,
      registerViewerApi,
    }),
    [viewerApi, registerViewerApi]
  );

  return <PimoViewerContext.Provider value={value}>{children}</PimoViewerContext.Provider>;
};
