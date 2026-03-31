import { useState, useCallback, useRef } from "react";

export interface UseSelectionReturn {
  /** Set of currently selected image paths */
  selectedPaths: Set<string>;
  /**
   * Handle a click on a selectable item.
   * @param paths - The image paths this item represents (one for single images, many for burst groups)
   * @param flatIndex - The index of this item in the flat visible list (for Shift+click range select)
   * @param event - The mouse event (for detecting Cmd/Shift modifiers)
   */
  handleItemClick: (
    paths: string[],
    flatIndex: number,
    event: React.MouseEvent
  ) => void;
  /** Select all provided paths */
  selectAll: (allPaths: string[]) => void;
  /** Clear all selection */
  clearSelection: () => void;
  /** Check if a specific path is selected */
  isSelected: (path: string) => boolean;
  /** Check if any item in the given paths array is selected (for burst group cards) */
  isAnySelected: (paths: string[]) => boolean;
  /** Whether there is any selection */
  hasSelection: boolean;
  /** Number of selected paths */
  selectedCount: number;
  /** Set selected paths directly (used by marquee selection) */
  setSelectedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  /** The flat list used for range selection -- must be set by the consumer */
  setFlatList: (list: string[][]) => void;
}

/**
 * Hook for managing multi-select state with standard macOS selection behaviors:
 * - Click: select single item (clear previous)
 * - Cmd+Click: toggle item in/out of selection
 * - Shift+Click: range select from last clicked to current
 */
export function useSelection(): UseSelectionReturn {
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  /** Index of the last clicked item (anchor for Shift+click range) */
  const lastClickedIndex = useRef<number>(-1);
  /** The flat list of path groups for range selection */
  const flatListRef = useRef<string[][]>([]);

  const setFlatList = useCallback((list: string[][]) => {
    flatListRef.current = list;
  }, []);

  const handleItemClick = useCallback(
    (paths: string[], flatIndex: number, event: React.MouseEvent) => {
      const isMeta = event.metaKey || event.ctrlKey;
      const isShift = event.shiftKey;
      const isAlreadySelected = paths.every((p) => selectedPaths.has(p));

      if (isShift && !isMeta && isAlreadySelected) {
        const newSet = new Set(selectedPaths);
        for (const p of paths) {
          newSet.delete(p);
        }
        setSelectedPaths(newSet);
        lastClickedIndex.current = flatIndex;
        return;
      }

      if (isShift && lastClickedIndex.current >= 0) {
        // Range select: from lastClickedIndex to flatIndex
        const start = Math.min(lastClickedIndex.current, flatIndex);
        const end = Math.max(lastClickedIndex.current, flatIndex);
        const newSet = isMeta ? new Set(selectedPaths) : new Set<string>();

        for (let i = start; i <= end; i++) {
          const itemPaths = flatListRef.current[i];
          if (itemPaths) {
            for (const p of itemPaths) {
              newSet.add(p);
            }
          }
        }
        setSelectedPaths(newSet);
        // Don't update lastClickedIndex on shift-click -- keep the anchor
      } else if (isMeta) {
        // Toggle: add or remove this item
        const newSet = new Set(selectedPaths);
        const allSelected = paths.every((p) => newSet.has(p));
        if (allSelected) {
          for (const p of paths) newSet.delete(p);
        } else {
          for (const p of paths) newSet.add(p);
        }
        setSelectedPaths(newSet);
        lastClickedIndex.current = flatIndex;
      } else {
        // Simple click: select only this item
        setSelectedPaths(new Set(paths));
        lastClickedIndex.current = flatIndex;
      }
    },
    [selectedPaths]
  );

  const selectAll = useCallback((allPaths: string[]) => {
    setSelectedPaths(new Set(allPaths));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
    lastClickedIndex.current = -1;
  }, []);

  const isSelected = useCallback(
    (path: string) => selectedPaths.has(path),
    [selectedPaths]
  );

  const isAnySelected = useCallback(
    (paths: string[]) => paths.some((p) => selectedPaths.has(p)),
    [selectedPaths]
  );

  return {
    selectedPaths,
    handleItemClick,
    selectAll,
    clearSelection,
    isSelected,
    isAnySelected,
    hasSelection: selectedPaths.size > 0,
    selectedCount: selectedPaths.size,
    setSelectedPaths,
    setFlatList,
  };
}
