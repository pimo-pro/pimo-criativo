import { useCallback, useRef, useState } from "react";
import type { BoxOptions } from "../3d/objects/BoxBuilder";

type BoxDimensions = { width?: number; height?: number; depth?: number; index?: number };

type AcoesMultiBoxProps = {
  selectedBoxId: string | null;
  addBox: (id: string, options?: BoxOptions) => boolean;
  removeBox: (id: string) => boolean;
  updateBox: (id: string, options: Partial<BoxOptions>) => boolean;
  setBoxIndex: (id: string, index: number) => boolean;
  setBoxGap: (gap: number) => void;
  addModelToBox: (boxId: string, path: string) => boolean;
  removeModelFromBox: (boxId: string, modelId: string) => boolean;
  listModels: (boxId: string) => Array<{ id: string; path: string }> | null;
};

export default function AcoesMultiBox({
  selectedBoxId,
  addBox,
  removeBox,
  updateBox,
  setBoxIndex,
  setBoxGap,
  addModelToBox,
  removeModelFromBox,
  listModels,
}: AcoesMultiBoxProps) {
  const [gap, setGap] = useState(0);
  const boxDimensionsRef = useRef<Record<string, BoxDimensions>>({});
  const nextIndexRef = useRef(0);

  const handleAddBox = useCallback(() => {
    const id = `modulo-${Date.now()}`;
    const index = nextIndexRef.current;
    nextIndexRef.current += 1;
    addBox(id, { index });
    boxDimensionsRef.current[id] = { index };
  }, [addBox]);

  const handleRemoveBox = useCallback(() => {
    if (!selectedBoxId) return;
    removeBox(selectedBoxId);
  }, [removeBox, selectedBoxId]);

  const handleDuplicateBox = useCallback(() => {
    if (!selectedBoxId) return;
    updateBox(selectedBoxId, {});
    const dims = boxDimensionsRef.current[selectedBoxId];
    const options = dims ? { ...dims } : undefined;
    const id = `modulo-${Date.now()}`;
    const index = nextIndexRef.current;
    nextIndexRef.current += 1;
    addBox(id, { ...options, index });
    boxDimensionsRef.current[id] = { ...dims, index };
  }, [addBox, selectedBoxId, updateBox]);

  const handleMoveUp = useCallback(() => {
    if (!selectedBoxId) return;
    const current = boxDimensionsRef.current[selectedBoxId]?.index ?? 0;
    const nextIndex = Math.max(0, current - 1);
    const ok = setBoxIndex(selectedBoxId, nextIndex);
    if (ok) {
      const prev = boxDimensionsRef.current[selectedBoxId] ?? {};
      boxDimensionsRef.current[selectedBoxId] = { ...prev, index: nextIndex };
    }
  }, [selectedBoxId, setBoxIndex]);

  const handleMoveDown = useCallback(() => {
    if (!selectedBoxId) return;
    const current = boxDimensionsRef.current[selectedBoxId]?.index ?? 0;
    const nextIndex = current + 1;
    const ok = setBoxIndex(selectedBoxId, nextIndex);
    if (ok) {
      const prev = boxDimensionsRef.current[selectedBoxId] ?? {};
      boxDimensionsRef.current[selectedBoxId] = { ...prev, index: nextIndex };
    }
  }, [selectedBoxId, setBoxIndex]);

  const handleAddModel = useCallback(() => {
    if (!selectedBoxId) return;
    addModelToBox(selectedBoxId, "/models/prateleira.glb");
  }, [addModelToBox, selectedBoxId]);

  const handleRemoveModel = useCallback(() => {
    if (!selectedBoxId) return;
    const models = listModels(selectedBoxId);
    if (models?.length) {
      removeModelFromBox(selectedBoxId, models[0].id);
    }
  }, [listModels, removeModelFromBox, selectedBoxId]);

  const handleGapPlus = useCallback(() => {
    const nextGap = gap + 1;
    setGap(nextGap);
    setBoxGap(nextGap);
  }, [gap, setBoxGap]);

  const handleGapMinus = useCallback(() => {
    const nextGap = gap - 1;
    setGap(nextGap);
    setBoxGap(nextGap);
  }, [gap, setBoxGap]);

  return (
    <div>
      <button type="button" onClick={handleAddBox}>
        Adicionar Caixa
      </button>
      <button type="button" onClick={handleRemoveBox}>
        Remover Caixa
      </button>
      <button type="button" onClick={handleDuplicateBox}>
        Duplicar Caixa
      </button>
      <button type="button" onClick={handleMoveUp}>
        Mover para Cima
      </button>
      <button type="button" onClick={handleMoveDown}>
        Mover para Baixo
      </button>
      <button type="button" onClick={handleAddModel}>
        Adicionar Modelo
      </button>
      <button type="button" onClick={handleRemoveModel}>
        Remover Modelo
      </button>
      <button type="button" onClick={handleGapPlus}>
        Gap +
      </button>
      <button type="button" onClick={handleGapMinus}>
        Gap -
      </button>
    </div>
  );
}
