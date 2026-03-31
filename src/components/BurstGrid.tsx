import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BurstGroup, DateSection } from "../types";
import { Thumbnail } from "./Thumbnail";
import { SelectionMarquee } from "./SelectionMarquee";
import { useMarqueeSelection } from "../hooks/useMarqueeSelection";
import { useDragOut } from "../hooks/useDragOut";

const INITIAL_VISIBLE = 60;
const LOAD_MORE_COUNT = 60;
const SCROLL_THRESHOLD = 300; // px from bottom to trigger load more

interface BurstGridProps {
  sections: DateSection[];
  onGroupClick: (group: BurstGroup) => void;
  onImageClick: (groupId: number, imageIndex: number) => void;
  favouritePhotos: Map<string, number>;
  // Selection props
  selectedPaths: Set<string>;
  onItemClick: (
    paths: string[],
    flatIndex: number,
    event: React.MouseEvent
  ) => void;
  onSelectionChange: (paths: Set<string>) => void;
  setFlatList: (list: string[][]) => void;
}

export function BurstGrid({
  sections,
  onGroupClick,
  onImageClick,
  favouritePhotos,
  selectedPaths,
  onItemClick,
  onSelectionChange,
  setFlatList,
}: BurstGridProps) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset visible count when sections change (new folder scanned or sort order changed)
  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [sections]);

  // Flatten all groups across all sections to count and slice them
  const allGroups = useMemo(
    () => sections.flatMap((s) => s.groups),
    [sections]
  );
  const totalGroups = allGroups.length;
  const hasMore = visibleCount < totalGroups;

  // Build the visible sections by slicing the flattened groups up to visibleCount,
  // then re-grouping them back into their date sections
  const visibleSections = useMemo(() => {
    let remaining = visibleCount;
    const result: DateSection[] = [];

    for (const section of sections) {
      if (remaining <= 0) break;

      if (section.groups.length <= remaining) {
        // Entire section fits
        result.push(section);
        remaining -= section.groups.length;
      } else {
        // Partial section - slice the groups
        const partialGroups = section.groups.slice(0, remaining);
        result.push({
          ...section,
          groups: partialGroups,
          totalPhotos: partialGroups.reduce((sum, g) => sum + g.count, 0),
        });
        remaining = 0;
      }
    }

    return result;
  }, [sections, visibleCount]);

  // Build the flat list of path-groups for range selection + marquee
  const flatPathGroups = useMemo(() => {
    return visibleSections.flatMap((s) =>
      s.groups.map((g) => g.images.map((img) => img.path))
    );
  }, [visibleSections]);

  // Keep the selection hook's flat list in sync
  useEffect(() => {
    setFlatList(flatPathGroups);
  }, [flatPathGroups, setFlatList]);

  // Scroll handler - load more when near the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < SCROLL_THRESHOLD) {
      setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, totalGroups));
    }
  }, [hasMore, totalGroups]);

  // Marquee selection
  const { marqueeRect, handleMouseDown: handleMarqueeMouseDown } =
    useMarqueeSelection({
      containerRef: scrollRef,
      selectedPaths,
      onSelectionChange,
      enabled: true,
    });

  // Native drag-out
  const { handleDragMouseDown } = useDragOut({
    selectedPaths,
    enabled: selectedPaths.size > 0,
  });

  // Check if we have no sections because of favourites filter (sections passed in are already filtered)
  const hasFavourites = favouritePhotos.size > 0;

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-warm-500 animate-fade-in">
        <div className="text-center max-w-sm">
          {hasFavourites ? (
            <>
              {/* No favourites in current view */}
              <div className="w-16 h-16 mx-auto mb-5 flex items-center justify-center rounded-full bg-warm-900">
                <svg className="w-8 h-8 text-warm-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </div>
              <h1 className="text-lg font-medium text-warm-200 mb-2" style={{ textWrap: 'balance' }}>
                No Favourites in This Folder
              </h1>
              <p className="text-sm text-warm-500 leading-relaxed">
                Open a photo and press{" "}
                <span className="text-warm-400 font-medium">Up Arrow</span>,{" "}
                double-click, or click the{" "}
                <span className="text-warm-400 font-medium">heart icon</span>{" "}
                to favourite photos.
              </p>
            </>
          ) : (
            <>
              {/* Stylized burst stack illustration */}
              <div className="relative w-24 h-24 mx-auto mb-6">
                <div className="absolute inset-0 rounded-xl bg-warm-800 rotate-[-6deg] shadow-lg" />
                <div className="absolute inset-0 rounded-xl bg-warm-850 rotate-[-3deg] shadow-lg" />
                <div className="absolute inset-0 rounded-xl bg-warm-900 shadow-lg flex items-center justify-center">
                  <svg className="w-10 h-10 text-warm-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                  </svg>
                </div>
              </div>
              <h1 className="text-lg font-medium text-warm-200 mb-2" style={{ textWrap: 'balance' }}>
                No Photos Found
              </h1>
              <p className="text-sm text-warm-500 leading-relaxed">
                Double-click a folder in the sidebar to scan for photos, or use{" "}
                <span className="text-warm-400 font-medium">Open Folder</span> above.
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  // Build a running flat index for each group
  let runningFlatIndex = 0;

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 pb-4 animate-fade-in relative select-none"
      onScroll={handleScroll}
      onMouseDown={handleMarqueeMouseDown}
    >
      {/* Marquee overlay */}
      <SelectionMarquee rect={marqueeRect} />

      {visibleSections.map((section) => (
        <div key={section.date} className="mb-8">
          {/* Date section header -- sticky, flush against toolbar */}
          <div className="sticky top-0 z-10 flex items-center gap-3 mb-4 py-2.5 -mx-4 px-4 bg-warm-950/90 backdrop-blur-sm border-b border-warm-800/40">
            <h2 className="text-sm font-semibold text-warm-200 tracking-tight" style={{ textWrap: 'balance' }}>
              {section.displayDate}
            </h2>
            <span className="text-xs text-warm-500 tabular-nums">
              {section.totalPhotos} photo{section.totalPhotos !== 1 ? "s" : ""}
            </span>
            <div className="flex-1 border-t border-warm-800/60" />
          </div>

          {/* Grid of burst groups for this date */}
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8 2xl:grid-cols-10 gap-6">
            {section.groups.map((group) => {
              const flatIndex = runningFlatIndex++;
              return (
                <BurstGroupCard
                  key={group.id}
                  group={group}
                  flatIndex={flatIndex}
                  onGroupClick={() => onGroupClick(group)}
                  onImageClick={(idx) => onImageClick(group.id, idx)}
                  onItemClick={onItemClick}
                  onDragMouseDown={handleDragMouseDown}
                  favouritePhotos={favouritePhotos}
                  selectedPaths={selectedPaths}
                />
              );
            })}
          </div>
        </div>
      ))}

      {/* Load more indicator */}
      {hasMore && (
        <div className="flex items-center justify-center py-6 text-warm-500 text-xs tabular-nums">
          <div className="w-4 h-4 border-2 border-warm-700 border-t-warm-400 rounded-full animate-spin mr-2" />
          Loading more\u2026 ({visibleCount} / {totalGroups} groups)
        </div>
      )}

      {/* Bottom padding */}
      {!hasMore && totalGroups > 0 && (
        <div className="text-center py-4 text-xs text-warm-600 tabular-nums">
          {totalGroups} group{totalGroups !== 1 ? "s" : ""} total
        </div>
      )}
    </div>
  );
}

interface BurstGroupCardProps {
  group: BurstGroup;
  flatIndex: number;
  onGroupClick: () => void;
  onImageClick: (imageIndex: number) => void;
  onItemClick: (
    paths: string[],
    flatIndex: number,
    event: React.MouseEvent
  ) => void;
  onDragMouseDown: (event: React.MouseEvent) => void;
  favouritePhotos: Map<string, number>;
  selectedPaths: Set<string>;
}

function BurstGroupCard({
  group,
  flatIndex,
  onGroupClick,
  onImageClick,
  onItemClick,
  onDragMouseDown,
  favouritePhotos,
  selectedPaths,
}: BurstGroupCardProps) {
  const isBurst = group.count > 1;
  const groupPaths = useMemo(
    () => group.images.map((img) => img.path),
    [group.images]
  );

  // Check if this card is selected (any image in the group is selected)
  const isSelected = useMemo(
    () => groupPaths.some((p) => selectedPaths.has(p)),
    [groupPaths, selectedPaths]
  );

  // Find favourited images in this group and determine the cover image.
  const { coverImage, hasFavourites } = useMemo(() => {
    let earliestFav: { image: typeof group.images[0]; ts: number } | null =
      null;
    for (const img of group.images) {
      const ts = favouritePhotos.get(img.path);
      if (ts !== undefined) {
        if (!earliestFav || ts < earliestFav.ts) {
          earliestFav = { image: img, ts };
        }
      }
    }
    return {
      coverImage: earliestFav ? earliestFav.image : group.images[0],
      hasFavourites: earliestFav !== null,
    };
  }, [group.images, favouritePhotos]);

  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      onItemClick(groupPaths, flatIndex, event);
    },
    [onItemClick, groupPaths, flatIndex]
  );

  const handleDoubleClick = useCallback(() => {
    if (isBurst) {
      onGroupClick();
    } else {
      onImageClick(0);
    }
  }, [isBurst, onGroupClick, onImageClick]);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      // If this card is already selected, allow drag-out initiation
      if (isSelected) {
        onDragMouseDown(event);
      }
    },
    [isSelected, onDragMouseDown]
  );

  return (
    <div
      data-selectable-paths={groupPaths.join(",")}
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
      aria-label={isBurst ? `Burst group: ${group.count} photos` : coverImage.filename}
      aria-selected={isSelected}
    >
      <div className="aspect-square overflow-hidden">
        <Thumbnail
          imagePath={coverImage.path}
          alt={coverImage.filename}
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

      {/* Burst count badge */}
      {isBurst && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums min-w-[1.5rem] text-center">
          {group.count}
        </div>
      )}

      {/* Favourite heart badge */}
      {hasFavourites && (
        <div className="absolute bottom-2 right-2 z-10">
          <svg
            className="w-4 h-4 text-red-500 drop-shadow-md"
            viewBox="0 0 24 24"
            fill="currentColor"
            stroke="currentColor"
            strokeWidth={1}
            aria-hidden="true"
          >
            <path d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        </div>
      )}

      {/* Stacked card effect for bursts */}
      {isBurst && (
        <>
          <div className="absolute inset-0 -z-10 translate-x-1 translate-y-1 bg-warm-800 rounded-xl" />
          <div className="absolute inset-0 -z-20 translate-x-2 translate-y-2 bg-warm-700 rounded-xl opacity-50" />
        </>
      )}

      {/* Hover overlay with filename */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <p className="text-white text-xs font-medium truncate">{coverImage.filename}</p>
        {coverImage.timestamp_str && (
          <p className="text-warm-300 text-[10px] truncate mt-0.5">
            {coverImage.timestamp_str}
          </p>
        )}
      </div>
    </div>
  );
}
