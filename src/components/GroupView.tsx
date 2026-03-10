import { useRef, useEffect, useMemo, useCallback } from "react";
import { BurstGroup } from "../types";
import { Thumbnail } from "./Thumbnail";
import { SelectionMarquee } from "./SelectionMarquee";
import { useMarqueeSelection } from "../hooks/useMarqueeSelection";
import { useDragOut } from "../hooks/useDragOut";

interface GroupViewProps {
  group: BurstGroup;
  onBack: () => void;
  onImageClick: (imageIndex: number) => void;
  favouritePhotos: Map<string, number>;
  onToggleFavourite: (path: string) => void;
  // Selection props
  selectedPaths: Set<string>;
  onItemClick: (
    paths: string[],
    flatIndex: number,
    event: React.MouseEvent
  ) => void;
  onSelectionChange: (paths: Set<string>, additive: boolean) => void;
  setFlatList: (list: string[][]) => void;
}

export function GroupView({
  group,
  onBack,
  onImageClick,
  favouritePhotos,
  onToggleFavourite,
  selectedPaths,
  onItemClick,
  onSelectionChange,
  setFlatList,
}: GroupViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Build flat list for range selection (each image is its own group of one path)
  const flatPathGroups = useMemo(
    () => group.images.map((img) => [img.path]),
    [group.images]
  );

  useEffect(() => {
    setFlatList(flatPathGroups);
  }, [flatPathGroups, setFlatList]);

  // Marquee selection
  const { marqueeRect, handleMouseDown: handleMarqueeMouseDown } =
    useMarqueeSelection({
      containerRef: scrollRef,
      onSelectionChange,
      enabled: true,
    });

  // Native drag-out
  const { handleDragMouseDown } = useDragOut({
    selectedPaths,
    enabled: selectedPaths.size > 0,
  });

  return (
    <div className="flex-1 flex flex-col overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 bg-warm-900/50 border-b border-warm-800">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-sm text-warm-400 hover:text-warm-100 transition-colors cursor-pointer"
          aria-label="Back to all groups"
        >
          <svg
            className="w-4 h-4"
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
          Back
        </button>
        <div className="text-sm text-warm-300">
          <span className="font-semibold text-warm-100">Burst Group</span>
          <span className="mx-2 text-warm-600">&middot;</span>
          <span className="tabular-nums">{group.count} photos</span>
          {group.images[0]?.timestamp_str && (
            <>
              <span className="mx-2 text-warm-600">&middot;</span>
              <span>{group.images[0].timestamp_str}</span>
            </>
          )}
        </div>
      </div>

      {/* Image grid */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 relative select-none"
        onMouseDown={handleMarqueeMouseDown}
      >
        {/* Marquee overlay */}
        <SelectionMarquee rect={marqueeRect} />

        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-6">
          {group.images.map((image, index) => {
            const isFav = favouritePhotos.has(image.path);
            const isSelected = selectedPaths.has(image.path);

            return (
              <GroupImageCard
                key={image.path}
                image={image}
                index={index}
                isFav={isFav}
                isSelected={isSelected}
                onItemClick={onItemClick}
                onImageClick={onImageClick}
                onToggleFavourite={onToggleFavourite}
                onDragMouseDown={handleDragMouseDown}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface GroupImageCardProps {
  image: {
    path: string;
    filename: string;
    timestamp_str: string | null;
  };
  index: number;
  isFav: boolean;
  isSelected: boolean;
  onItemClick: (
    paths: string[],
    flatIndex: number,
    event: React.MouseEvent
  ) => void;
  onImageClick: (imageIndex: number) => void;
  onToggleFavourite: (path: string) => void;
  onDragMouseDown: (event: React.MouseEvent) => void;
}

function GroupImageCard({
  image,
  index,
  isFav,
  isSelected,
  onItemClick,
  onImageClick,
  onToggleFavourite,
  onDragMouseDown,
}: GroupImageCardProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      onItemClick([image.path], index, event);
    },
    [onItemClick, image.path, index]
  );

  const handleDoubleClick = useCallback(() => {
    onImageClick(index);
  }, [onImageClick, index]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      if (isSelected) {
        onDragMouseDown(event);
      }
    },
    [isSelected, onDragMouseDown]
  );

  return (
    <div
      data-selectable-paths={image.path}
      className={`group relative rounded-xl overflow-hidden bg-warm-900 cursor-pointer text-left w-full transition-all duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30 ${
        isSelected
          ? "ring-2 ring-blue-500 ring-offset-2 ring-offset-warm-950 scale-[0.98]"
          : ""
      }`}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseDown={handleMouseDown}
      role="button"
      tabIndex={0}
      aria-label={`View ${image.filename}`}
      aria-selected={isSelected}
    >
      <div className="aspect-square overflow-hidden">
        <Thumbnail
          imagePath={image.path}
          alt={image.filename}
          size={300}
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Selection checkmark */}
      {isSelected && (
        <div className="absolute top-2 left-2 z-20 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-md">
          <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Image index */}
      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs font-mono px-2 py-0.5 rounded-md tabular-nums">
        {index + 1}
      </div>

      {/* Favourite heart button */}
      <div
        className={`absolute bottom-2 right-2 z-10 p-1 rounded-full transition-all cursor-pointer ${
          isFav
            ? "opacity-100 bg-black/40 backdrop-blur-sm"
            : "opacity-0 group-hover:opacity-100 bg-black/40 backdrop-blur-sm hover:bg-black/60"
        }`}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavourite(image.path);
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            onToggleFavourite(image.path);
          }
        }}
        aria-label={isFav ? "Remove from favourites" : "Add to favourites"}
      >
        <svg
          className={`w-4 h-4 transition-colors ${
            isFav ? "text-red-500" : "text-white/70 hover:text-red-400"
          }`}
          viewBox="0 0 24 24"
          fill={isFav ? "currentColor" : "none"}
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
      </div>

      {/* Hover overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
        <p className="text-white text-xs font-medium truncate">{image.filename}</p>
        {image.timestamp_str && (
          <p className="text-warm-300 text-[10px] truncate mt-0.5">
            {image.timestamp_str}
          </p>
        )}
      </div>
    </div>
  );
}
