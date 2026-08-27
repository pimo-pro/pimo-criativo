import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

import {
  ensureProjectThumbnailUploaded,
  projectThumbnailExists,
} from "@/core/projects/projectThumbnail";
import { canUseRemoteProjectsApi } from "@/core/projects/remoteApiAuth";

type Props = {
  projectName: string;
  enabled: boolean;
};

/**
 * Gera thumbnail no servidor na primeira abertura do viewer PROJETOS (modo projecto).
 */
export default function ShowroomThumbnailCapture({ projectName, enabled }: Props) {
  const { gl, scene, camera } = useThree();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!enabled || startedRef.current) return;
    if (!canUseRemoteProjectsApi()) return;
    const name = projectName.trim();
    if (!name) return;

    let cancelled = false;
    startedRef.current = true;

    const run = async () => {
      try {
        if (await projectThumbnailExists(name).then((r) => r.exists)) return;

        await new Promise<void>((resolve) => {
          window.setTimeout(resolve, 1600);
        });
        if (cancelled) return;

        gl.render(scene, camera);
        const blob = await new Promise<Blob | null>((resolve) => {
          gl.domElement.toBlob((value) => resolve(value), "image/jpeg", 0.88);
        });
        if (!blob || cancelled) return;

        await ensureProjectThumbnailUploaded(name, blob);
      } catch {
        /* falha silenciosa — fallback visual mantém placeholder */
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [camera, enabled, gl, projectName, scene]);

  return null;
}
