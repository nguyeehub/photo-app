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
      <div className="flex-1 flex items-center justify-center text-warm-500 animate-fade-in">
        <div className="text-center max-w-sm">
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
        </div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto px-4 pb-4 animate-fade-in"
      onScroll={handleScroll}
    >
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
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
    <button
      type="button"
      className="group relative rounded-xl overflow-hidden bg-warm-900 cursor-pointer text-left w-full transition-transform transition-shadow duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30"
      onClick={() => (isBurst ? onGroupClick() : onImageClick(0))}
      aria-label={isBurst ? `Burst group: ${group.count} photos` : coverImage.filename}
    >
      <div className="aspect-square overflow-hidden">
        <Thumbnail
          imagePath={coverImage.path}
          alt={coverImage.filename}
          size={300}
          className="w-full h-full transition-transform duration-300 group-hover:scale-105"
        />
      </div>

      {/* Burst count badge */}
      {isBurst && (
        <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md text-white text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums min-w-[1.5rem] text-center">
          {group.count}
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
    </button>
  );
}
