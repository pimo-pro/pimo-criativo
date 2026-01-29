import { useCallback, useMemo, useState } from "react";
import { PimoViewerContext } from "./PimoViewerContextCore";
import type { PimoViewerApi } from "./PimoViewerContextCore";

export const PimoViewerProvider = ({ children }: { children: React.ReactNode }) => {
  const [viewerApi, setViewerApi] = useState<PimoViewerApi | null>(null);

  const registerViewerApi = useCallback((api: PimoViewerApi | null) => {
    setViewerApi((prev) => {
      if (api === null) return null;
      if (prev !== null) return prev;
      return api;
    });
  }, []);

  const value = useMemo(() => ({ viewerApi, registerViewerApi }), [viewerApi, registerViewerApi]);

  return <PimoViewerContext.Provider value={value}>{children}</PimoViewerContext.Provider>;
};
