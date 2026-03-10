import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DirEntry } from "../types";

interface FolderTreeProps {
  /** The root path to display */
  rootPath: string;
  /** Display name for the root */
  rootName: string;
  /** Currently selected/active folder path */
  activePath: string | null;
  /** Called when a folder is double-clicked (triggers scan) */
  onFolderSelect: (path: string) => void;
  /** Initial depth level for indentation */
  depth?: number;
  /** Whether the root node starts expanded */
  defaultExpanded?: boolean;
}

export function FolderTree({
  rootPath,
  rootName,
  activePath,
  onFolderSelect,
  depth = 0,
  defaultExpanded = false,
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const isActive = activePath === rootPath;

  const loadChildren = useCallback(async () => {
    if (children !== null) return; // Already loaded
    setLoading(true);
    try {
      const entries = await invoke<DirEntry[]>("list_directory", {
        path: rootPath,
      });
      setChildren(entries);
    } catch (err) {
      console.error("Failed to list directory:", err);
      setChildren([]);
    } finally {
      setLoading(false);
    }
  }, [rootPath, children]);

  // Single click anywhere on the row = expand/collapse
  const handleClick = useCallback(async () => {
    if (!expanded) {
      await loadChildren();
    }
    setExpanded((prev) => !prev);
  }, [expanded, loadChildren]);

  // Double click on folder name = scan and show photos
  const handleDoubleClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      onFolderSelect(rootPath);
    },
    [rootPath, onFolderSelect]
  );

  // Scan button click (the play icon on hover)
  const handleScanClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFolderSelect(rootPath);
    },
    [rootPath, onFolderSelect]
  );

  return (
    <div>
      {/* Folder row */}
      <div
        className={`flex items-center gap-1 py-0.5 cursor-pointer group/row rounded-sm transition-colors ${
          isActive
            ? "bg-blue-600/20 text-blue-300"
            : "text-gray-300 hover:bg-gray-800 hover:text-white"
        }`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        {/* Expand/collapse arrow */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0 text-gray-500">
          {loading ? (
            <div className="w-3 h-3 border border-gray-600 border-t-gray-400 rounded-full animate-spin" />
          ) : (
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </div>

        {/* Folder icon + name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 py-0.5">
          <svg
            className={`w-4 h-4 shrink-0 ${expanded ? "text-blue-400" : "text-gray-500"}`}
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            {expanded ? (
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H4a1 1 0 00-1 1l-1 6V6z" />
            ) : (
              <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
            )}
          </svg>
          <span className="text-xs truncate select-none">{rootName}</span>
        </div>

        {/* Scan button - appears on hover */}
        <button
          onClick={handleScanClick}
          className="opacity-0 group-hover/row:opacity-100 p-0.5 mr-1 text-gray-500 hover:text-blue-400 transition-opacity cursor-pointer shrink-0"
          title="Scan this folder for photos"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
      </div>

      {/* Children (lazy loaded) */}
      {expanded && children && (
        <div>
          {children.length === 0 && (
            <div
              className="text-[10px] text-gray-600 py-0.5 italic"
              style={{ paddingLeft: `${(depth + 1) * 16 + 24}px` }}
            >
              Empty
            </div>
          )}
          {children.map((child) => (
            <FolderTree
              key={child.path}
              rootPath={child.path}
              rootName={child.name}
              activePath={activePath}
              onFolderSelect={onFolderSelect}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
