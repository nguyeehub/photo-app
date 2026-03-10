export interface ImageInfo {
  path: string;
  filename: string;
  timestamp: number | null;
  timestamp_str: string | null;
  width: number | null;
  height: number | null;
}

export interface BurstGroup {
  id: number;
  images: ImageInfo[];
  label: string;
  count: number;
}

export interface ScanResult {
  groups: BurstGroup[];
  total_images: number;
  directory: string;
}

export type ViewMode = "groups" | "group-detail" | "preview";
