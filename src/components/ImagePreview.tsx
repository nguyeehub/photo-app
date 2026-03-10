import { useEffect, useCallback, useRef } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ImageInfo } from "../types";
import { Thumbnail } from "./Thumbnail";

// ── Thumbnail strip with auto-scroll ────────────────────────────────────

function ThumbnailStrip({
  images,
  currentIndex,
  onNavigate,
  favouritePhotos,
}: {
  images: ImageInfo[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  favouritePhotos: Map<string, number>;
}) {
  const stripRef = useRef<HTMLDivElement>(null);

  // Scroll the active thumbnail into view whenever currentIndex changes
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const activeThumb = strip.children[currentIndex] as HTMLElement | undefined;
    if (activeThumb) {
      activeThumb.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "center",
      });
    }
  }, [currentIndex]);

  return (
    <div className="bg-black/80 backdrop-blur-md border-t border-white/5 px-4 py-2.5">
      <div
        ref={stripRef}
        className="flex gap-1.5 overflow-x-auto"
      >
        {images.map((img, idx) => {
          const isFav = favouritePhotos.has(img.path);
          return (
            <button
              key={img.path}
              onClick={() => onNavigate(idx)}
              className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all cursor-pointer ${
                idx === currentIndex
                  ? "ring-2 ring-accent-500 opacity-100 scale-105"
                  : "opacity-35 hover:opacity-60"
              }`}
              aria-label={`View image ${idx + 1}: ${img.filename}`}
            >
              <Thumbnail
                imagePath={img.path}
                alt={img.filename}
                size={80}
                className="w-full h-full"
              />
              {isFav && (
                <div className="absolute bottom-0.5 right-0.5">
                  <svg
                    className="w-3 h-3 text-red-500 drop-shadow-md"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                  </svg>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface ImagePreviewProps {
  images: ImageInfo[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  favouritePhotos: Map<string, number>;
  onToggleFavourite: (path: string) => void;
}

export function ImagePreview({
  images,
  currentIndex,
  onClose,
  onNavigate,
  favouritePhotos,
  onToggleFavourite,
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

  const toggleCurrentFavourite = useCallback(() => {
    if (currentImage) {
      onToggleFavourite(currentImage.path);
    }
  }, [currentImage, onToggleFavourite]);

  const isFavourited = currentImage
    ? favouritePhotos.has(currentImage.path)
    : false;

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
        case "ArrowUp":
          e.preventDefault();
          toggleCurrentFavourite();
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, goNext, goPrev, toggleCurrentFavourite]);

  if (!currentImage) return null;

  const imageUrl = convertFileSrc(currentImage.path);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fade-in" style={{ overscrollBehavior: 'contain' }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 bg-black/80 backdrop-blur-md border-b border-white/5">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm text-white font-medium truncate">
            {currentImage.filename}
          </span>
          {currentImage.timestamp_str && (
            <span className="text-xs text-warm-400 shrink-0">
              {currentImage.timestamp_str}
            </span>
          )}
          <button
            onClick={toggleCurrentFavourite}
            className={`shrink-0 p-1 rounded-md transition-colors cursor-pointer ${
              isFavourited
                ? "text-red-500 hover:text-red-400"
                : "text-warm-500 hover:text-red-400"
            }`}
            aria-label={isFavourited ? "Remove from favourites" : "Add to favourites"}
            title={isFavourited ? "Remove from favourites (Up Arrow)" : "Add to favourites (Up Arrow)"}
          >
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill={isFavourited ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
              />
            </svg>
          </button>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-warm-400 tabular-nums">
            {currentIndex + 1} / {images.length}
          </span>
          <button
            onClick={onClose}
            className="text-warm-400 hover:text-white transition-colors cursor-pointer p-1 rounded-md"
            aria-label="Close preview"
          >
            <svg
              className="w-5 h-5"
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
          onDoubleClick={toggleCurrentFavourite}
        />

        {/* Left arrow */}
        {hasPrev && (
          <button
            onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/40 hover:bg-black/70 text-white/70 hover:text-white rounded-full transition-colors cursor-pointer backdrop-blur-sm"
            aria-label="Previous image"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
            className="absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center bg-black/40 hover:bg-black/70 text-white/70 hover:text-white rounded-full transition-colors cursor-pointer backdrop-blur-sm"
            aria-label="Next image"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
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
        <ThumbnailStrip
          images={images}
          currentIndex={currentIndex}
          onNavigate={onNavigate}
          favouritePhotos={favouritePhotos}
        />
      )}
    </div>
  );
}
