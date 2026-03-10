import { useEffect, useState, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FavouriteFolder, VolumeInfo } from "../types";
import { FolderTree } from "./FolderTree";

interface SidebarProps {
  /** Currently selected folder path (shown in the grid) */
  activePath: string | null;
  /** Called when a folder is selected */
  onFolderSelect: (path: string) => void;
  /** Current list of favourite folders */
  favourites: FavouriteFolder[];
  /** Toggle a path in/out of favourites */
  onToggleFavourite: (path: string) => void;
  /** Width of the sidebar in pixels */
  width: number;
  /** Called when sidebar is resized */
  onWidthChange: (width: number) => void;
  /** Whether the sidebar is visible */
  visible: boolean;
}

export function Sidebar({
  activePath,
  onFolderSelect,
  favourites,
  onToggleFavourite,
  width,
  onWidthChange,
  visible,
}: SidebarProps) {
  const [homeDir, setHomeDir] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [favouritesCollapsed, setFavouritesCollapsed] = useState(false);
  const [homeCollapsed, setHomeCollapsed] = useState(false);
  const [volumesCollapsed, setVolumesCollapsed] = useState(false);
  const resizingRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Load home dir and volumes on mount
  useEffect(() => {
    async function init() {
      try {
        const [home, vols] = await Promise.all([
          invoke<string>("get_home_dir"),
          invoke<VolumeInfo[]>("list_volumes"),
        ]);
        setHomeDir(home);
        setVolumes(vols);
      } catch (err) {
        console.error("Failed to init sidebar:", err);
      }
    }
    init();
  }, []);

  // Resize handling
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizingRef.current = true;

      const startX = e.clientX;
      const startWidth = width;

      const handleMouseMove = (e: MouseEvent) => {
        if (!resizingRef.current) return;
        const newWidth = Math.max(180, Math.min(500, startWidth + (e.clientX - startX)));
        onWidthChange(newWidth);
      };

      const handleMouseUp = () => {
        resizingRef.current = false;
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [width, onWidthChange]
  );

  if (!visible) return null;

  return (
    <div
      ref={sidebarRef}
      className="flex shrink-0 h-full border-r border-gray-800 bg-gray-950"
      style={{ width: `${width}px` }}
    >
      {/* Sidebar content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2">
        {/* Favourites section */}
        <SidebarSection
          title="FAVOURITES"
          collapsed={favouritesCollapsed}
          onToggle={() => setFavouritesCollapsed((v) => !v)}
        >
          {favourites.length === 0 ? (
            <div className="px-5 py-2 text-[10px] text-gray-600 italic">
              No favourites yet
            </div>
          ) : (
            favourites.map((fav) => (
              <div
                key={fav.path}
                className={`flex items-center gap-1.5 px-4 py-1 cursor-pointer group rounded-sm mx-1 transition-colors ${
                  activePath === fav.path
                    ? "bg-blue-600/20 text-blue-300"
                    : fav.exists
                      ? "text-gray-300 hover:bg-gray-800 hover:text-white"
                      : "text-gray-600 line-through"
                }`}
                onClick={() => fav.exists && onFolderSelect(fav.path)}
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0 text-yellow-500"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs truncate">{fav.name}</span>
                {/* Remove from favourites button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavourite(fav.path);
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity cursor-pointer"
                  title="Remove from favourites"
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))
          )}
        </SidebarSection>

        {/* Home section */}
        <SidebarSection
          title="HOME"
          collapsed={homeCollapsed}
          onToggle={() => setHomeCollapsed((v) => !v)}
        >
          {homeDir && (
            <FolderTree
              rootPath={homeDir}
              rootName={homeDir.split("/").pop() || "Home"}
              activePath={activePath}
              onFolderSelect={onFolderSelect}
              depth={0}
              defaultExpanded
            />
          )}
        </SidebarSection>

        {/* Volumes section */}
        <SidebarSection
          title="VOLUMES"
          collapsed={volumesCollapsed}
          onToggle={() => setVolumesCollapsed((v) => !v)}
        >
          {volumes.map((vol) => (
            <FolderTree
              key={vol.path}
              rootPath={vol.path}
              rootName={vol.name}
              activePath={activePath}
              onFolderSelect={onFolderSelect}
              depth={0}
            />
          ))}
          {volumes.length === 0 && (
            <div className="px-5 py-2 text-[10px] text-gray-600 italic">
              No volumes found
            </div>
          )}
        </SidebarSection>
      </div>

      {/* Resize handle */}
      <div
        className="w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors shrink-0"
        onMouseDown={handleMouseDown}
      />
    </div>
  );
}

// ── Collapsible section header ─────────────────────────────────────────────

interface SidebarSectionProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

function SidebarSection({
  title,
  collapsed,
  onToggle,
  children,
}: SidebarSectionProps) {
  return (
    <div className="mb-2">
      <button
        onClick={onToggle}
        className="flex items-center gap-1 w-full px-3 py-1.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider hover:text-gray-300 transition-colors cursor-pointer"
      >
        <svg
          className={`w-3 h-3 transition-transform ${collapsed ? "" : "rotate-90"}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
        {title}
      </button>
      {!collapsed && children}
    </div>
  );
}
