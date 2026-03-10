import { useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { startDrag } from "@crabnebula/tauri-plugin-drag";

const DRAG_THRESHOLD = 5; // px movement before initiating native drag

interface UseDragOutOptions {
  /** The set of currently selected file paths */
  selectedPaths: Set<string>;
  /** Whether drag-out is enabled */
  enabled?: boolean;
}

export interface UseDragOutReturn {
  /**
   * Call on mousedown on a selected tile.
   * Stores the start position. The actual drag is triggered on mousemove
   * if the mouse moves beyond the threshold.
   */
  handleDragMouseDown: (event: React.MouseEvent) => void;
  /** Whether a drag operation is currently in flight */
  isDragging: boolean;
}

/**
 * Hook for initiating native OS file drag-out of selected images.
 * Uses tauri-plugin-drag to pass absolute file paths to the OS,
 * so the receiving app reads directly from the filesystem -- no copying.
 */
export function useDragOut({
  selectedPaths,
  enabled = true,
}: UseDragOutOptions): UseDragOutReturn {
  const isDragging = useRef(false);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  const initiateNativeDrag = useCallback(async () => {
    if (selectedPaths.size === 0) return;

    isDragging.current = true;
    const paths = Array.from(selectedPaths);

    try {
      // Use the first selected image's thumbnail as the drag preview icon
      const previewPath = await invoke<string>("generate_thumbnail", {
        sourcePath: paths[0],
        size: 100,
      });

      await startDrag(
        {
          item: paths,
          icon: previewPath,
        },
        (_result) => {
          isDragging.current = false;
        }
      );
    } catch (err) {
      console.error("Native drag failed:", err);
      isDragging.current = false;
    }
  }, [selectedPaths]);

  const handleDragMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!enabled || selectedPaths.size === 0) return;
      if (event.button !== 0) return;

      dragStartPos.current = { x: event.clientX, y: event.clientY };

      const handleMouseMove = (e: MouseEvent) => {
        if (!dragStartPos.current) return;

        const dx = e.clientX - dragStartPos.current.x;
        const dy = e.clientY - dragStartPos.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= DRAG_THRESHOLD) {
          // Past threshold -- initiate native drag
          cleanup();
          initiateNativeDrag();
        }
      };

      const handleMouseUp = () => {
        cleanup();
      };

      const cleanup = () => {
        dragStartPos.current = null;
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
        cleanupRef.current = null;
      };

      // Clean up any stale listeners
      if (cleanupRef.current) cleanupRef.current();

      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      cleanupRef.current = cleanup;
    },
    [enabled, selectedPaths, initiateNativeDrag]
  );

  return {
    handleDragMouseDown,
    isDragging: isDragging.current,
  };
}
