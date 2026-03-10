interface LoadingOverlayProps {
  message?: string;
}

export function LoadingOverlay({
  message = "Scanning images\u2026",
}: LoadingOverlayProps) {
  return (
    <div className="flex-1 flex items-center justify-center animate-fade-in">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-warm-700 border-t-accent-500 rounded-full animate-spin mx-auto mb-4" />
        <p className="text-warm-400 text-sm">{message}</p>
      </div>
    </div>
  );
}
