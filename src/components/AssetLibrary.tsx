import React, { useState, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { triggerAutosave, deleteAsset, uploadAsset } from "@/store/thunks";
import { addAssetToTimeline } from "@/store/editorSlice";
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [internalRailTab, setInternalRailTab] = useState<"upload" | "elements" | "live">("upload");
  const activeRailTab = propsRailTab ?? internalRailTab;

  const handleRailClick = (tab: "upload" | "elements" | "live") => {
    setInternalRailTab(tab);
    if (onRailTabChange) onRailTabChange(tab);
  };

  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeFilterTab, setActiveFilterTab] = useState<"All" | "Image" | "Video" | "Audio">("All");
  const [searchQuery, setSearchQuery] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        await dispatch(uploadAsset(file)).unwrap();
      }
    } catch (error) {
      console.error("Upload failed", error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleAddToTimeline = (asset: Asset) => {
    dispatch(addAssetToTimeline({ asset }));
    dispatch(triggerAutosave());
  };

  const handleDelete = (e: React.MouseEvent, assetId: string) => {
    e.stopPropagation();
    if (confirm("Delete this asset from library?")) {
      dispatch(deleteAsset(assetId));
    }
  };

  const filteredAssets = assets.filter((asset) => {
    const matchesFilter =
      activeFilterTab === "All" || asset.type.toLowerCase() === activeFilterTab.toLowerCase();
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
      public_id: `text_${Date.now()}`,
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
      type: "image",
      content: "QR Code",
      public_id: `qr_${Date.now()}`,
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
      type: "image",
      content: "Slider Widget",
      public_id: `slider_${Date.now()}`,
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
      type: "image",
      content: shapeName,
      public_id: `shape_${shapeName}_${Date.now()}`,
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
            onClick={() => handleRailClick("upload")}
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
                    disabled={isUploading}
                    className="bg-sky-500 hover:bg-sky-400 text-white font-medium py-1.5 px-4 rounded-lg text-xs transition-all flex items-center gap-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <UploadIcon className="w-3.5 h-3.5" />
                    <span>{isUploading ? "Uploading..." : "Upload"}</span>
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
                <div className="flex items-center gap-4 text-xs font-medium border-b border-slate-100 dark:border-slate-800 pb-1">
                  {(["All", "Image", "Video", "Audio"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setActiveFilterTab(tab)}
                      className={`pb-1 transition-colors relative cursor-pointer ${
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

              {/* Grid of Assets */}
              <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 gap-3 auto-rows-max content-start">
                {filteredAssets.map((asset) => (
                  <div
                    key={asset._id}
                    draggable={true}
                    onDragStart={(e) => {
                      e.dataTransfer.setData("application/json", JSON.stringify(asset));
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    onClick={() => handleAddToTimeline(asset)}
                    className="group relative bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800/80 rounded-xl overflow-hidden cursor-grab active:cursor-grabbing hover:shadow-md hover:border-sky-400 transition-all flex flex-col items-center h-auto self-start"
                  >
                    <button
                      onClick={(e) => handleDelete(e, asset._id)}
                      className="absolute top-1.5 right-1.5 bg-red-500/90 text-white p-1 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 z-20 shadow-xs cursor-pointer"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>

                    <div className="w-full h-20 bg-slate-100 dark:bg-slate-800 flex items-center justify-center relative overflow-hidden shrink-0">
                      {asset.type === "video" ? (
                        <>
                          <video
                            src={asset.preview_url || asset.original_url}
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
                          src={asset.preview_url || asset.original_url}
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
                    </div>
                  </div>
                ))}

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
    </div>
  );
}

export default AssetLibrary;
