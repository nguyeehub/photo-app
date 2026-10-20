import { useEffect, useCallback, useRef, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ImageInfo } from "../types";
import { Thumbnail } from "./Thumbnail";
import { ZoomControls } from "./ZoomControls";
import { useImageZoom } from "../hooks/useImageZoom";
import { useDragOut } from "../hooks/useDragOut";

// ── Thumbnail strip with auto-scroll ────────────────────────────────────

function ThumbnailStrip({
  images,
  currentIndex,
  onNavigate,
  favouritePhotos,
  selectedPaths,
  onThumbMouseDown,
}: {
  images: ImageInfo[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  favouritePhotos: Map<string, number>;
  selectedPaths: Set<string>;
  onThumbMouseDown: (event: React.MouseEvent, path: string) => void;
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
          const isSelected = selectedPaths.has(img.path);
          const isCurrent = idx === currentIndex;
          const ringClass = isCurrent
            ? "ring-2 ring-accent-500"
            : isSelected
              ? "ring-2 ring-blue-500"
              : "";
          const opacityClass = isCurrent
            ? "opacity-100 scale-105"
            : isSelected
              ? "opacity-90"
              : "opacity-35 hover:opacity-60";
          return (
            <button
              key={img.path}
              onClick={() => onNavigate(idx)}
              onMouseDown={(e) => onThumbMouseDown(e, img.path)}
              className={`relative shrink-0 w-14 h-14 rounded-lg overflow-hidden transition-all cursor-pointer ${ringClass} ${opacityClass}`}
              aria-label={`View image ${idx + 1}: ${img.filename}`}
              aria-selected={isSelected}
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
  onNavigateNext: () => void;
  onNavigatePrev: () => void;
  canNavigateNext: boolean;
  canNavigatePrev: boolean;
  favouritePhotos: Map<string, number>;
  onToggleFavourite: (path: string) => void;
  favouriteGroups: Map<string, number>;
  onToggleFavouriteGroup: (groupKey: string) => void;
  /** Multi-selection state shared with the grid */
  selectedPaths: Set<string>;
  setSelectedPaths: React.Dispatch<React.SetStateAction<Set<string>>>;
  clearSelection: () => void;
}

export function ImagePreview({
  images,
  currentIndex,
  onClose,
  onNavigate,
  onNavigateNext,
  onNavigatePrev,
  canNavigateNext,
  canNavigatePrev,
  favouritePhotos,
  onToggleFavourite,
  favouriteGroups,
  onToggleFavouriteGroup,
  selectedPaths,
  setSelectedPaths,
  clearSelection,
}: ImagePreviewProps) {
  const currentImage = images[currentIndex];
  const [showLikeBurst, setShowLikeBurst] = useState(false);
  const [likeBurstKey, setLikeBurstKey] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const zoom = useImageZoom(containerRef, imageRef);

  // Reset zoom when navigating to a different image
  useEffect(() => {
    zoom.reset();
  }, [currentIndex]);

  const triggerLikeBurst = useCallback(() => {
    setLikeBurstKey((k) => k + 1);
    setShowLikeBurst(true);
  }, []);

  const goNext = useCallback(() => {
    onNavigateNext();
  }, [onNavigateNext]);

  const goPrev = useCallback(() => {
    onNavigatePrev();
  }, [onNavigatePrev]);

  const toggleCurrentFavourite = useCallback(() => {
    if (currentImage) {
      const wasFavourited = favouritePhotos.has(currentImage.path);
      onToggleFavourite(currentImage.path);
      if (!wasFavourited) {
        triggerLikeBurst();
      }
    }
  }, [currentImage, favouritePhotos, onToggleFavourite, triggerLikeBurst]);

  const isFavourited = currentImage
    ? favouritePhotos.has(currentImage.path)
    : false;

  // Group-level favourite: only meaningful when the burst has more than 1 image.
  const groupKey = images[0]?.path ?? "";
  const isBurstGroup = images.length > 1;
  const isGroupFavourited = groupKey
    ? favouriteGroups.has(groupKey)
    : false;

  const toggleCurrentGroupFavourite = useCallback(() => {
    if (groupKey && isBurstGroup) {
      onToggleFavouriteGroup(groupKey);
    }
  }, [groupKey, isBurstGroup, onToggleFavouriteGroup]);

  // ── Shift+Arrow range selection ────────────────────────────────────────
  // Anchor is the index within `images` where the current shift-range started.
  // Null means no active shift-range; the next Shift+Arrow seeds it with
  // the current index.
  const shiftAnchorRef = useRef<number | null>(null);

  // Reset the shift-range anchor whenever the current burst changes (e.g.
  // user navigates across group boundaries or opens a different preview).
  useEffect(() => {
    shiftAnchorRef.current = null;
  }, [images]);

  const extendSelectionBy = useCallback(
    (delta: 1 | -1) => {
      if (shiftAnchorRef.current === null) {
        shiftAnchorRef.current = currentIndex;
      }
      const target = currentIndex + delta;
      // Shift-range is scoped to the current burst; don't cross boundaries.
      if (target < 0 || target >= images.length) return;

      const anchor = shiftAnchorRef.current;
      const lo = Math.min(anchor, target);
      const hi = Math.max(anchor, target);

      const newSet = new Set<string>();
      for (let i = lo; i <= hi; i++) {
        newSet.add(images[i].path);
      }
      setSelectedPaths(newSet);
      onNavigate(target);
    },
    [currentIndex, images, onNavigate, setSelectedPaths]
  );

  // Native drag-out from the thumbnail strip. Always enabled: when the thumb
  // is part of the current selection we drag all selected paths; otherwise
  // we drag just that single thumb.
  const { handleDragMouseDown } = useDragOut({
    selectedPaths,
    enabled: true,
  });

  const handleThumbMouseDown = useCallback(
    (event: React.MouseEvent, path: string) => {
      if (selectedPaths.has(path)) {
        handleDragMouseDown(event);
      } else {
        handleDragMouseDown(event, [path]);
      }
    },
    [selectedPaths, handleDragMouseDown]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Zoom shortcuts (Cmd/Ctrl + key)
      if (e.metaKey || e.ctrlKey) {
        switch (e.key) {
          case "=":
          case "+":
            e.preventDefault();
            zoom.zoomIn();
            return;
          case "-":
            e.preventDefault();
            zoom.zoomOut();
            return;
          case "0":
            e.preventDefault();
            zoom.zoomToFit();
            return;
        }
      }

      switch (e.key) {
        case "Escape":
          shiftAnchorRef.current = null;
          if (selectedPaths.size > 0) {
            clearSelection();
            return;
          }
          onClose();
          break;
        case "ArrowRight":
          if (e.shiftKey) {
            e.preventDefault();
            extendSelectionBy(1);
          } else {
            shiftAnchorRef.current = null;
            goNext();
          }
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            e.preventDefault();
            extendSelectionBy(-1);
          } else {
            shiftAnchorRef.current = null;
            goPrev();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (e.shiftKey) {
            toggleCurrentGroupFavourite();
          } else {
            toggleCurrentFavourite();
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onClose,
    goNext,
    goPrev,
    toggleCurrentFavourite,
    toggleCurrentGroupFavourite,
    extendSelectionBy,
    selectedPaths,
    clearSelection,
    zoom,
  ]);

  useEffect(() => {
    if (!showLikeBurst) return;
    const timer = window.setTimeout(() => {
      setShowLikeBurst(false);
    }, 900);
    return () => window.clearTimeout(timer);
  }, [showLikeBurst, likeBurstKey]);

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
          {isBurstGroup && (
            <button
              onClick={toggleCurrentGroupFavourite}
              className={`shrink-0 p-1 rounded-md transition-colors cursor-pointer relative ${
                isGroupFavourited
                  ? "text-blue-500 hover:text-blue-400"
                  : "text-warm-500 hover:text-blue-400"
              }`}
              aria-label={
                isGroupFavourited
                  ? "Remove group favourite"
                  : "Favourite entire group"
              }
              title={
                isGroupFavourited
                  ? "Remove group favourite (Shift+Up Arrow)"
                  : "Favourite entire group (Shift+Up Arrow)"
              }
            >
              {/* Layered/stacked heart icon */}
              <svg
                className="absolute left-0.5 top-0.5 w-5 h-5 opacity-50"
                viewBox="0 0 24 24"
                fill={isGroupFavourited ? "currentColor" : "none"}
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
              <svg
                className="relative w-5 h-5"
                viewBox="0 0 24 24"
                fill={isGroupFavourited ? "currentColor" : "none"}
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
          )}
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
      <div ref={containerRef} className="flex-1 relative flex items-center justify-center overflow-hidden">
        {showLikeBurst && (
          <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div key={likeBurstKey} className="like-burst" aria-hidden="true">
              <div className="like-burst-ring" />
              <svg
                className="like-burst-heart"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
              </svg>
            </div>
          </div>
        )}

        <img
          ref={imageRef}
          key={currentImage.path}
          src={imageUrl}
          alt={currentImage.filename}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: zoom.transformStyle,
            transition: zoom.shouldTransition ? "transform 200ms ease-out" : "none",
            cursor: zoom.cursorStyle,
            transformOrigin: "center center",
          }}
          draggable={false}
          onMouseDown={zoom.handleMouseDown}
          onDoubleClick={zoom.handleDoubleClick}
          onLoad={zoom.handleImageLoad}
        />

        {/* Left arrow */}
        {canNavigatePrev && (
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
        {canNavigateNext && (
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

        <ZoomControls
          zoomPercent={zoom.zoomPercent}
          isZoomed={zoom.isZoomed}
          onZoomIn={zoom.zoomIn}
          onZoomOut={zoom.zoomOut}
          onZoomToFit={zoom.zoomToFit}
        />
      </div>

      {/* Bottom thumbnail strip */}
      {images.length > 1 && (
        <ThumbnailStrip
          images={images}
          currentIndex={currentIndex}
          onNavigate={onNavigate}
          favouritePhotos={favouritePhotos}
          selectedPaths={selectedPaths}
          onThumbMouseDown={handleThumbMouseDown}
        />
      )}
    </div>
  );
}
