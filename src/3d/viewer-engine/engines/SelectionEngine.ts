import type { AlignableObject } from "../commands/alignmentCommands";
import { SelectionEngine, type SelectionEngineDeps } from "../selection/SelectionEngine";

type MultiSelectionOutlineLike = {
  sync: (encodedIds: string[], resolve: (encodedId: string) => unknown) => void;
} | null | undefined;

export type CreateViewerSelectionEngineArgs = {
  multiSelectionOutline: MultiSelectionOutlineLike;
  resolveMultiOutlineTarget: (encodedId: string) => unknown;
  setGroupMemberIds: SelectionEngineDeps["setGroupMemberIds"];
  clearGroupMemberIds: SelectionEngineDeps["clearGroupMemberIds"];
  refreshGizmo: SelectionEngineDeps["refreshGizmo"];
  getSelectedObjects: SelectionEngineDeps["getSelectedObjects"];
  notifyAligned: SelectionEngineDeps["notifyAligned"];
};

export function createViewerSelectionEngine(args: CreateViewerSelectionEngineArgs): SelectionEngine {
  return new SelectionEngine({
    syncMultiOutlines: (encodedIds) =>
      args.multiSelectionOutline?.sync(encodedIds, (encoded) => args.resolveMultiOutlineTarget(encoded)),
    setGroupMemberIds: args.setGroupMemberIds,
    clearGroupMemberIds: args.clearGroupMemberIds,
    refreshGizmo: args.refreshGizmo,
    getSelectedObjects: (multiBoxIds) => args.getSelectedObjects(multiBoxIds) as AlignableObject[],
    notifyAligned: args.notifyAligned,
  });
}
