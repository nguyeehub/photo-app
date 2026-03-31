interface ZoomControlsProps {
  zoomPercent: number;
  isZoomed: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomToFit: () => void;
}

export function ZoomControls({
  zoomPercent,
  isZoomed,
  onZoomIn,
  onZoomOut,
  onZoomToFit,
}: ZoomControlsProps) {
  return (
    <div
      className={`absolute bottom-4 right-4 z-10 flex items-center gap-1 bg-black/60 backdrop-blur-md rounded-lg px-2 py-1.5 border border-white/10 transition-opacity ${
        isZoomed ? "opacity-100" : "opacity-0 hover:opacity-100"
      }`}
    >
      {/* Zoom out */}
      <button
        onClick={onZoomOut}
        className="p-1 rounded hover:bg-white/10 text-warm-300 hover:text-white transition-colors cursor-pointer"
        aria-label="Zoom out (⌘−)"
        title="Zoom out (⌘−)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
        </svg>
      </button>

      {/* Zoom percentage */}
      <span className="text-xs text-warm-200 tabular-nums w-12 text-center select-none">
        {zoomPercent}%
      </span>

      {/* Zoom in */}
      <button
        onClick={onZoomIn}
        className="p-1 rounded hover:bg-white/10 text-warm-300 hover:text-white transition-colors cursor-pointer"
        aria-label="Zoom in (⌘+)"
        title="Zoom in (⌘+)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-white/10" />

      {/* Fit to view */}
      <button
        onClick={onZoomToFit}
        className="p-1 rounded hover:bg-white/10 text-warm-300 hover:text-white transition-colors cursor-pointer"
        aria-label="Fit to view (⌘0)"
        title="Fit to view (⌘0)"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 8V4h4m8 0h4v4m0 8v4h-4m-8 0H4v-4"
          />
        </svg>
      </button>
    </div>
  );
}
