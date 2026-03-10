import { BurstGroup } from "../types";
import { Thumbnail } from "./Thumbnail";

interface GroupViewProps {
  group: BurstGroup;
  onBack: () => void;
  onImageClick: (imageIndex: number) => void;
}

export function GroupView({ group, onBack, onImageClick }: GroupViewProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-3 bg-gray-900/50 border-b border-gray-800">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
        >
          <svg
            className="w-4 h-4"
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
          Back
        </button>
        <div className="text-sm text-gray-300">
          <span className="font-medium text-white">Burst Group</span>
          <span className="mx-2 text-gray-600">|</span>
          <span>{group.count} photos</span>
          {group.images[0]?.timestamp_str && (
            <>
              <span className="mx-2 text-gray-600">|</span>
              <span>{group.images[0].timestamp_str}</span>
            </>
          )}
        </div>
      </div>

      {/* Image grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {group.images.map((image, index) => (
            <div
              key={image.path}
              className="group relative rounded-lg overflow-hidden bg-gray-900 cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all"
              onClick={() => onImageClick(index)}
            >
              <div className="aspect-square">
                <Thumbnail
                  imagePath={image.path}
                  alt={image.filename}
                  size={300}
                  className="w-full h-full"
                />
              </div>

              {/* Image index */}
              <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-white text-xs font-mono px-2 py-0.5 rounded">
                {index + 1}
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-white text-xs truncate">{image.filename}</p>
                {image.timestamp_str && (
                  <p className="text-gray-300 text-[10px] truncate">
                    {image.timestamp_str}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
