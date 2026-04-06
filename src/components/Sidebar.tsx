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

  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);

  const handleEject = useCallback(async (devicePath: string, deviceName: string) => {
    try {
      await invoke("eject_volume", { path: devicePath });
      setExternalDevices((prev) => prev.filter((d) => d.path !== devicePath));
      setToast({ message: `"${deviceName}" has been ejected`, key: Date.now() });
    } catch (err) {
      console.error("Failed to eject device:", err);
    }
  }, []);

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
      className="flex shrink-0 h-full border-r border-warm-800/60 bg-warm-950/95 backdrop-blur-sm transition-[width,opacity] duration-200 ease-out overflow-hidden"
      style={{ width: visible ? `${width}px` : '0px', opacity: visible ? 1 : 0 }}
      aria-hidden={!visible}
    >
      {/* Sidebar content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-0.5" style={{ minWidth: `${width}px` }}>
        {/* Favourites section */}
        <SidebarSection
          title="Favourites"
          icon={
            <svg className="w-3.5 h-3.5 text-amber-400/60" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          }
          collapsed={favouritesCollapsed}
          onToggle={() => setFavouritesCollapsed((v) => !v)}
        >
          {favourites.length === 0 ? (
            <div className="px-5 py-3 text-[11px] text-warm-600/80 italic select-none">
              No favourites yet
            </div>
          ) : (
            favourites.map((fav) => (
              <button
                type="button"
                key={fav.path}
                className={`relative flex items-center gap-2 px-4 py-1.5 cursor-pointer group rounded-lg mx-1 transition-colors w-full text-left ${
                  activePath === fav.path
                    ? "bg-accent-600/10 text-accent-400 before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:bg-accent-500 before:rounded-full"
                    : fav.exists
                      ? "text-warm-300 hover:bg-warm-800/40 hover:text-warm-100"
                      : "text-warm-600 line-through"
                }`}
                onClick={() => fav.exists && onFolderSelect(fav.path)}
                aria-label={`Open ${fav.name}`}
                disabled={!fav.exists}
              >
                <svg
                  className="w-4 h-4 shrink-0 text-amber-400/80"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span className={`text-xs truncate ${activePath === fav.path ? "font-medium" : ""}`}>{fav.name}</span>
                {scannedPaths.has(fav.path) && (
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-400/40 ring-1 ring-accent-400/20 shrink-0" title="Previously scanned" />
                )}
                {/* Remove from favourites button — minus circle */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleFavourite(fav.path);
                  }}
                  className="ml-auto opacity-0 group-hover:opacity-100 text-warm-500 hover:text-red-400/80 transition-opacity cursor-pointer p-0.5"
                  title="Remove from favourites"
                  aria-label={`Remove ${fav.name} from favourites`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" strokeWidth={1.5} />
                    <line x1="8" y1="12" x2="16" y2="12" strokeWidth={1.5} strokeLinecap="round" />
                  </svg>
                </button>
              </button>
            ))
          )}
        </SidebarSection>

        {/* Devices section */}
        <SidebarSection
          title="Devices"
          icon={
            <svg className="w-3.5 h-3.5 text-warm-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <rect x="4" y="4" width="16" height="12" rx="2" strokeWidth={1.5} />
              <path d="M8 20h8" strokeLinecap="round" strokeWidth={1.5} />
              <path d="M12 16v4" strokeWidth={1.5} />
            </svg>
          }
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
              icon="device"
              onEject={() => handleEject(dev.path, dev.name)}
            />
          ))}
          {externalDevices.length === 0 && (
            <div className="px-5 py-3 text-[11px] text-warm-600/80 italic select-none">
              No devices connected
            </div>
          )}
        </SidebarSection>

        {/* Home section */}
        <SidebarSection
          title="Home"
          icon={
            <svg className="w-3.5 h-3.5 text-warm-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"
              />
            </svg>
          }
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
              icon="home"
              defaultExpanded
            />
          )}
        </SidebarSection>

        {/* Volumes section */}
        <SidebarSection
          title="Volumes"
          icon={
            <svg className="w-3.5 h-3.5 text-warm-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <ellipse cx="12" cy="6" rx="8" ry="3" strokeWidth={1.5} />
              <path d="M4 6v6c0 1.657 3.582 3 8 3s8-1.343 8-3V6" strokeWidth={1.5} />
              <path d="M4 12v6c0 1.657 3.582 3 8 3s8-1.343 8-3v-6" strokeWidth={1.5} />
            </svg>
          }
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
              icon="volume"
            />
          ))}
          {volumes.length === 0 && (
            <div className="px-5 py-3 text-[11px] text-warm-600/80 italic select-none">
              No volumes found
            </div>
          )}
        </SidebarSection>
      </div>

      {/* Resize handle */}
      <div
        className="w-[3px] cursor-col-resize hover:bg-accent-500/30 active:bg-accent-500/50 transition-colors duration-100 shrink-0"
        onMouseDown={handleMouseDown}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize sidebar"
      />

      {/* Eject toast */}
      {toast && (
        <EjectToast
          key={toast.key}
          message={toast.message}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
}

// -- Collapsible section header ---

interface SidebarSectionProps {
  title: string;
  collapsed: boolean;
  onToggle: () => void;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

function SidebarSection({
  title,
  collapsed,
  onToggle,
  icon,
  children,
}: SidebarSectionProps) {
  return (
    <div className="mb-2 first:mt-0 mt-1">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 w-full px-3 py-2 text-[11px] font-semibold text-warm-500 uppercase tracking-wider hover:text-warm-300 transition-colors cursor-pointer"
        aria-expanded={!collapsed}
      >
        <svg
          className={`w-2.5 h-2.5 transition-transform duration-150 ${collapsed ? "" : "rotate-90"}`}
          fill="currentColor"
          viewBox="0 0 10 10"
          aria-hidden="true"
        >
          <path d="M2.5 1.5l5 3.5-5 3.5V1.5z" />
        </svg>
        {icon}
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

// -- Eject toast notification ---

function EjectToast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-[toast-in_0.25s_ease-out,toast-out_0.3s_ease-in_2.7s_forwards] pointer-events-none">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-warm-800/95 backdrop-blur-sm border border-warm-700/50 rounded-xl shadow-lg shadow-black/30">
        <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <span className="text-sm text-warm-200">{message}</span>
      </div>
    </div>
  );
}
