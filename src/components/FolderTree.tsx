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
  /** Set of folder paths that have been scanned this session */
  scannedPaths: Set<string>;
  /** Initial depth level for indentation */
  depth?: number;
  /** Whether the root node starts expanded */
  defaultExpanded?: boolean;
  /** Contextual icon for root-level items */
  icon?: "device" | "volume" | "home" | "folder";
}

export function FolderTree({
  rootPath,
  rootName,
  activePath,
  onFolderSelect,
  scannedPaths,
  depth = 0,
  defaultExpanded = false,
  icon = "folder",
}: FolderTreeProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [children, setChildren] = useState<DirEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const isActive = activePath === rootPath;
  const wasScanned = scannedPaths.has(rootPath);

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

  // Scan button click
  const handleScanClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onFolderSelect(rootPath);
    },
    [rootPath, onFolderSelect]
  );

  // Cap visual indentation for deep nesting
  const effectiveDepth = Math.min(depth, 5);

  return (
    <div>
      {/* Folder row */}
      <div
        role="treeitem"
        tabIndex={0}
        aria-expanded={expanded}
        aria-label={rootName}
        className={`relative flex items-center gap-1.5 py-[5px] cursor-pointer group/row rounded-lg transition-all duration-100 mx-1 ${
          isActive
            ? "bg-accent-600/10 text-accent-400 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-accent-500 before:rounded-full"
            : "text-warm-300 hover:bg-warm-800/40 hover:text-warm-100"
        }`}
        style={{ paddingLeft: `${effectiveDepth * 14 + 6}px` }}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onFolderSelect(rootPath);
          } else if (e.key === " " || e.key === "ArrowRight") {
            e.preventDefault();
            if (!expanded) handleClick();
          } else if (e.key === "ArrowLeft") {
            e.preventDefault();
            if (expanded) handleClick();
          }
        }}
      >
        {/* Expand/collapse arrow */}
        <div className="w-4 h-4 flex items-center justify-center shrink-0 text-warm-500">
          {loading ? (
            <div className="w-3 h-3 border border-warm-600 border-t-warm-400 rounded-full animate-spin" />
          ) : (
            <svg
              className={`w-3 h-3 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
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
          )}
        </div>

        {/* Icon + name */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1 py-0.5">
          {depth === 0 ? (
            <RootIcon type={icon} expanded={expanded} />
          ) : (
            <svg
              className={`w-4 h-4 shrink-0 ${expanded ? "text-accent-400/80" : "text-warm-500/80"}`}
              fill="currentColor"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              {expanded ? (
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H4a1 1 0 00-1 1l-1 6V6z" />
              ) : (
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              )}
            </svg>
          )}
          <span className="text-xs truncate select-none">{rootName}</span>
          {/* Scanned indicator dot */}
          {wasScanned && (
            <span className="w-1.5 h-1.5 rounded-full bg-accent-400/40 ring-1 ring-accent-400/20 shrink-0" title="Previously scanned" />
          )}
        </div>

        {/* Scan button - appears on hover — photo icon */}
        <button
          onClick={handleScanClick}
          className="opacity-0 group-hover/row:opacity-100 p-0.5 mr-1 text-warm-500 hover:text-accent-400 transition-opacity cursor-pointer shrink-0"
          title="Scan this folder for photos"
          aria-label={`Scan ${rootName} for photos`}
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
              d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0022.5 18.75V5.25A2.25 2.25 0 0020.25 3H3.75A2.25 2.25 0 001.5 5.25v13.5A2.25 2.25 0 003.75 21z"
            />
          </svg>
        </button>
      </div>

      {/* Children (lazy loaded) -- with indent guide line */}
      {expanded && children && (
        <div className="relative">
          {/* Indent guide */}
          {children.length > 0 && (
            <div
              className="absolute top-0 bottom-0 w-px bg-warm-800/30"
              style={{ left: `${effectiveDepth * 14 + 14}px` }}
            />
          )}
          {children.length === 0 && (
            <div
              className="text-[11px] text-warm-600 py-1 italic"
              style={{ paddingLeft: `${(effectiveDepth + 1) * 14 + 24}px` }}
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
              scannedPaths={scannedPaths}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Renders a distinct icon based on the root-level item type */
function RootIcon({ type, expanded }: { type: string; expanded: boolean }) {
  const cls = `w-4 h-4 shrink-0 ${expanded ? "text-accent-400/80" : "text-warm-400"}`;

  switch (type) {
    case "device":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <rect x="4" y="4" width="16" height="12" rx="2" strokeWidth={1.5} />
          <path d="M8 20h8" strokeLinecap="round" strokeWidth={1.5} />
          <path d="M12 16v4" strokeWidth={1.5} />
        </svg>
      );
    case "volume":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <ellipse cx="12" cy="6" rx="8" ry="3" strokeWidth={1.5} />
          <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6" strokeWidth={1.5} />
          <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" strokeWidth={1.5} />
        </svg>
      );
    case "home":
      return (
        <svg className={cls} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
          />
        </svg>
      );
    default:
      return (
        <svg
          className={cls}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          {expanded ? (
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v1H4a1 1 0 00-1 1l-1 6V6z" />
          ) : (
            <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
          )}
        </svg>
      );
  }
}
