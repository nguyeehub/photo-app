import { useState, useCallback, useRef, useEffect } from "react";

export interface MarqueeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface UseMarqueeSelectionOptions {
  /** Ref to the scrollable container */
  containerRef: React.RefObject<HTMLElement | null>;
  /** Attribute on selectable elements that contains a comma-separated list of paths */
  pathAttribute?: string;
  /** Current selection snapshot (used as additive base on drag start) */
  selectedPaths: Set<string>;
  /** Callback when marquee selection changes (called with full selected set) */
  onSelectionChange: (paths: Set<string>) => void;
  /** Whether selection is enabled */
  enabled?: boolean;
}

export interface UseMarqueeSelectionReturn {
  /** The current marquee rectangle (null when not active) */
  marqueeRect: MarqueeRect | null;
  /** Whether a marquee drag is in progress */
  isMarqueeActive: boolean;
  /** Mouse down handler -- attach to the container */
  handleMouseDown: (event: React.MouseEvent) => void;
}

/**
 * Hook for rubber-band / marquee selection.
 * Draws a selection rectangle when clicking and dragging on empty space in the container.
 * Elements with data-selectable-paths attribute are checked for intersection.
 */
export function useMarqueeSelection({
  containerRef,
  pathAttribute = "data-selectable-paths",
  selectedPaths,
  onSelectionChange,
  enabled = true,
}: UseMarqueeSelectionOptions): UseMarqueeSelectionReturn {
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const isActive = useRef(false);
  const didDrag = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const selectionMode = useRef<"replace" | "add" | "toggle">("replace");
  const additiveBaseSelection = useRef<Set<string>>(new Set());
  const selectableItems = useRef<
    Array<{
      left: number;
      right: number;
      top: number;
      bottom: number;
      paths: string[];
    }>
  >([]);
  const rafId = useRef<number | null>(null);
  const pendingRect = useRef<MarqueeRect | null>(null);
  const lastEmittedSelection = useRef<Set<string>>(new Set());

  const areSetsEqual = useCallback((a: Set<string>, b: Set<string>) => {
    if (a.size !== b.size) return false;
    for (const v of a) {
      if (!b.has(v)) return false;
    }
    return true;
  }, []);

  const getSelectableElements = useCallback(() => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(`[${pathAttribute}]`)
    ) as HTMLElement[];
  }, [containerRef, pathAttribute]);

  const captureSelectableItems = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      selectableItems.current = [];
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const elements = getSelectableElements();
    selectableItems.current = elements
      .map((el) => {
        const elRect = el.getBoundingClientRect();
        const paths = el
          .getAttribute(pathAttribute)
          ?.split(",")
          .filter((p) => p.length > 0);
        if (!paths || paths.length === 0) return null;

        return {
          left: elRect.left - containerRect.left + container.scrollLeft,
          right: elRect.right - containerRect.left + container.scrollLeft,
          top: elRect.top - containerRect.top + container.scrollTop,
          bottom: elRect.bottom - containerRect.top + container.scrollTop,
          paths,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [containerRef, getSelectableElements, pathAttribute]);

  const computeIntersection = useCallback(
    (rect: MarqueeRect) => {
      const selected = new Set<string>();

      const marqueeLeft = rect.x;
      const marqueeTop = rect.y;
      const marqueeRight = marqueeLeft + rect.width;
      const marqueeBottom = marqueeTop + rect.height;

      for (const item of selectableItems.current) {

        // Check intersection
        if (
          item.left < marqueeRight &&
          item.right > marqueeLeft &&
          item.top < marqueeBottom &&
          item.bottom > marqueeTop
        ) {
          for (const p of item.paths) {
            selected.add(p);
          }
        }
      }

      return selected;
    },
    []
  );

  const emitSelectionForRect = useCallback(
    (rect: MarqueeRect) => {
      const intersected = computeIntersection(rect);
      let nextSelection: Set<string>;

      if (selectionMode.current === "add") {
        nextSelection = new Set([...additiveBaseSelection.current, ...intersected]);
      } else if (selectionMode.current === "toggle") {
        nextSelection = new Set(additiveBaseSelection.current);
        for (const path of intersected) {
          if (nextSelection.has(path)) {
            nextSelection.delete(path);
          } else {
            nextSelection.add(path);
          }
        }
      } else {
        nextSelection = intersected;
      }

      if (!areSetsEqual(nextSelection, lastEmittedSelection.current)) {
        lastEmittedSelection.current = nextSelection;
        onSelectionChange(nextSelection);
      }
    },
    [areSetsEqual, computeIntersection, onSelectionChange]
  );

  const scheduleSelectionUpdate = useCallback(
    (rect: MarqueeRect) => {
      pendingRect.current = rect;
      if (rafId.current !== null) return;

      rafId.current = window.requestAnimationFrame(() => {
        rafId.current = null;
        if (!pendingRect.current) return;
        emitSelectionForRect(pendingRect.current);
      });
    },
    [emitSelectionForRect]
  );

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (!enabled) return;

      // Only left button
      if (event.button !== 0) return;

      // Don't start marquee if clicking on an interactive element (button, selectable card)
      const target = event.target as HTMLElement;
      if (
        target.closest("[data-selectable-paths]") ||
        target.closest("button") ||
        target.closest("a") ||
        target.closest("[role='button']")
      ) {
        return;
      }

      const container = containerRef.current;
      if (!container) return;

      event.preventDefault();

      const containerRect = container.getBoundingClientRect();
      const x = event.clientX - containerRect.left;
      const y = event.clientY - containerRect.top + container.scrollTop;

      startPoint.current = { x, y };
      isActive.current = true;
      didDrag.current = false;
      const isMeta = event.metaKey || event.ctrlKey;
      const isShift = event.shiftKey;
      selectionMode.current = isShift ? "toggle" : isMeta ? "add" : "replace";
      additiveBaseSelection.current =
        selectionMode.current === "replace" ? new Set() : new Set(selectedPaths);
      captureSelectableItems();
      lastEmittedSelection.current = new Set(selectedPaths);
    },
    [enabled, containerRef, selectedPaths, captureSelectableItems]
  );

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isActive.current) return;

      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const currentX = event.clientX - containerRect.left;
      const currentY =
        event.clientY - containerRect.top + container.scrollTop;

      const x = Math.min(startPoint.current.x, currentX);
      const y = Math.min(startPoint.current.y, currentY);
      const width = Math.abs(currentX - startPoint.current.x);
      const height = Math.abs(currentY - startPoint.current.y);

      // Minimum 5px movement to start showing the marquee
      if (width < 5 && height < 5) return;

      didDrag.current = true;
      const rect: MarqueeRect = { x, y, width, height };
      setMarqueeRect(rect);

      // Compute what's intersected and notify -- convert to viewport-relative for intersection
      scheduleSelectionUpdate(rect);
    };

    const handleMouseUp = () => {
      if (isActive.current) {
        const wasDrag = didDrag.current;
        isActive.current = false;
        didDrag.current = false;
        setMarqueeRect(null);
        pendingRect.current = null;
        selectableItems.current = [];
        if (rafId.current !== null) {
          window.cancelAnimationFrame(rafId.current);
          rafId.current = null;
        }

        // If mousedown was on empty space but no drag happened (just a click),
        // clear the selection -- standard Finder behavior
        if (!wasDrag && selectionMode.current === "replace") {
          onSelectionChange(new Set());
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, onSelectionChange, scheduleSelectionUpdate]);

  return {
    marqueeRect,
    isMarqueeActive: isActive.current && marqueeRect !== null,
    handleMouseDown,
  };
}
