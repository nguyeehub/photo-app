import { BurstGroup } from "../types";
import { Thumbnail } from "./Thumbnail";

interface BurstGridProps {
  groups: BurstGroup[];
  onGroupClick: (group: BurstGroup) => void;
  onImageClick: (groupId: number, imageIndex: number) => void;
}

export function BurstGrid({
  groups,
  onGroupClick,
  onImageClick,
}: BurstGridProps) {
  if (groups.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-500">
        <div className="text-center">
          <div className="text-4xl mb-4">📷</div>
          <p className="text-lg">No photos found</p>
          <p className="text-sm mt-1">Select a folder containing images</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {groups.map((group) => (
          <BurstGroupCard
            key={group.id}
            group={group}
            onGroupClick={() => onGroupClick(group)}
            onImageClick={(idx) => onImageClick(group.id, idx)}
          />
        ))}
      </div>
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
