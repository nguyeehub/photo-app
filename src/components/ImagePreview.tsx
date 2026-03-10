import { useEffect, useCallback } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ImageInfo } from "../types";

interface ImagePreviewProps {
  images: ImageInfo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function ImagePreview({
  images,
  currentIndex,
  onClose,
  onNavigate,
}: ImagePreviewProps) {
  const currentImage = images[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const goNext = useCallback(() => {
    if (hasNext) onNavigate(currentIndex + 1);
  }, [hasNext, currentIndex, onNavigate]);

  const goPrev = useCallback(() => {
    if (hasPrev) onNavigate(currentIndex - 1);
  }, [hasPrev, currentIndex, onNavigate]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "Escape":
          onClose();
          break;
        case "ArrowRight":
          goNext();
          break;
        case "ArrowLeft":
          goPrev();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goNext, goPrev]);

  if (!currentImage) return null;

  const imageUrl = convertFileSrc(currentImage.path);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/80 backdrop-blur-sm border-b border-gray-800/50">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-white font-medium truncate">
            {currentImage.filename}
          </span>
          {currentImage.timestamp_str && (
            <span className="text-xs text-gray-400 shrink-0">
              {currentImage.timestamp_str}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">
            {currentIndex + 1} / {images.length}
          </span>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors cursor-pointer"
          >
            <svg
              className="w-6 h-6"
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
      </div>

      {/* Image container */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        <img
          key={currentImage.path}
          src={imageUrl}
          alt={currentImage.filename}
          className="max-w-full max-h-full object-contain select-none"
          draggable={false}
        />

        {/* Left arrow */}
        {hasPrev && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
        )}

        {/* Right arrow */}
        {hasNext && (
          <button
            onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors cursor-pointer"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Bottom thumbnail strip */}
      {images.length > 1 && (
        <div className="bg-black/80 backdrop-blur-sm border-t border-gray-800/50 px-4 py-2">
          <div className="flex gap-1 overflow-x-auto justify-center">
            {images.map((img, idx) => (
              <button
                key={img.path}
                onClick={() => onNavigate(idx)}
                className={`shrink-0 w-16 h-16 rounded overflow-hidden transition-all cursor-pointer ${
                  idx === currentIndex
                    ? "ring-2 ring-blue-500 opacity-100"
                    : "opacity-40 hover:opacity-70"
                }`}
              >
                <img
                  src={convertFileSrc(img.path)}
                  alt={img.filename}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
