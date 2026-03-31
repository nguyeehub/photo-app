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
  /** Set of folder paths that have been scanned this session */
  scannedPaths: Set<string>;
}

export function Sidebar({
  activePath,
  onFolderSelect,
  favourites,
  onToggleFavourite,
  width,
  onWidthChange,
  visible,
  scannedPaths,
}: SidebarProps) {
  const [homeDir, setHomeDir] = useState<string | null>(null);
  const [volumes, setVolumes] = useState<VolumeInfo[]>([]);
  const [externalDevices, setExternalDevices] = useState<VolumeInfo[]>([]);
  const [favouritesCollapsed, setFavouritesCollapsed] = useState(false);
  const [devicesCollapsed, setDevicesCollapsed] = useState(false);
  const [homeCollapsed, setHomeCollapsed] = useState(false);
  const [volumesCollapsed, setVolumesCollapsed] = useState(false);
  const resizingRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Load home dir and volumes on mount
  useEffect(() => {
    async function init() {
      try {
        const [home, vols, devices] = await Promise.all([
          invoke<string>("get_home_dir"),
          invoke<VolumeInfo[]>("list_volumes"),
          invoke<VolumeInfo[]>("list_external_devices"),
        ]);
        setHomeDir(home);
        // Filter external devices out of volumes to avoid duplication
        const externalPaths = new Set(devices.map((d) => d.path));
        setVolumes(vols.filter((v) => !externalPaths.has(v.path)));
        setExternalDevices(devices);
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

  return (
    <div
      ref={sidebarRef}
      className="flex shrink-0 h-full border-r border-warm-800 bg-warm-950 transition-[width,opacity] duration-200 ease-out overflow-hidden"
      style={{ width: visible ? `${width}px` : '0px', opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
    >
      {/* Sidebar content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-2" style={{ minWidth: `${width}px` }}>
        {/* Favourites section */}
        <SidebarSection
          title="Favourites"
          collapsed={favouritesCollapsed}
          onToggle={() => setFavouritesCollapsed((v) => !v)}
        >
          {favourites.length === 0 ? (
            <div className="px-5 py-2 text-[11px] text-warm-600 italic">
              No favourites yet
            </div>
          ) : (
            favourites.map((fav) => (
              <button
                type="button"
                key={fav.path}
                className={`flex items-center gap-1.5 px-4 py-1.5 cursor-pointer group rounded-md mx-1 transition-colors w-full text-left ${
                  activePath === fav.path
                    ? "bg-accent-600/15 text-accent-400"
                    : fav.exists
                      ? "text-warm-300 hover:bg-warm-800/70 hover:text-warm-100"
                      : "text-warm-600 line-through"
                }`}
                onClick={() => fav.exists && onFolderSelect(fav.path)}
                aria-label={`Open ${fav.name}`}
                disabled={!fav.exists}
              >
                <svg
                  className="w-3.5 h-3.5 shrink-0 text-amber-400"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className="text-xs truncate">{fav.name}</span>
                {scannedPaths.has(fav.path) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-500/50 shrink-0" title="Previously scanned" />
                )}
                {/* Remove from favourites button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavourite(fav.path);
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-warm-500 hover:text-red-400 transition-opacity cursor-pointer p-0.5"
                  title="Remove from favourites"
                  aria-label={`Remove ${fav.name} from favourites`}
                >
                  <svg
                    className="w-3 h-3"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </button>
            ))
          )}
        </SidebarSection>

        {/* Devices section */}
        <SidebarSection
          title="Devices"
          collapsed={devicesCollapsed}
          onToggle={() => setDevicesCollapsed((v) => !v)}
        >
          {externalDevices.map((dev) => (
            <FolderTree
              key={dev.path}
              rootPath={dev.path}
              rootName={dev.name}
              activePath={activePath}
              onFolderSelect={onFolderSelect}
              scannedPaths={scannedPaths}
              depth={0}
            />
          ))}
          {externalDevices.length === 0 && (
            <div className="px-5 py-2 text-[11px] text-warm-600 italic">
              No devices connected
            </div>
          )}
        </SidebarSection>

        {/* Home section */}
        <SidebarSection
          title="Home"
          collapsed={homeCollapsed}
          onToggle={() => setHomeCollapsed((v) => !v)}
        >
          {homeDir && (
            <FolderTree
              rootPath={homeDir}
              rootName={homeDir.split("/").pop() || "Home"}
              activePath={activePath}
              onFolderSelect={onFolderSelect}
              scannedPaths={scannedPaths}
              depth={0}
              defaultExpanded
            />
          )}
        </SidebarSection>

        {/* Volumes section */}
        <SidebarSection
          title="Volumes"
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
              scannedPaths={scannedPaths}
              depth={0}
            />
          ))}
          {volumes.length === 0 && (
            <div className="px-5 py-2 text-[11px] text-warm-600 italic">
              No volumes found
            </div>
          )}
        </SidebarSection>
      </div>

      {/* Resize handle */}
      <div
        className="w-1 cursor-col-resize hover:bg-accent-500/40 active:bg-accent-500/60 transition-colors shrink-0"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      />
    </div>
  );
}

// -- Collapsible section header ---

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
    <div className="mb-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 w-full px-3 py-1.5 text-[11px] font-semibold text-warm-500 tracking-wide hover:text-warm-300 transition-colors cursor-pointer"
        aria-expanded={!collapsed}
      >
        <svg
          className={`w-3 h-3 transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`}
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
        {title}
      </button>
      <div
        className={`transition-[grid-template-rows] duration-200 ease-out grid ${
          collapsed ? "grid-rows-[0fr]" : "grid-rows-[1fr]"
        }`}
      >
        <div className="overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
