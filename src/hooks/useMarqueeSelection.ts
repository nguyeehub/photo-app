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
  /** Callback when marquee selection changes (called with Set of selected paths) */
  onSelectionChange: (paths: Set<string>, additive: boolean) => void;
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
  onSelectionChange,
  enabled = true,
}: UseMarqueeSelectionOptions): UseMarqueeSelectionReturn {
  const [marqueeRect, setMarqueeRect] = useState<MarqueeRect | null>(null);
  const isActive = useRef(false);
  const didDrag = useRef(false);
  const startPoint = useRef({ x: 0, y: 0 });
  const startScroll = useRef({ top: 0, left: 0 });
  const isAdditive = useRef(false);

  const getSelectableElements = useCallback(() => {
    const container = containerRef.current;
    if (!container) return [];
    return Array.from(
      container.querySelectorAll(`[${pathAttribute}]`)
    ) as HTMLElement[];
  }, [containerRef, pathAttribute]);

  const computeIntersection = useCallback(
    (rect: MarqueeRect) => {
      const container = containerRef.current;
      if (!container) return new Set<string>();

      const containerRect = container.getBoundingClientRect();
      const elements = getSelectableElements();
      const selected = new Set<string>();

      // Convert marquee rect to viewport coordinates
      const marqueeLeft = containerRect.left + rect.x;
      const marqueeTop = containerRect.top + rect.y;
      const marqueeRight = marqueeLeft + rect.width;
      const marqueeBottom = marqueeTop + rect.height;

      for (const el of elements) {
        const elRect = el.getBoundingClientRect();

        // Check intersection
        if (
          elRect.left < marqueeRight &&
          elRect.right > marqueeLeft &&
          elRect.top < marqueeBottom &&
          elRect.bottom > marqueeTop
        ) {
          const paths = el.getAttribute(pathAttribute);
          if (paths) {
            for (const p of paths.split(",")) {
              if (p) selected.add(p);
            }
          }
        }
      }

      return selected;
    },
    [containerRef, getSelectableElements, pathAttribute]
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
      startScroll.current = {
        top: container.scrollTop,
        left: container.scrollLeft,
      };
      isActive.current = true;
      didDrag.current = false;
      isAdditive.current = event.metaKey || event.ctrlKey;
    },
    [enabled, containerRef]
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

      const scrollDelta =
        container.scrollTop - startScroll.current.top;

      const x = Math.min(startPoint.current.x, currentX);
      const y = Math.min(startPoint.current.y + scrollDelta, currentY);
      const width = Math.abs(currentX - startPoint.current.x);
      const height = Math.abs(
        currentY - (startPoint.current.y + scrollDelta)
      );

      // Minimum 5px movement to start showing the marquee
      if (width < 5 && height < 5) return;

      didDrag.current = true;
      const rect: MarqueeRect = { x, y, width, height };
      setMarqueeRect(rect);

      // Compute what's intersected and notify -- convert to viewport-relative for intersection
      const viewportRect: MarqueeRect = {
        x,
        y: y - container.scrollTop,
        width,
        height,
      };
      const intersected = computeIntersection(viewportRect);
      onSelectionChange(intersected, isAdditive.current);
    };

    const handleMouseUp = () => {
      if (isActive.current) {
        const wasDrag = didDrag.current;
        isActive.current = false;
        didDrag.current = false;
        setMarqueeRect(null);

        // If mousedown was on empty space but no drag happened (just a click),
        // clear the selection -- standard Finder behavior
        if (!wasDrag && !isAdditive.current) {
          onSelectionChange(new Set(), false);
        }
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [containerRef, computeIntersection, onSelectionChange]);

  return {
    marqueeRect,
    isMarqueeActive: isActive.current && marqueeRect !== null,
    handleMouseDown,
  };
}
