interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({
  message = "Scanning images...",
}: LoadingOverlayProps) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-gray-700 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
