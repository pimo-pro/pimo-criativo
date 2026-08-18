/**
 * SelectionEngine (Z-01.2.7 B) — marquee, outlines multi e alinhamento.
 */
import type { AlignmentType, AlignableObject } from "../commands/alignmentCommands";
import { applyAlignment } from "../commands/alignmentCommands";

export type SelectionEngineDeps = {
  syncMultiOutlines: (_encodedIds: string[]) => void;
  setGroupMemberIds: (_ids: string[]) => void;
  clearGroupMemberIds: () => void;
  refreshGizmo: () => void;
  getSelectedObjects: (_multiBoxIds?: string[]) => AlignableObject[];
  notifyAligned: (_obj: AlignableObject) => void;
};

export class SelectionEngine {
  private readonly deps: SelectionEngineDeps;

  constructor(deps: SelectionEngineDeps) {
    this.deps = deps;
  }

  setMultiSelectionOutlines(encodedIds: string[]): void {
    this.deps.syncMultiOutlines(encodedIds);
  }

  setGroupTransformMembers(encodedIds: string[]): void {
    this.deps.setGroupMemberIds(encodedIds);
    this.deps.refreshGizmo();
  }

  clearGroupTransformMembers(): void {
    this.deps.clearGroupMemberIds();
    this.deps.refreshGizmo();
  }

  align(type: AlignmentType, multiBoxIds?: string[]): boolean {
    const selected = this.deps.getSelectedObjects(multiBoxIds);
    const applied = applyAlignment(type, selected);
    if (!applied) return false;
    for (let i = 1; i < selected.length; i += 1) {
      this.deps.notifyAligned(selected[i]!);
    }
    this.deps.refreshGizmo();
    return true;
  }
}
