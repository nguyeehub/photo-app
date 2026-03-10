import { MarqueeRect } from "../hooks/useMarqueeSelection";

interface SelectionMarqueeProps {
  rect: MarqueeRect | null;
  scrollTop?: number;
}

/**
 * Renders the semi-transparent blue selection rectangle overlay.
 * Positioned absolutely within its scroll container parent.
 */
export function SelectionMarquee({ rect, scrollTop = 0 }: SelectionMarqueeProps) {
  if (!rect) return null;

  return (
    <div
      className="pointer-events-none absolute z-30"
      style={{
        left: rect.x,
        top: rect.y - scrollTop,
        width: rect.width,
        height: rect.height,
        backgroundColor: "rgba(59, 130, 246, 0.15)",
        border: "1px solid rgba(59, 130, 246, 0.5)",
        borderRadius: 3,
      }}
    />
  );
}
