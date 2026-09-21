import React, { useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { triggerAutosave, deleteAsset, uploadAsset } from "@/store/thunks";
import { addAssetToTimeline, addOptimisticAsset, removeOptimisticAsset } from "@/store/editorSlice";
import { addToast } from "@/store/uiSlice";
import { getMediaUrl } from "@/lib/api";
import { downloadMediaFile } from "@/lib/utils";
import { mediaManager } from "@/services/mediaManager";
import type { Asset } from "@/types";
import {
  Upload as UploadIcon,
  Layers,
  Radio,
  Search,
  Type as TypeIcon,
  QrCode,
  SlidersHorizontal,
  Square,
  Circle,
  Triangle,
  Play,
  Trash2,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  X,
  Film,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface AssetLibraryProps {
  activeRailTab?: "upload" | "elements" | "live";
  onRailTabChange?: (tab: "upload" | "elements" | "live") => void;
}

export function AssetLibrary({ activeRailTab: propsRailTab, onRailTabChange }: AssetLibraryProps) {
  const dispatch = useAppDispatch();
  const assets = useAppSelector((state) => state.editor.assets);
  const uploadingAssets = useAppSelector((state) => state.editor.uploadingAssets);
  const activeUploadsList = Object.values(uploadingAssets);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [internalRailTab, setInternalRailTab] = useState<"upload" | "elements" | "live">("upload");
  const activeRailTab = propsRailTab ?? internalRailTab;

  const handleRailClick = (tab: "upload" | "elements" | "live") => {
    setInternalRailTab(tab);
    if (onRailTabChange) onRailTabChange(tab);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<"All" | "Image" | "Video" | "Audio" | "Exports">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [assetToDelete, setAssetToDelete] = useState<Asset | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleRailUploadClick = () => {
    setInternalRailTab("upload");
    if (onRailTabChange) onRailTabChange("upload");
    fileInputRef.current?.click();
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (fileInputRef.current) fileInputRef.current.value = "";

    for (const file of files) {
      const localBlobUrl = URL.createObjectURL(file);
      const ext = file.name.split('.').pop()?.toLowerCase() || '';

      let type: "video" | "image" | "audio" = "video";
      if (file.type.startsWith("image/") || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext)) {
        type = "image";
      } else if (file.type.startsWith("audio/") || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext)) {
        type = "audio";
      }

      let duration = 10;
      if (type === "image") {
        duration = 5;
      } else {
        try {
          const media = document.createElement(type === "audio" ? "audio" : "video");
          media.preload = "metadata";
          media.src = localBlobUrl;
          await new Promise((res) => {
            media.onloadedmetadata = () => res(null);
            media.onerror = () => res(null);
            setTimeout(res, 1000);
          });
          if (media.duration && !isNaN(media.duration) && media.duration > 0) {
            duration = media.duration;
          }
        } catch {
          duration = 10;
        }
      }

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      mediaManager.registerLocalBlob(tempId, file);

      const optimisticAsset: Asset = {
        _id: tempId,
        original_url: localBlobUrl,
        preview_url: localBlobUrl,
        duration: duration,
        type: type,
        public_id: file.name,
      };

      // 1. Instantly display asset in library (0ms UI latency!)
      dispatch(addOptimisticAsset(optimisticAsset));

      // 2. Auto-switch filter tab so user sees asset immediately
      const cap = type.charAt(0).toUpperCase() + type.slice(1);
      if (["Image", "Video", "Audio"].includes(cap)) {
        setActiveFilterTab(cap as any);
      } else {
        setActiveFilterTab("All");
      }

      // 3. Background async upload to live server
      dispatch(uploadAsset({ file, tempId }));
    }
  };

  const handleAddToTimeline = (asset: Asset) => {
    const uploadItem = uploadingAssets[asset._id];
    if (uploadItem && (uploadItem.status === "uploading" || uploadItem.status === "processing")) {
      dispatch(
        addToast({
          type: "info",
          message: `"${asset.public_id || "Video"}" is uploading in background (${uploadItem.progress}%). It will be saved automatically.`,
        })
      );
    }
    dispatch(addAssetToTimeline({ asset }));
    dispatch(triggerAutosave());
  };

  const handleDeleteClick = (e: React.MouseEvent, asset: Asset) => {
    e.stopPropagation();
    setAssetToDelete(asset);
  };

  const handleConfirmDelete = async () => {
    if (!assetToDelete) return;
    setIsDeleting(true);
    try {
      const filename = assetToDelete.public_id || "Media file";
      await dispatch(deleteAsset(assetToDelete._id)).unwrap();
      dispatch(addToast({ type: "success", message: `Successfully deleted "${filename}".` }));
    } catch (err) {
      console.error("Delete failed:", err);
      dispatch(addToast({ type: "error", message: "Failed to delete file from server." }));
    } finally {
      setIsDeleting(false);
      setAssetToDelete(null);
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesFilter =
      activeFilterTab === "All"
        ? true
        : activeFilterTab === "Exports"
        ? asset.type.toLowerCase() === "export"
        : asset.type.toLowerCase() === activeFilterTab.toLowerCase();
    const matchesSearch =
      !searchQuery ||
      (asset.public_id || asset.original_url).toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleAddText = () => {
    const textAsset: Asset = {
      _id: `text_${Date.now()}`,
      original_url: "",
      preview_url: "",
      duration: 5,
      type: "text",
      content: "Title Goes There",
      public_id: `Text Element`,
    };
    dispatch(addAssetToTimeline({ asset: textAsset }));
    dispatch(triggerAutosave());
  };

  const handleAddQR = () => {
    const qrAsset: Asset = {
      _id: `qr_${Date.now()}`,
      original_url: "",
      preview_url: "",
      duration: 5,
      type: "qr",
      content: "https://example.com",
      public_id: `QR Code`,
    };
    dispatch(addAssetToTimeline({ asset: qrAsset }));
    dispatch(triggerAutosave());
  };

  const handleAddSlider = () => {
    const sliderAsset: Asset = {
      _id: `slider_${Date.now()}`,
      original_url: "",
      preview_url: "",
      duration: 5,
      type: "slider",
      content: "Slider Widget",
      public_id: `Slider Widget`,
    };
    dispatch(addAssetToTimeline({ asset: sliderAsset }));
    dispatch(triggerAutosave());
  };

  const handleAddShape = (shapeName: string) => {
    const shapeAsset: Asset = {
      _id: `shape_${shapeName}_${Date.now()}`,
      original_url: "",
      preview_url: "",
      duration: 5,
      type: "shape",
      content: shapeName,
      public_id: `${shapeName} Shape`,
    };
    dispatch(addAssetToTimeline({ asset: shapeAsset }));
    dispatch(triggerAutosave());
  };

  return (
    <div className="relative shrink-0 flex h-full z-20">
      {/* Vertical Edge Toggle Tab Button matching media_1789287491321.png */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand Asset Library" : "Collapse Asset Library"}
        className="absolute top-1/2 -translate-y-1/2 -right-4 z-40 w-4 h-14 bg-white dark:bg-slate-900 border border-l-0 border-slate-200 dark:border-slate-800 rounded-r-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shadow-md cursor-pointer transition-colors"
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Asset Library Panel Body */}
      <div
        className={`transition-all duration-300 ease-in-out h-full bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 shadow-lg text-slate-800 dark:text-slate-100 select-none flex overflow-hidden ${
          isCollapsed ? "w-0 opacity-0 overflow-hidden border-r-0" : "w-80 opacity-100"
        }`}
      >
        {/* 1. Left Vertical Icon Rail */}
        <div className="w-16 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800/80 flex flex-col items-center py-4 gap-6 shrink-0 z-20">
          <button
            onClick={handleRailUploadClick}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeRailTab === "upload"
                ? "text-sky-500 font-semibold"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            <div
              className={`p-2.5 rounded-xl ${
                activeRailTab === "upload"
                  ? "bg-sky-50 dark:bg-sky-950/50 border border-sky-500/30"
                  : ""
              }`}
            >
              <UploadIcon className="w-5 h-5" />
            </div>
            <span className="text-[10px]">Upload</span>
          </button>

          <button
            onClick={() => handleRailClick("elements")}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeRailTab === "elements"
                ? "text-sky-500 font-semibold"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            <div
              className={`p-2.5 rounded-xl ${
                activeRailTab === "elements"
                  ? "bg-sky-50 dark:bg-sky-950/50 border border-sky-500/30"
                  : ""
              }`}
            >
              <Layers className="w-5 h-5" />
            </div>
            <span className="text-[10px]">Elements</span>
          </button>

          <button
            onClick={() => handleRailClick("live")}
            className={`flex flex-col items-center gap-1 transition-all cursor-pointer ${
              activeRailTab === "live"
                ? "text-sky-500 font-semibold"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            }`}
          >
            <div
              className={`p-2.5 rounded-xl ${
                activeRailTab === "live"
                  ? "bg-sky-50 dark:bg-sky-950/50 border border-sky-500/30"
                  : ""
              }`}
            >
              <Radio className="w-5 h-5" />
            </div>
            <span className="text-[10px]">Live</span>
          </button>
        </div>

        {/* 2. Secondary Panel Content */}
        <div className="w-64 flex flex-col h-full bg-white dark:bg-slate-950">
          {/* TAB 1: UPLOAD (My Resource) */}
          {activeRailTab === "upload" && (
            <div className="flex flex-col h-full">
              <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                    My Resource
                  </h2>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="bg-sky-500 hover:bg-sky-400 text-white font-medium py-1.5 px-4 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <UploadIcon className="w-3.5 h-3.5" />
                    <span>Upload</span>
                  </button>
                  <input
                    type="file"
                    accept="video/*,image/*,audio/*,.mp4,.webm,.mov,.avi,.mkv,.png,.jpg,.jpeg,.webp,.gif,.mp3,.wav,.ogg,.m4a,.aac"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleUpload}
                    multiple
                  />
                </div>

                {/* Search Device Input */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Search Device"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
                  />
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-4 text-xs font-medium border-b border-slate-100 dark:border-slate-800 pb-1 overflow-x-auto">
                  {(["All", "Image", "Video", "Audio", "Exports"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilterTab(tab)}
                      className={`pb-1 transition-colors relative cursor-pointer shrink-0 ${
                        activeFilterTab === tab
                          ? "text-sky-500 font-semibold"
                          : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                      }`}
                    >
                      {tab}
                      {activeFilterTab === tab && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-500 rounded-full" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Active Uploads Banner */}
              {activeUploadsList.length > 0 && (
                <div className="p-3 bg-sky-50/90 dark:bg-sky-950/40 border-b border-sky-100 dark:border-sky-900/50 flex flex-col gap-2">
                  {activeUploadsList.map((item) => (
                    <div key={item.tempId} className="flex flex-col gap-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {item.status === "completed" ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                          ) : item.status === "error" ? (
                            <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          ) : (
                            <Loader2 className="w-3.5 h-3.5 text-sky-500 animate-spin shrink-0" />
                          )}
                          <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                            {item.fileName}
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                          {item.status === "completed"
                            ? "Uploaded!"
                            : item.status === "error"
                            ? "Failed"
                            : item.status === "processing"
                            ? "Processing..."
                            : `${item.progress}%`}
                        </span>
                      </div>
                      {item.status !== "completed" && item.status !== "error" && (
                        <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-sky-500 h-full transition-all duration-200 rounded-full"
                            style={{ width: `${Math.max(5, item.progress)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Grid of Assets */}
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 auto-rows-max content-start">
                {filteredAssets.map((asset) => {
                  const uploadItem = uploadingAssets[asset._id];
                  const isUploading = Boolean(
                    uploadItem && (uploadItem.status === "uploading" || uploadItem.status === "processing")
                  );
                  const isCompleted = uploadItem?.status === "completed";
                  const isError = uploadItem?.status === "error";
                  const isTemp = asset._id.startsWith("temp_");
                  const isExport = asset.type === "export" || activeFilterTab === "Exports";
                  const canDownload =
                    asset.original_url &&
                    !asset.original_url.startsWith("blob:") &&
                    !isUploading &&
                    !isTemp;

                  return (
                    <div
                      key={asset._id}
                      draggable={!isUploading && !isTemp}
                      onDragStart={(e) => {
                        if (isUploading || isTemp) {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.setData("application/json", JSON.stringify(asset));
                        e.dataTransfer.effectAllowed = "copy";
                      }}
                      onClick={() => handleAddToTimeline(asset)}
                      className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md hover:border-sky-400 transition-all flex flex-col items-center h-auto self-start"
                    >
                      {/* Top Action Buttons: Download & Delete */}
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 z-30 opacity-0 group-hover:opacity-100 transition-opacity">
                        {canDownload && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const filename = asset.public_id || `video_${asset._id}.mp4`;
                              dispatch(addToast({ type: "info", message: `Downloading "${filename}"...` }));
                              await downloadMediaFile(asset.original_url, filename);
                            }}
                            className="bg-sky-500 text-white p-1 rounded-md hover:bg-sky-600 shadow-xs cursor-pointer"
                            title="Download Video File"
                          >
                            <Download className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          onClick={(e) => handleDeleteClick(e, asset)}
                          className="bg-red-500/90 text-white p-1 rounded-md hover:bg-red-600 shadow-xs cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>

                      <div className="w-full h-20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden shrink-0">
                        {/* Loading Overlay while video is uploading */}
                        {(isUploading || (isTemp && !isCompleted && !isError)) && (
                          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-xs z-25 flex flex-col items-center justify-center p-2 text-center select-none">
                            <Loader2 className="w-5 h-5 text-sky-400 animate-spin mb-1" />
                            <span className="text-[10px] font-bold text-white leading-tight">
                              {uploadItem?.status === "processing"
                                ? "Processing..."
                                : `Uploading ${uploadItem?.progress ?? 0}%`}
                            </span>
                            <div className="w-4/5 bg-slate-700/80 rounded-full h-1 mt-1.5 overflow-hidden">
                              <div
                                className="bg-gradient-to-r from-sky-400 to-blue-500 h-full transition-all duration-200 rounded-full"
                                style={{ width: `${Math.max(8, uploadItem?.progress ?? 5)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {isCompleted && (
                          <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs z-25 flex flex-col items-center justify-center p-2 text-center text-white">
                            <CheckCircle2 className="w-5 h-5 text-emerald-400 mb-1" />
                            <span className="text-[10px] font-bold text-emerald-200">Uploaded!</span>
                          </div>
                        )}

                        {isError && (
                          <div className="absolute inset-0 bg-rose-950/85 backdrop-blur-xs z-25 flex flex-col items-center justify-center p-2 text-center text-white">
                            <AlertCircle className="w-5 h-5 text-rose-400 mb-0.5" />
                            <span className="text-[10px] font-bold text-rose-200">Upload Failed</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                dispatch(removeOptimisticAsset(asset._id));
                              }}
                              className="mt-1 text-[9px] underline text-rose-300 hover:text-white cursor-pointer"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}

                        {asset.type === "video" || asset.type === "export" ? (
                          <>
                            <video
                              src={
                                mediaManager.getCachedBlobUrlSync(
                                  asset._id,
                                  getMediaUrl(asset.preview_url || asset.original_url)
                                ) || getMediaUrl(asset.preview_url || asset.original_url)
                              }
                              preload="metadata"
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                              <div className="w-7 h-7 rounded-full bg-white/90 text-slate-800 flex items-center justify-center shadow-md">
                                <Play className="w-3.5 h-3.5 fill-slate-800 ml-0.5" />
                              </div>
                            </div>
                          </>
                        ) : asset.type === "audio" ? (
                          /* Soundwave Bars visualizer */
                          <div className="flex items-center gap-1 h-10">
                            <span className="w-1 h-5 bg-sky-500 rounded-full animate-pulse" />
                            <span className="w-1 h-8 bg-sky-400 rounded-full animate-pulse" />
                            <span className="w-1 h-3 bg-sky-500 rounded-full" />
                            <span className="w-1 h-7 bg-sky-400 rounded-full animate-pulse" />
                            <span className="w-1 h-4 bg-sky-500 rounded-full" />
                          </div>
                        ) : asset.type === "image" ? (
                          <img
                            src={getMediaUrl(asset.preview_url || asset.original_url)}
                            alt="preview"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="p-2 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                            {asset.content || "Text"}
                          </div>
                        )}
                      </div>

                      <div className="p-2 w-full text-center shrink-0">
                        <span className="text-[10px] text-slate-600 dark:text-slate-400 font-medium truncate block">
                          {asset.public_id || asset.original_url.split("/").pop() || "Media"}
                        </span>

                        {/* Prominent Download button for Exported Videos */}
                        {isExport && canDownload && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              const filename = asset.public_id || `export_${Date.now()}.mp4`;
                              dispatch(addToast({ type: "info", message: `Downloading export "${filename}"...` }));
                              await downloadMediaFile(asset.original_url, filename);
                            }}
                            className="mt-1.5 w-full py-1 px-2 bg-sky-500 hover:bg-sky-400 text-white font-semibold text-[10px] rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer shadow-xs"
                            title="Download Exported Video"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredAssets.length === 0 && (
                  <div className="col-span-2 text-center py-10 text-xs text-slate-400">
                    No resources uploaded yet.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: ELEMENTS */}
          {activeRailTab === "elements" && (
            <div className="flex flex-col h-full p-4">
              <h2 className="font-bold text-base text-slate-900 dark:text-white tracking-tight mb-4">
                Elements
              </h2>
              <div className="grid grid-cols-3 gap-3">
                <button
                  onClick={handleAddText}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
                >
                  <TypeIcon className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Text</span>
                </button>

                <button
                  onClick={handleAddQR}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
                >
                  <QrCode className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">QR</span>
                </button>

                <button
                  onClick={handleAddSlider}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
                >
                  <SlidersHorizontal className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Slider</span>
                </button>

                <button
                  onClick={() => handleAddShape("Rectangle")}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
                >
                  <Square className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Rectangle</span>
                </button>

                <button
                  onClick={() => handleAddShape("Ellipses")}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
                >
                  <Circle className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Ellipses</span>
                </button>

                <button
                  onClick={() => handleAddShape("Triangle")}
                  className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
                >
                  <Triangle className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
                  <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">Triangle</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: LIVE (Realtime Widgets) */}
          {activeRailTab === "live" && (
            <div className="flex flex-col h-full p-4">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="font-bold text-base text-slate-900 dark:text-white tracking-tight">
                  Realtime Widgets
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700 font-semibold">
                  Beta
                </span>
              </div>
              <div className="text-xs text-slate-400 py-6">Coming Soon</div>
            </div>
          )}
        </div>
      </div>

      {/* Professional Delete Warning Modal */}
      {assetToDelete && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => !isDeleting && setAssetToDelete(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 max-w-sm w-full animate-in zoom-in-95 duration-150 flex flex-col items-center text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Close Button */}
            <button
              onClick={() => !isDeleting && setAssetToDelete(null)}
              disabled={isDeleting}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Warning Icon Badge */}
            <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-3 shadow-xs">
              <AlertTriangle className="w-6 h-6" />
            </div>

            {/* Title */}
            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
              {assetToDelete.type === "export"
                ? "Delete Exported Video?"
                : "Delete Media Asset?"}
            </h3>

            {/* Description */}
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 mb-4 leading-relaxed">
              {assetToDelete.type === "export"
                ? "This exported video will be permanently removed from your server storage. You will not be able to download or stream it again."
                : "Are you sure you want to delete this media file from your library? This action cannot be undone."}
            </p>

            {/* File Info Card */}
            <div className="w-full bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 mb-5 flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center relative border border-slate-200/60 dark:border-slate-700/60">
                {assetToDelete.type === "video" || assetToDelete.type === "export" ? (
                  <video
                    src={getMediaUrl(assetToDelete.preview_url || assetToDelete.original_url)}
                    className="w-full h-full object-cover"
                    preload="metadata"
                  />
                ) : assetToDelete.type === "image" ? (
                  <img
                    src={getMediaUrl(assetToDelete.preview_url || assetToDelete.original_url)}
                    alt="preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Film className="w-4 h-4 text-slate-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate block">
                  {assetToDelete.public_id || assetToDelete.original_url.split("/").pop() || "Video"}
                </span>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 dark:text-slate-500">
                  <span className="capitalize">{assetToDelete.type}</span>
                  {assetToDelete.duration && (
                    <>
                      <span>•</span>
                      <span>{Math.round(assetToDelete.duration)}s</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setAssetToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shadow-rose-500/20 disabled:opacity-60"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Video</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

export default AssetLibrary;
