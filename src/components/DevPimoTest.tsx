import { useEffect, useRef } from "react";
import { usePimoViewer } from "../hooks/usePimoViewer";

export default function DevPimoTest() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const {
    addBox,
    removeBox,
    updateBox,
    setBoxIndex,
    setBoxGap,
    addModelToBox,
    removeModelFromBox,
    listModels,
  } = usePimoViewer(containerRef);

  useEffect(() => {
    // 1) Criar duas caixas
    addBox("modulo-1", { width: 60, height: 80, depth: 50 });
    addBox("modulo-2", { width: 40, height: 60, depth: 50 });

    // 2) Atualizar dimensões da primeira caixa
    updateBox("modulo-1", { width: 70 });

    // 3) Reordenar caixas
    setBoxIndex("modulo-2", 0);

    // 4) Adicionar um modelo 3D dentro da primeira caixa
    addModelToBox("modulo-1", "/models/prateleira.glb");

    // 5) Alterar gap
    setBoxGap(5);

    // 6) Listar modelos da primeira caixa no console
    console.log("Models modulo-1:", listModels("modulo-1"));

    // 7) Remover o modelo
    const models = listModels("modulo-1");
    if (models?.length) {
      removeModelFromBox("modulo-1", models[0].id);
    }

    // 8) Remover a segunda caixa
    removeBox("modulo-2");
  }, [
    addBox,
    removeBox,
    updateBox,
    setBoxIndex,
    setBoxGap,
    addModelToBox,
    removeModelFromBox,
    listModels,
  ]);

  return <div ref={containerRef} style={{ width: "100%", height: "100%" }} />;
}
