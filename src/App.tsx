import { useState, useCallback, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import {
  BurstGroup,
  FavouriteFolder,
  FavouritePhoto,
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
  const [scannedPaths, setScannedPaths] = useState<Set<string>>(new Set());
  const [favourites, setFavourites] = useState<FavouriteFolder[]>([]);

  // Favourite photos state
  const [favouritePhotos, setFavouritePhotos] = useState<Map<string, number>>(
    new Map()
  );
  const [showFavouritesOnly, setShowFavouritesOnly] = useState(false);

  // Derive date sections from groups + sort order
  const dateSections = useMemo(
    () => groupByDate(groups, sortOrder),
    [groups, sortOrder]
  );

  // Apply favourites filter when showFavouritesOnly is enabled
  const displaySections = useMemo(() => {
    if (!showFavouritesOnly) return dateSections;

    return dateSections
      .map((section) => {
        const filteredGroups = section.groups
          .map((group) => {
            const favImages = group.images.filter((img) =>
              favouritePhotos.has(img.path)
            );
            if (favImages.length === 0) return null;
            return {
              ...group,
              images: favImages,
              count: favImages.length,
            };
          })
          .filter((g): g is BurstGroup => g !== null);

        if (filteredGroups.length === 0) return null;

        return {
          ...section,
          groups: filteredGroups,
          totalPhotos: filteredGroups.reduce((sum, g) => sum + g.count, 0),
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
  }, [dateSections, showFavouritesOnly, favouritePhotos]);

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

  // Load favourite photos on mount
  useEffect(() => {
    async function loadFavPhotos() {
      try {
        const favPhotos = await invoke<FavouritePhoto[]>(
          "load_favourite_photos"
        );
        const map = new Map<string, number>();
        for (const fp of favPhotos) {
          map.set(fp.path, fp.favourited_at);
        }
        setFavouritePhotos(map);
      } catch (err) {
        console.error("Failed to load favourite photos:", err);
      }
    }
    loadFavPhotos();
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
      setScannedPaths((prev) => new Set(prev).add(path));
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

  const toggleFavouritePhoto = useCallback(
    async (path: string) => {
      const newMap = new Map(favouritePhotos);
      if (newMap.has(path)) {
        newMap.delete(path);
      } else {
        newMap.set(path, Date.now());
      }
      setFavouritePhotos(newMap);

      // Persist
      const favourites_list: FavouritePhoto[] = Array.from(
        newMap.entries()
      ).map(([p, ts]) => ({ path: p, favourited_at: ts }));

      try {
        await invoke("save_favourite_photos", { favourites: favourites_list });
      } catch (err) {
        console.error("Failed to save favourite photos:", err);
      }
    },
    [favouritePhotos]
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

  // When filter is active and viewing a group, filter the group's images
  const displaySelectedGroup = useMemo(() => {
    if (!selectedGroup) return null;
    if (!showFavouritesOnly) return selectedGroup;

    const favImages = selectedGroup.images.filter((img) =>
      favouritePhotos.has(img.path)
    );
    return {
      ...selectedGroup,
      images: favImages,
      count: favImages.length,
    };
  }, [selectedGroup, showFavouritesOnly, favouritePhotos]);

  const getPreviewContext = () => {
    if (!previewImages) return null;
    // Use the display group (filtered or not) for preview context
    const sourceGroup = showFavouritesOnly
      ? displaySections
          .flatMap((s) => s.groups)
          .find((g) => g.id === previewImages.groupId)
      : groups.find((g) => g.id === previewImages.groupId);
    if (!sourceGroup) return null;
    return {
      images: sourceGroup.images,
      currentIndex: previewImages.imageIndex,
    };
  };

  const previewContext = getPreviewContext();

  return (
    <div className="h-screen flex flex-col">
      <h1 className="sr-only">Photo Explorer</h1>

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
          scannedPaths={scannedPaths}
        />

        {/* Main content area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!loading && groups.length > 0 && viewMode === "groups" && (
            <Toolbar
              sortOrder={sortOrder}
              onSortOrderChange={setSortOrder}
              totalImages={totalImages}
              totalGroups={groups.length}
              showFavouritesOnly={showFavouritesOnly}
              onToggleShowFavourites={() =>
                setShowFavouritesOnly((v) => !v)
              }
            />
          )}

          {loading && <LoadingOverlay />}

          {!loading && viewMode === "groups" && (
            <BurstGrid
              sections={displaySections}
              onGroupClick={handleGroupClick}
              onImageClick={handleImageClick}
              favouritePhotos={favouritePhotos}
            />
          )}

          {!loading &&
            viewMode === "group-detail" &&
            displaySelectedGroup && (
              <GroupView
                group={displaySelectedGroup}
                onBack={handleBackToGroups}
                onImageClick={(idx) =>
                  handleImageClick(displaySelectedGroup.id, idx)
                }
                favouritePhotos={favouritePhotos}
                onToggleFavourite={toggleFavouritePhoto}
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
          favouritePhotos={favouritePhotos}
          onToggleFavourite={toggleFavouritePhoto}
        />
      )}
    </div>
  );
}

export default App;
