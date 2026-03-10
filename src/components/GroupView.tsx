import { BurstGroup } from "../types";
import { Thumbnail } from "./Thumbnail";

interface GroupViewProps {
  group: BurstGroup;
  onBack: () => void;
  onImageClick: (imageIndex: number) => void;
}

export function GroupView({ group, onBack, onImageClick }: GroupViewProps) {
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
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {group.images.map((image, index) => (
            <button
              type="button"
              key={image.path}
              className="group relative rounded-xl overflow-hidden bg-warm-900 cursor-pointer text-left w-full transition-transform transition-shadow duration-200 hover:scale-[1.02] hover:shadow-xl hover:shadow-black/30"
              onClick={() => onImageClick(index)}
              aria-label={`View ${image.filename}`}
            >
              <div className="aspect-square overflow-hidden">
                <Thumbnail
                  imagePath={image.path}
                  alt={image.filename}
                  size={300}
                  className="w-full h-full transition-transform duration-300 group-hover:scale-105"
                />
              </div>

              {/* Image index */}
              <div className="absolute top-2 left-2 bg-black/60 backdrop-blur-md text-white text-xs font-mono px-2 py-0.5 rounded-md tabular-nums">
                {index + 1}
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <p className="text-white text-xs font-medium truncate">{image.filename}</p>
                {image.timestamp_str && (
                  <p className="text-warm-300 text-[10px] truncate mt-0.5">
                    {image.timestamp_str}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
