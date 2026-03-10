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
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
    <div className="flex items-center justify-between px-6 py-2 bg-gray-900/50 border-b border-gray-800">
      {/* Left: sort controls */}
      <div className="flex items-center gap-3">
        <span className="text-xs text-gray-500 uppercase tracking-wide">
          Sort
        </span>
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          <button
            onClick={() => onSortOrderChange("newest")}
            className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              sortOrder === "newest"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            Newest first
          </button>
          <button
            onClick={() => onSortOrderChange("oldest")}
            className={`px-3 py-1 text-xs font-medium transition-colors cursor-pointer ${
              sortOrder === "oldest"
                ? "bg-blue-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-gray-200"
            }`}
          >
            Oldest first
          </button>
        </div>
      </div>

      {/* Center: stats */}
      <div className="flex items-center gap-4 text-xs text-gray-500">
        <span>{totalImages} photos</span>
        <span className="text-gray-700">|</span>
        <span>{totalGroups} groups</span>
      </div>

      {/* Right: cache controls */}
      <div className="flex items-center gap-2">
        {cacheSize !== null && cacheSize > 0 && (
          <>
            <span className="text-xs text-gray-500">
              Cache: {formatBytes(cacheSize)}
            </span>
            <button
              onClick={handleClearCache}
              disabled={clearing}
              className="px-2 py-1 text-xs text-gray-400 hover:text-red-400 hover:bg-gray-800 rounded transition-colors cursor-pointer disabled:opacity-50"
              title="Clear thumbnail cache"
            >
              {clearing ? "Clearing..." : "Clear"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
