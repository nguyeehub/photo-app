import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { BurstGroup, DateSection } from "../types";
import { Thumbnail } from "./Thumbnail";

const INITIAL_VISIBLE = 60;
const LOAD_MORE_COUNT = 60;
const SCROLL_THRESHOLD = 300; // px from bottom to trigger load more

interface BurstGridProps {
  sections: DateSection[];
  onGroupClick: (group: BurstGroup) => void;
  onImageClick: (groupId: number, imageIndex: number) => void;
}

export function BurstGrid({
  sections,
  onGroupClick,
  onImageClick,
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

  // Scroll handler - load more when near the bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasMore) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (distanceFromBottom < SCROLL_THRESHOLD) {
      setVisibleCount((prev) => Math.min(prev + LOAD_MORE_COUNT, totalGroups));
    }
  }, [hasMore, totalGroups]);

  if (sections.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4">📷</div>
          <p className="text-lg">No photos found</p>
          <p className="text-sm mt-1">
            Double-click a folder in the sidebar to scan for photos
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4"
      onScroll={handleScroll}
    >
      {visibleSections.map((section) => (
        <div key={section.date} className="mb-6">
          {/* Date section header */}
          <div className="flex items-center gap-3 mb-3 px-1">
            <h2 className="text-sm font-semibold text-gray-200">
              {section.displayDate}
            </h2>
            <span className="text-xs text-gray-500">
              {section.totalPhotos} photo{section.totalPhotos !== 1 ? "s" : ""}
            </span>
            <div className="flex-1 border-t border-gray-800" />
          </div>

          {/* Grid of burst groups for this date */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {section.groups.map((group) => (
              <BurstGroupCard
                key={group.id}
                group={group}
                onGroupClick={() => onGroupClick(group)}
                onImageClick={(idx) => onImageClick(group.id, idx)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Load more indicator */}
      {hasMore && (
        <div className="flex items-center justify-center py-6 text-gray-500 text-xs">
          <div className="w-4 h-4 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin mr-2" />
          Loading more... ({visibleCount} / {totalGroups} groups)
        </div>
      )}

      {/* Bottom padding */}
      {!hasMore && totalGroups > 0 && (
        <div className="text-center py-4 text-xs text-gray-600">
          {totalGroups} group{totalGroups !== 1 ? "s" : ""} total
        </div>
      )}
    </div>
  );
}

interface BurstGroupCardProps {
  group: BurstGroup;
  onGroupClick: () => void;
  onImageClick: (imageIndex: number) => void;
}

function BurstGroupCard({
  group,
  onGroupClick,
  onImageClick,
}: BurstGroupCardProps) {
  const coverImage = group.images[0];
  const isBurst = group.count > 1;

  return (
    <div
      className="group relative rounded-lg overflow-hidden bg-gray-900 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
      onClick={() => (isBurst ? onGroupClick() : onImageClick(0))}
    >
      <div className="aspect-square">
        <Thumbnail
          imagePath={coverImage.path}
          alt={coverImage.filename}
          size={300}
          className="w-full h-full"
        />
      </div>

      {/* Burst count badge */}
      {isBurst && (
        <div className="absolute top-2 right-2 bg-black/70 backdrop-blur-sm text-white text-xs font-bold px-2 py-1 rounded-full">
          {group.count}
        </div>
      )}

      {/* Stacked card effect for bursts */}
      {isBurst && (
        <>
          <div className="absolute inset-0 -z-10 translate-x-1 translate-y-1 bg-gray-800 rounded-lg" />
          <div className="absolute inset-0 -z-20 translate-x-2 translate-y-2 bg-gray-700 rounded-lg opacity-60" />
        </>
      )}

      {/* Hover overlay with filename */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-white text-xs truncate">{coverImage.filename}</p>
        {coverImage.timestamp_str && (
          <p className="text-gray-300 text-[10px] truncate">
            {coverImage.timestamp_str}
          </p>
        )}
      </div>
    </div>
  );
}
