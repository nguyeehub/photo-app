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

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
      {/* Toggle sidebar button */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors cursor-pointer"
        title={sidebarVisible ? "Hide sidebar (Cmd+B)" : "Show sidebar (Cmd+B)"}
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Open folder button */}
      <button
        onClick={handlePickDirectory}
        disabled={loading}
        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded-lg transition-colors cursor-pointer"
      >
        {loading ? "Scanning..." : "Open Folder"}
      </button>

      {/* Current path display */}
      {directory && (
        <div className="flex items-center gap-2 text-sm text-gray-400 min-w-0 flex-1">
          <span className="truncate text-xs" title={directory}>
            {directory}
          </span>
          {totalImages > 0 && (
            <span className="shrink-0 px-2 py-0.5 bg-gray-800 rounded text-gray-300 text-[10px]">
              {totalImages} images
            </span>
          )}
        </div>
      )}

      {!directory && (
        <span className="text-xs text-gray-500">
          Select a folder to browse photos
        </span>
      )}

      {/* Favourite toggle button */}
      {directory && onToggleFavourite && (
        <button
          onClick={onToggleFavourite}
          className={`p-1.5 rounded transition-colors cursor-pointer ${
            isFavourite
              ? "text-yellow-500 hover:text-yellow-400"
              : "text-gray-600 hover:text-yellow-500"
          }`}
          title={isFavourite ? "Remove from favourites" : "Add to favourites"}
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
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
