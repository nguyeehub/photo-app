import { useState, useCallback, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import {
  BurstGroup,
  FavouriteFolder,
  ScanResult,
  SortOrder,
  ViewMode,
} from "./types";
import { groupByDate } from "./utils";
import { DirectoryPicker } from "./components/DirectoryPicker";
import { Sidebar } from "./components/Sidebar";
import { Toolbar } from "./components/Toolbar";
import { BurstGrid } from "./components/BurstGrid";
import { GroupView } from "./components/GroupView";
import { ImagePreview } from "./components/ImagePreview";
import { LoadingOverlay } from "./components/LoadingOverlay";

function App() {
  const [directory, setDirectory] = useState<string | null>(null);
  const [groups, setGroups] = useState<BurstGroup[]>([]);
  const [totalImages, setTotalImages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("groups");
  const [selectedGroup, setSelectedGroup] = useState<BurstGroup | null>(null);
  const [previewImages, setPreviewImages] = useState<{
    groupId: number;
    imageIndex: number;
  } | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");

  // Sidebar state
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [favourites, setFavourites] = useState<FavouriteFolder[]>([]);

  // Derive date sections from groups + sort order
  const dateSections = useMemo(
    () => groupByDate(groups, sortOrder),
    [groups, sortOrder]
  );

  // Load favourites on mount
  useEffect(() => {
    async function loadFavs() {
      try {
        const favs = await invoke<FavouriteFolder[]>("load_favourites");
        setFavourites(favs);
      } catch (err) {
        console.error("Failed to load favourites:", err);
      }
    }
    loadFavs();
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setSidebarVisible((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleFolderSelect = useCallback(async (path: string) => {
    setDirectory(path);
    setLoading(true);
    setViewMode("groups");
    setSelectedGroup(null);
    setPreviewImages(null);

    try {
      const result = await invoke<ScanResult>("scan_directory", {
        path,
        thresholdMs: 3000,
      });
      setGroups(result.groups);
      setTotalImages(result.total_images);
    } catch (err) {
      console.error("Failed to scan directory:", err);
      setGroups([]);
      setTotalImages(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleToggleFavourite = useCallback(
    async (path: string) => {
      const exists = favourites.some((f) => f.path === path);
      let newPaths: string[];

      if (exists) {
        newPaths = favourites.filter((f) => f.path !== path).map((f) => f.path);
      } else {
        newPaths = [...favourites.map((f) => f.path), path];
      }

      try {
        await invoke("save_favourites", { paths: newPaths });
        const updatedFavs = await invoke<FavouriteFolder[]>("load_favourites");
        setFavourites(updatedFavs);
      } catch (err) {
        console.error("Failed to save favourites:", err);
      }
    },
    [favourites]
  );

  const isFavourite = useMemo(
    () => (directory ? favourites.some((f) => f.path === directory) : false),
    [directory, favourites]
  );

  const handleGroupClick = useCallback((group: BurstGroup) => {
    setSelectedGroup(group);
    setViewMode("group-detail");
  }, []);

  const handleImageClick = useCallback(
    (groupId: number, imageIndex: number) => {
      setPreviewImages({ groupId, imageIndex });
      setViewMode("preview");
    },
    []
  );

  const handleBackToGroups = useCallback(() => {
    setSelectedGroup(null);
    setViewMode("groups");
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewImages(null);
    setViewMode(selectedGroup ? "group-detail" : "groups");
  }, [selectedGroup]);

  const handleNavigatePreview = useCallback((index: number) => {
    setPreviewImages((prev) =>
      prev ? { ...prev, imageIndex: index } : null
    );
  }, []);

  const getPreviewContext = () => {
    if (!previewImages) return null;
    const group = groups.find((g) => g.id === previewImages.groupId);
    if (!group) return null;
    return {
      images: group.images,
      currentIndex: previewImages.imageIndex,
    };
  };

  const previewContext = getPreviewContext();

  return (
    <div className="h-screen flex flex-col">
      {/* Top header bar */}
      <DirectoryPicker
        directory={directory}
        loading={loading}
        totalImages={totalImages}
        onDirectorySelected={handleFolderSelect}
        isFavourite={isFavourite}
        onToggleFavourite={
          directory ? () => handleToggleFavourite(directory) : undefined
        }
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible((v) => !v)}
      />

      {/* Main layout: sidebar + content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <Sidebar
          activePath={directory}
          onFolderSelect={handleFolderSelect}
          favourites={favourites}
          onToggleFavourite={handleToggleFavourite}
          width={sidebarWidth}
          onWidthChange={setSidebarWidth}
          visible={sidebarVisible}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!loading && groups.length > 0 && viewMode === "groups" && (
            <Toolbar
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              totalImages={totalImages}
              totalGroups={groups.length}
            />
          )}

          {loading && <LoadingOverlay />}

          {!loading && viewMode === "groups" && (
            <BurstGrid
              sections={dateSections}
              onGroupClick={handleGroupClick}
              onImageClick={handleImageClick}
            />
          )}

          {!loading && viewMode === "group-detail" && selectedGroup && (
            <GroupView
              group={selectedGroup}
              onBack={handleBackToGroups}
              onImageClick={(idx) => handleImageClick(selectedGroup.id, idx)}
            />
          )}
        </div>
      </div>

      {/* Full-screen preview overlay */}
      {viewMode === "preview" && previewContext && (
        <ImagePreview
          images={previewContext.images}
          currentIndex={previewContext.currentIndex}
          onClose={handleClosePreview}
          onNavigate={handleNavigatePreview}
        />
      )}
    </div>
  );
}

export default App;
