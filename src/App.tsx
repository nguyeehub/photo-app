import { useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { BurstGroup, ScanResult, ViewMode } from "./types";
import { DirectoryPicker } from "./components/DirectoryPicker";
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
  const [previewImages, setPreviewImages] = useState<
    { groupId: number; imageIndex: number } | null
  >(null);

  const handleDirectorySelected = useCallback(async (path: string) => {
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

  // Get the images for the current preview context
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
      <DirectoryPicker
        directory={directory}
        loading={loading}
        totalImages={totalImages}
        onDirectorySelected={handleDirectorySelected}
      />

      {loading && <LoadingOverlay />}

      {!loading && viewMode === "groups" && (
        <BurstGrid
          groups={groups}
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
