import { useCallback, useEffect, useState } from 'react';
import * as THREE from 'three';

import { useToast } from '@/context/ToastContext';
import { updatePieceTransform, updatePieceRemates, logPieceEventAction } from '@/industrial/api/pieceActions';
import { notifyUser } from '@/industrial/errors/industrialNotificationBridge';
import { isIndustrialPersistBlocked } from '@/industrial/persistence/shared/industrialPersistResult';

import type { EntityTransform, PieceSelectableType, PieceToolMode, PieceTransformMap } from '../types';

const BLOCKED_PERSIST_MESSAGE =
  'Gravação industrial bloqueada (writes Supabase desligados). A posição local não foi sincronizada.';

const SNAP_STEP = 0.01;

function snapValue(value: number, step = SNAP_STEP): number {
  return Math.round(value / step) * step;
}

function snapTransform(transform: EntityTransform, enableSnap: boolean): EntityTransform {
  if (!enableSnap) return transform;
  return {
    position: [
      snapValue(transform.position[0]),
      Math.max(0, snapValue(transform.position[1])),
      snapValue(transform.position[2]),
    ],
    rotation: [
      snapValue(transform.rotation[0], Math.PI / 12),
      snapValue(transform.rotation[1], Math.PI / 12),
      snapValue(transform.rotation[2], Math.PI / 12),
    ],
  };
}

function defaultTransform(): EntityTransform {
  return { position: [0, 0, 0], rotation: [0, 0, 0] };
}

interface UsePieceTransformOptions {
  pieceId?: string;
  selectedType?: PieceSelectableType | null;
  workOrderId?: string;
  userId?: string;
  initialTransforms?: PieceTransformMap;
  onPersisted?: () => void;
}

export function usePieceTransform(
  selectedId: string | null,
  options: UsePieceTransformOptions = {},
) {
  const {
    pieceId,
    selectedType,
    workOrderId,
    userId,
    initialTransforms = {},
    onPersisted,
  } = options;

  const { showToast } = useToast();
  const [transforms, setTransforms] = useState<PieceTransformMap>(initialTransforms);
  const [toolMode, setToolMode] = useState<PieceToolMode>('select');
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [persisting, setPersisting] = useState(false);

  useEffect(() => {
    setTransforms(initialTransforms);
  }, [initialTransforms, pieceId]);

  const notifyPersistBlocked = useCallback(() => {
    notifyUser(
      {
        source: 'trak',
        severity: 'warning',
        step: 'Persistência peça',
        message: BLOCKED_PERSIST_MESSAGE,
        pieceId,
      },
      { showToast },
    );
  }, [pieceId, showToast]);

  const persistTransform = useCallback(
    async (entityId: string, transform: EntityTransform, eventType: 'piece_moved' | 'piece_rotated') => {
      if (!pieceId || !selectedType) return;
      setPersisting(true);
      try {
        const transformResult = await updatePieceTransform(pieceId, {
          entityId,
          entityType: selectedType,
          position: transform.position,
          rotation: transform.rotation,
        });
        if (!transformResult.ok) {
          if (isIndustrialPersistBlocked(transformResult)) notifyPersistBlocked();
          return;
        }

        if (selectedType === 'remate' || selectedType === 'rodape') {
          const rematesResult = await updatePieceRemates(pieceId, {
            entity: {
              entityId,
              entityType: selectedType,
              payload: {
                position: transform.position,
                rotation: transform.rotation,
              },
            },
          });
          if (!rematesResult.ok) {
            if (isIndustrialPersistBlocked(rematesResult)) notifyPersistBlocked();
            return;
          }
        }

        const eventResult = await logPieceEventAction(pieceId, {
          type: eventType,
          workOrderId,
          userId,
          metadata: {
            entity_id: entityId,
            entity_type: selectedType,
            position: transform.position,
            rotation: transform.rotation,
          },
        });
        if (!eventResult.ok) {
          if (isIndustrialPersistBlocked(eventResult)) notifyPersistBlocked();
          return;
        }
        onPersisted?.();
      } finally {
        setPersisting(false);
      }
    },
    [notifyPersistBlocked, onPersisted, pieceId, selectedType, userId, workOrderId],
  );

  const getTransform = useCallback(
    (id: string, base?: EntityTransform): EntityTransform => {
      return transforms[id] ?? base ?? defaultTransform();
    },
    [transforms],
  );

  const setTransform = useCallback(
    (id: string, next: EntityTransform) => {
      setTransforms((prev) => ({
        ...prev,
        [id]: snapTransform(next, snapEnabled),
      }));
    },
    [snapEnabled],
  );

  const savePosition = useCallback(async () => {
    if (!selectedId) return;
    const transform = transforms[selectedId] ?? defaultTransform();
    await persistTransform(selectedId, transform, 'piece_moved');
  }, [persistTransform, selectedId, transforms]);

  const saveRotation = useCallback(async () => {
    if (!selectedId) return;
    const transform = transforms[selectedId] ?? defaultTransform();
    await persistTransform(selectedId, transform, 'piece_rotated');
  }, [persistTransform, selectedId, transforms]);

  const nudgeSelected = useCallback(
    (delta: Partial<{ x: number; y: number; z: number; ry: number }>) => {
      if (!selectedId) return;
      setTransforms((prev) => {
        const current = prev[selectedId] ?? defaultTransform();
        const next: EntityTransform = {
          position: [
            current.position[0] + (delta.x ?? 0),
            current.position[1] + (delta.y ?? 0),
            current.position[2] + (delta.z ?? 0),
          ],
          rotation: [
            current.rotation[0],
            current.rotation[1] + (delta.ry ?? 0),
            current.rotation[2],
          ],
        };
        return { ...prev, [selectedId]: snapTransform(next, snapEnabled) };
      });
    },
    [selectedId, snapEnabled],
  );

  const resetSelected = useCallback(() => {
    if (!selectedId) return;
    setTransforms((prev) => {
      const copy = { ...prev };
      delete copy[selectedId];
      return copy;
    });
  }, [selectedId]);

  const applyMatrix = useCallback(
    (id: string, matrix: THREE.Matrix4) => {
      const position = new THREE.Vector3();
      const quaternion = new THREE.Quaternion();
      const scale = new THREE.Vector3();
      matrix.decompose(position, quaternion, scale);
      const euler = new THREE.Euler().setFromQuaternion(quaternion, 'XYZ');
      const next: EntityTransform = {
        position: [position.x, position.y, position.z],
        rotation: [euler.x, euler.y, euler.z],
      };
      const snapped = snapTransform(next, snapEnabled);
      setTransforms((prev) => ({ ...prev, [id]: snapped }));
      void persistTransform(id, snapped, toolMode === 'rotate' ? 'piece_rotated' : 'piece_moved');
    },
    [persistTransform, snapEnabled, toolMode],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      const step = event.shiftKey ? 0.05 : 0.01;
      const rotStep = event.shiftKey ? Math.PI / 8 : Math.PI / 16;

      if (event.key === 'm' || event.key === 'M') setToolMode('move');
      if (event.key === 'r' || event.key === 'R') setToolMode('rotate');
      if (event.key === 's' || event.key === 'S') setToolMode('select');
      if (event.key === 'g' || event.key === 'G') setSnapEnabled((value) => !value);
      if (event.key === 'Enter' && event.ctrlKey) {
        void savePosition();
      }

      if (!selectedId) return;

      if (event.key === 'ArrowLeft') nudgeSelected({ x: -step });
      if (event.key === 'ArrowRight') nudgeSelected({ x: step });
      if (event.key === 'ArrowUp') nudgeSelected({ z: -step });
      if (event.key === 'ArrowDown') nudgeSelected({ z: step });
      if (event.key === 'PageUp') nudgeSelected({ y: step });
      if (event.key === 'PageDown') nudgeSelected({ y: -step });
      if (event.key === 'q' || event.key === 'Q') nudgeSelected({ ry: rotStep });
      if (event.key === 'e' || event.key === 'E') nudgeSelected({ ry: -rotStep });
      if (event.key === 'Delete' || event.key === 'Backspace') resetSelected();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nudgeSelected, resetSelected, savePosition, selectedId]);

  return {
    transforms,
    toolMode,
    snapEnabled,
    persisting,
    setToolMode,
    setSnapEnabled,
    getTransform,
    setTransform,
    applyMatrix,
    resetSelected,
    nudgeSelected,
    savePosition,
    saveRotation,
  };
}
