import { open } from "@tauri-apps/plugin-dialog";

interface DirectoryPickerProps {
  directory: string | null;
  loading: boolean;
  totalImages: number;
  onDirectorySelected: (path: string) => void;
}

export function DirectoryPicker({
  directory,
  loading,
  totalImages,
  onDirectorySelected,
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
    <div className="flex items-center gap-4 px-6 py-3 bg-gray-900 border-b border-gray-800">
      <button
        onClick={handlePickDirectory}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
      >
        {loading ? "Scanning..." : "Open Folder"}
      </button>

      {directory && (
        <div className="flex items-center gap-3 text-sm text-gray-400 min-w-0">
          <span className="truncate" title={directory}>
            {directory}
          </span>
          {totalImages > 0 && (
            <span className="shrink-0 px-2 py-0.5 bg-gray-800 rounded text-gray-300 text-xs">
              {totalImages} images
            </span>
          )}
        </div>
      )}

      {!directory && (
        <span className="text-sm text-gray-500">
          Select a folder to browse photos
        </span>
      )}
    </div>
  );
}
