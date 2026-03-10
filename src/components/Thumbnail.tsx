import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { convertFileSrc } from "@tauri-apps/api/core";

interface ThumbnailProps {
  imagePath: string;
  alt: string;
  size?: number;
  className?: string;
  onClick?: () => void;
}

export function Thumbnail({
  imagePath,
  alt,
  size = 300,
  className = "",
  onClick,
}: ThumbnailProps) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadThumbnail() {
      try {
        const thumbPath = await invoke<string>("generate_thumbnail", {
          sourcePath: imagePath,
          size,
        });
        if (!cancelled) {
          setThumbnailUrl(convertFileSrc(thumbPath));
        }
      } catch {
        if (!cancelled) {
          setError(true);
        }
      }
    }

    loadThumbnail();
    return () => {
      cancelled = true;
    };
  }, [imagePath, size]);

  if (error) {
    return (
      <div
        className={`bg-warm-800 flex items-center justify-center text-warm-500 text-xs ${className}`}
        onClick={onClick}
      >
        Failed
      </div>
    );
  }

  if (!thumbnailUrl) {
    return (
      <div
        className={`bg-warm-850 animate-pulse flex items-center justify-center ${className}`}
      >
        <div className="w-5 h-5 border-2 border-warm-600 border-t-warm-400 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <img
      src={thumbnailUrl}
      alt={alt}
      className={`object-cover animate-thumb-in ${className}`}
      onClick={onClick}
      loading="lazy"
    />
  );
}
