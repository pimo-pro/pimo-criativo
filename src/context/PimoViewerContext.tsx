import { useCallback, useMemo, useRef, useState } from "react";
import { PimoViewerContext } from "./PimoViewerContextCore";
import type { PimoViewerApi } from "./PimoViewerContextCore";

export const PimoViewerProvider = ({ children }: { children: React.ReactNode }) => {
  const [viewerApi, setViewerApi] = useState<PimoViewerApi | null>(null);
  const registeredApiRef = useRef<PimoViewerApi | null>(null);

  const registerViewerApi = useCallback((api: PimoViewerApi | null) => {
    if (api === null) {
      registeredApiRef.current = null;
      setViewerApi(null);
      return;
    }
    if (registeredApiRef.current === api) return;
    registeredApiRef.current = api;
    setViewerApi(api);
  }, []);

  const value = useMemo(() => ({ viewerApi, registerViewerApi }), [viewerApi, registerViewerApi]);

  return <PimoViewerContext.Provider value={value}>{children}</PimoViewerContext.Provider>;
};
