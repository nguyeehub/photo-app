import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SortOrder } from "../types";

interface ToolbarProps {
  sortOrder: SortOrder;
  onSortOrderChange: (order: SortOrder) => void;
  totalImages: number;
  totalGroups: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0\u00A0B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, i);
  return `${i === 0 ? value : value.toFixed(1)}\u00A0${units[i]}`;
}

export function Toolbar({
  sortOrder,
  onSortOrderChange,
  totalImages,
  totalGroups,
}: ToolbarProps) {
  const [cacheSize, setCacheSize] = useState<number | null>(null);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadCacheSize();
  }, []);

  async function loadCacheSize() {
    try {
      const size = await invoke<number>("get_cache_size");
      setCacheSize(size);
    } catch {
      setCacheSize(null);
    }
  }

  async function handleClearCache() {
    setClearing(true);
    try {
      await invoke("clear_thumbnail_cache");
      setCacheSize(0);
    } catch (err) {
      console.error("Failed to clear cache:", err);
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex items-center justify-between px-6 py-2 bg-warm-900/50 border-b border-warm-800">
      {/* Left: sort controls */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-warm-500 uppercase tracking-wide font-medium">
          Sort
        </span>
        <div className="flex rounded-lg overflow-hidden border border-warm-700">
          <button
            onClick={() => onSortOrderChange("newest")}
            className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              sortOrder === "newest"
                ? "bg-accent-600 text-white"
                : "bg-warm-800 text-warm-400 hover:text-warm-200"
            }`}
          >
            Newest First
          </button>
          <button
            onClick={() => onSortOrderChange("oldest")}
            className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              sortOrder === "oldest"
                ? "bg-accent-600 text-white"
                : "bg-warm-800 text-warm-400 hover:text-warm-200"
            }`}
          >
            Oldest First
          </button>
        </div>
      </div>

      {/* Center: stats */}
      <div className="flex items-center gap-4 text-xs text-warm-500 tabular-nums">
        <span>{totalImages} photos</span>
        <span className="text-warm-700">&middot;</span>
        <span>{totalGroups} groups</span>
      </div>

      {/* Right: cache controls */}
      <div className="flex items-center gap-2">
        {cacheSize !== null && cacheSize > 0 && (
          <>
            <span className="text-xs text-warm-500 tabular-nums">
              Cache: {formatBytes(cacheSize)}
            </span>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="px-2 py-1 text-xs text-warm-400 hover:text-red-400 hover:bg-warm-800 rounded-md transition-colors cursor-pointer disabled:opacity-50"
              title="Clear thumbnail cache"
            >
              {clearing ? "Clearing\u2026" : "Clear"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
