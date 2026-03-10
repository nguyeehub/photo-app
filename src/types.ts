export interface ImageInfo {
  path: string;
  filename: string;
  timestamp: number | null;
  timestamp_str: string | null;
  date_str: string | null;
  width: number | null;
  height: number | null;
}

export interface BurstGroup {
  id: number;
  images: ImageInfo[];
  label: string;
  count: number;
  date_key: string | null;
}

export interface ScanResult {
  groups: BurstGroup[];
  total_images: number;
  directory: string;
}

export interface CacheClearResult {
  files_removed: number;
  bytes_freed: number;
}

export type ViewMode = "groups" | "group-detail" | "preview";

export type SortOrder = "newest" | "oldest";

/** A date section containing burst groups for that day */
export interface DateSection {
  date: string; // "2025-01-15"
  displayDate: string; // "January 15, 2025"
  groups: BurstGroup[];
  totalPhotos: number;
}

/** A directory entry returned by the list_directory command */
export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
  has_children: boolean;
}

/** A mounted volume */
export interface VolumeInfo {
  name: string;
  path: string;
}

/** A favourite folder with existence check */
export interface FavouriteFolder {
  name: string;
  path: string;
  exists: boolean;
}
