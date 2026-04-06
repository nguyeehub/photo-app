import { useMemo } from "react";
import { open } from "@tauri-apps/plugin-dialog";

interface DirectoryPickerProps {
  directory: string | null;
  loading: boolean;
  totalImages: number;
  onDirectorySelected: (path: string) => void;
  /** Whether the current directory is a favourite */
  isFavourite: boolean;
  /** Toggle favourite status for current directory */
  onToggleFavourite?: () => void;
  /** Whether the sidebar is visible */
  sidebarVisible: boolean;
  /** Toggle sidebar visibility */
  onToggleSidebar: () => void;
}

export function DirectoryPicker({
  directory,
  loading,
  totalImages,
  onDirectorySelected,
  isFavourite,
  onToggleFavourite,
  sidebarVisible,
  onToggleSidebar,
}: DirectoryPickerProps) {
  const handlePickDirectory = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select photo folder or SD card",
    });

    if (selected) {
      onDirectorySelected(selected as string);
    }
  };

  const pathSegments = useMemo(() => {
    if (!directory) return [];
    const parts = directory.split("/").filter(Boolean);
    return parts.map((part, i) => ({
      name: part,
      fullPath: "/" + parts.slice(0, i + 1).join("/"),
    }));
  }, [directory]);

  // Show last 3 segments, collapse earlier ones
  const visibleSegments = pathSegments.length > 3
    ? pathSegments.slice(-3)
    : pathSegments;
  const hasCollapsed = pathSegments.length > 3;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-warm-900/80 backdrop-blur-sm border-b border-warm-800/60">
      {/* Toggle sidebar button — sidebar panel icon */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 text-warm-500 hover:text-warm-200 hover:bg-warm-800/60 rounded-lg transition-all duration-150 cursor-pointer"
        title={sidebarVisible ? "Hide sidebar (Cmd+B)" : "Show sidebar (Cmd+B)"}
        aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="3" strokeWidth={1.5} />
          <line x1="9" y1="3" x2="9" y2="21" strokeWidth={1.5} />
        </svg>
      </button>

      {/* Open folder button — secondary style */}
      <button
        onClick={handlePickDirectory}
        disabled={loading}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-warm-800 hover:bg-warm-750 border border-warm-700/60 hover:border-warm-600/60 text-warm-300 hover:text-warm-100 disabled:bg-warm-800/50 disabled:text-warm-600 disabled:border-warm-800 text-xs font-medium rounded-lg transition-all duration-150 cursor-pointer"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M3.75 9.776c.112-.017.227-.026.344-.026h15.812c.117 0 .232.009.344.026m-16.5 0a2.25 2.25 0 00-1.883 2.542l.857 6a2.25 2.25 0 002.227 1.932H19.05a2.25 2.25 0 002.227-1.932l.857-6a2.25 2.25 0 00-1.883-2.542m-16.5 0V6A2.25 2.25 0 016 3.75h3.879a1.5 1.5 0 011.06.44l2.122 2.12a1.5 1.5 0 001.06.44H18A2.25 2.25 0 0120.25 9v.776"
          />
        </svg>
        {loading ? "Scanning\u2026" : "Open"}
      </button>

      {/* Breadcrumb path display */}
      {directory ? (
        <div className="flex items-center gap-0.5 min-w-0 flex-1 overflow-hidden">
          {hasCollapsed && (
            <>
              <span
                className="shrink-0 px-1.5 py-0.5 text-[11px] text-warm-600 select-none"
                title={pathSegments.slice(0, -3).map(s => s.name).join(" / ")}
              >
                {"\u2026"}
              </span>
              <ChevronSep />
            </>
          )}
          {visibleSegments.map((seg, i) => {
            const isLast = i === visibleSegments.length - 1;
            return (
              <div key={seg.fullPath} className="flex items-center gap-0.5 min-w-0">
                {i > 0 && <ChevronSep />}
                <button
                  onClick={() => onDirectorySelected(seg.fullPath)}
                  className={`shrink-0 px-2 py-0.5 text-[11px] rounded-md transition-colors cursor-pointer truncate max-w-[140px] ${
                    isLast
                      ? "text-warm-200 font-medium bg-warm-800/40"
                      : "text-warm-400 font-medium hover:text-warm-200 hover:bg-warm-800/50"
                  }`}
                  title={seg.fullPath}
                >
                  {seg.name}
                </button>
              </div>
            );
          })}
        </div>
      ) : (
        <span className="text-xs text-warm-600 italic flex-1">
          No folder selected
        </span>
      )}

      {/* Image count badge */}
      {directory && totalImages > 0 && (
        <span className="shrink-0 px-2.5 py-0.5 bg-warm-850 rounded-full text-warm-400 text-[10px] font-medium tabular-nums">
          {totalImages} images
        </span>
      )}

      {/* Favourite toggle button */}
      {directory && onToggleFavourite && (
        <button
          onClick={onToggleFavourite}
          className={`p-1.5 rounded-lg transition-all duration-200 cursor-pointer hover:bg-warm-800/50 active:scale-90 ${
            isFavourite
              ? "text-amber-400 hover:text-amber-300"
              : "text-warm-600 hover:text-amber-400"
          }`}
          title={isFavourite ? "Remove from favourites" : "Add to favourites"}
          aria-label={isFavourite ? "Remove from favourites" : "Add to favourites"}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
            {isFavourite ? (
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            ) : (
              <path
                fillRule="evenodd"
                d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                clipRule="evenodd"
              />
            )}
          </svg>
        </button>
      )}
    </div>
  );
}

function ChevronSep() {
  return (
    <svg
      className="w-3 h-3 text-warm-700 shrink-0"
      fill="currentColor"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}
