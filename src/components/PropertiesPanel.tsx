import {
  addOptimisticAsset,
  deleteClip,
  duplicateClip,
  separateAudio,
  setCanvasAspectRatio,
  setPlayhead,
  setSelectedClip,
  togglePlay,
  updateClip,
} from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { triggerAutosave, uploadAsset } from "@/store/thunks";
import { getMediaUrl } from "@/lib/api";
import { animationLabel, clipAnimations, findNextAbutting, findPrevAbutting, TRANSITIONS, transitionLabel } from "@/lib/motion";
import type {
  AnimationCategory,
  AspectRatioType,
  Asset,
  Clip,
  QrStyles,
  ShapeStyles,
  SliderStyles,
  TextStyles,
  TransformProps,
  TransitionKind,
} from "@/types";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Copy,
  Move,
  Music,
  Plus,
  QrCode as QrIcon,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Type,
  Volume2,
} from "lucide-react";
import { useRef, useState } from "react";
import CommonSelect from "./shared/CommonSelect";
import { AnimationModal } from "./AnimationModal";
import { SelectLayoutModal } from "./SelectLayoutModal";

export function PropertiesPanel() {
  const dispatch = useAppDispatch();
  const { selectedClipId, sceneGraph, isPlaying, assets } = useAppSelector((s) => s.editor);
  const imageAssets = assets.filter((asset) => asset.type === "image");

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAnimationModalOpen, setIsAnimationModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<AnimationCategory>("enter");
  const slideFileRef = useRef<HTMLInputElement>(null);
  const [currentLayout, setCurrentLayout] = useState("2:1 Horizontal");

  const currentAspectRatio: AspectRatioType = sceneGraph?.aspectRatio || "16:9";

  const handleAspectRatioChange = (ratio: AspectRatioType) => {
    dispatch(setCanvasAspectRatio(ratio));
    dispatch(triggerAutosave());
  };

  let selectedClip: Clip | null = null;
  let selectedTrackId = "";
  if (sceneGraph && selectedClipId) {
    for (const track of sceneGraph.tracks) {
      const clip = track.clips.find((c) => c.id === selectedClipId);
      if (clip) {
        selectedClip = clip;
        selectedTrackId = track.id;
        break;
      }
    }
  }

  // Local sync state
  const transform = selectedClip?.transform || {};
  const textStyles = selectedClip?.textStyles || {};
  const shapeStyles = selectedClip?.shapeStyles || {};
  const qrStyles = selectedClip?.qrStyles || {};
  const sliderStyles = selectedClip?.sliderStyles || {};
  const animationSlots = selectedClip ? clipAnimations(selectedClip) : {};

  const handleUpdateTransform = (updates: Partial<TransformProps>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newTransform = { ...(selectedClip.transform || {}), ...updates };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { transform: newTransform },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleUpdateTextStyles = (updates: Partial<TextStyles>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newStyles = { ...(selectedClip.textStyles || {}), ...updates };
    const newAsset = {
      ...selectedClip.asset,
      content: updates.content ?? selectedClip.asset.content,
    };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { textStyles: newStyles, asset: newAsset },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleUpdateShapeStyles = (updates: Partial<ShapeStyles>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newStyles = { ...(selectedClip.shapeStyles || {}), ...updates };
    const newAsset = {
      ...selectedClip.asset,
      content: updates.shapeType ?? selectedClip.asset.content,
    };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { shapeStyles: newStyles, asset: newAsset },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleUpdateQrStyles = (updates: Partial<QrStyles>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newStyles = { ...(selectedClip.qrStyles || {}), ...updates };
    const newAsset = {
      ...selectedClip.asset,
      content: updates.qrContent ?? selectedClip.asset.content,
    };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { qrStyles: newStyles, asset: newAsset },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleUpdateSliderStyles = (updates: Partial<SliderStyles>) => {
    if (!selectedClip || !selectedTrackId) return;
    const newStyles = { ...(selectedClip.sliderStyles || {}), ...updates };
    const count = Math.max(1, newStyles.images?.length || 3);
    const needed = count * (newStyles.slideDuration || 2.5);
    const length = selectedClip.endTime - selectedClip.startTime;
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: {
          sliderStyles: newStyles,
          ...(length < needed
            ? { endTime: selectedClip.startTime + needed, trimOut: needed }
            : {}),
        },
      }),
    );
    dispatch(triggerAutosave());
    if (updates.transition && selectedClip) {
      const duration = newStyles.slideDuration || 2.5;
      const blend = Math.min(0.9, Math.max(0.45, duration * 0.42));
      const endTime = Math.max(selectedClip.endTime, selectedClip.startTime + needed);
      const at = Math.min(endTime - 0.05, selectedClip.startTime + Math.max(0, duration - blend));
      if (!isPlaying) dispatch(togglePlay());
      dispatch(setPlayhead(Math.max(selectedClip.startTime, at)));
    }
  };

  const playSliderFrom = (time: number) => {
    if (!isPlaying) dispatch(togglePlay());
    dispatch(setPlayhead(time));
  };

  const handleAddSlidePhotos = (files: File[]) => {
    if (!selectedClip || !files.length) return;
    const urls: string[] = [];
    files.forEach((file) => {
      if (!file.type.startsWith("image/")) return;
      const blobUrl = URL.createObjectURL(file);
      const tempId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      urls.push(blobUrl);
      const optimistic: Asset = {
        _id: tempId,
        original_url: blobUrl,
        preview_url: blobUrl,
        duration: 5,
        type: "image",
        public_id: file.name,
      };
      dispatch(addOptimisticAsset(optimistic));
      dispatch(uploadAsset({ file, tempId }));
    });
    if (!urls.length) return;
    const images = [...(selectedClip.sliderStyles?.images || []), ...urls];
    handleUpdateSliderStyles({ images });
    playSliderFrom(selectedClip.startTime);
  };

  const moveSlide = (index: number, direction: -1 | 1) => {
    const images = [...(sliderStyles.images || [])];
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const [item] = images.splice(index, 1);
    images.splice(target, 0, item);
    handleUpdateSliderStyles({ images });
  };

  const handleUpdateAnimation = (
    anim: { category: AnimationCategory; type: string; duration: number },
  ) => {
    if (!selectedClip || !selectedTrackId) return;
    const current = clipAnimations(selectedClip);
    const next = { ...current };
    if (!anim.type) delete next[anim.category];
    else next[anim.category] = { type: anim.type, category: anim.category, duration: anim.duration };
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: { animations: next, animation: undefined },
      }),
    );
    if (anim.type) {
      const start = selectedClip.startTime;
      const end = selectedClip.endTime;
      const at =
        anim.category === "exit"
          ? Math.max(start, end - anim.duration)
          : anim.category === "emphasis"
            ? Math.max(start, (start + end) / 2 - anim.duration / 2)
            : start;
      if (!isPlaying) dispatch(togglePlay());
      dispatch(setPlayhead(Math.min(end, Math.max(start, at))));
    }
    dispatch(triggerAutosave());
  };

  const handleAnimationDuration = (category: AnimationCategory, duration: number) => {
    if (!selectedClip || !selectedTrackId) return;
    const current = clipAnimations(selectedClip);
    const slot = current[category];
    if (!slot?.type) return;
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: {
          animations: { ...current, [category]: { ...slot, duration } },
          animation: undefined,
        },
      }),
    );
    dispatch(triggerAutosave());
  };

  const nextCut = sceneGraph && selectedClip ? findNextAbutting(sceneGraph, selectedClip) : null;
  const prevCut = sceneGraph && selectedClip ? findPrevAbutting(sceneGraph, selectedClip) : null;
  const transitionClip = nextCut ? selectedClip : prevCut;
  const transitionTrackId =
    sceneGraph && transitionClip
      ? sceneGraph.tracks.find((track) => track.clips.some((clip) => clip.id === transitionClip.id))?.id
      : undefined;

  const handleTransition = (type: TransitionKind, duration?: number) => {
    if (!transitionClip || !transitionTrackId) return;
    dispatch(
      updateClip({
        trackId: transitionTrackId,
        clipId: transitionClip.id,
        updates: {
          transitionOut: {
            type,
            duration: duration ?? transitionClip.transitionOut?.duration ?? 0.8,
          },
        },
      }),
    );
    if (duration === undefined && type !== "none") {
      const span = transitionClip.transitionOut?.duration ?? 0.8;
      dispatch(setPlayhead(Math.max(0, transitionClip.endTime - span * 0.15)));
    }
    dispatch(triggerAutosave());
  };

  const handleVolumeChange = (newVolume: number) => {
    if (selectedClip && selectedTrackId) {
      dispatch(
        updateClip({
          trackId: selectedTrackId,
          clipId: selectedClip.id,
          updates: { volume: newVolume, muted: newVolume === 0 },
        }),
      );
      dispatch(triggerAutosave());
    }
  };

  const handleDuplicate = () => {
    if (!selectedClip) return;
    dispatch(duplicateClip(selectedClip.id));
    dispatch(triggerAutosave());
  };

  const handleDelete = () => {
    if (!selectedClip) return;
    dispatch(deleteClip(selectedClip.id));
    dispatch(setSelectedClip(null));
    dispatch(triggerAutosave());
  };

  const handleShiftRight = () => {
    if (!selectedClip || !selectedTrackId) return;
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: {
          startTime: selectedClip.startTime + 1,
          endTime: selectedClip.endTime + 1,
        },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleShiftLeft = () => {
    if (!selectedClip || !selectedTrackId) return;
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: {
          startTime: Math.max(0, selectedClip.startTime - 1),
          endTime: Math.max(1, selectedClip.endTime - 1),
        },
      }),
    );
    dispatch(triggerAutosave());
  };

  const handleSeparateSound = () => {
    if (!selectedClip) return;
    dispatch(separateAudio({ clipId: selectedClip.id }));
    dispatch(triggerAutosave());
  };

  if (!selectedClip) {
    return (
      <div className="relative shrink-0 flex h-full z-20">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={
            isCollapsed
              ? "Expand Properties Panel"
              : "Collapse Properties Panel"
          }
          className="absolute top-1/2 -translate-y-1/2 -left-4 z-40 w-4 h-14 bg-white dark:bg-slate-900 border border-r-0 border-slate-200 dark:border-slate-800 rounded-l-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shadow-md cursor-pointer transition-colors"
        >
          {isCollapsed ? (
            <ChevronLeft className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        <div
          className={`transition-all duration-300 ease-in-out h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-lg text-slate-800 dark:text-slate-100 select-none flex flex-col overflow-y-auto ${
            isCollapsed
              ? "w-0 opacity-0 overflow-hidden border-l-0"
              : "w-80 opacity-100 p-4"
          }`}
        >
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Canvas Properties
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Select any element on canvas or timeline to customize properties.
            </p>
          </div>

          <div className="pt-4 space-y-4 text-xs">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Aspect Ratio</span>
                <span className="text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-slate-850 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-800">
                  {sceneGraph?.resolution ? `${sceneGraph.resolution.w} × ${sceneGraph.resolution.h}` : "960 × 540"}
                </span>
              </div>

              <CommonSelect
                value={currentAspectRatio}
                onValueChange={(val) => handleAspectRatioChange(val as AspectRatioType)}
                options={[
                  {
                    value: "16:9",
                    label: "16:9 • Widescreen (Landscape • 960×540)",
                  },
                  {
                    value: "9:16",
                    label: "9:16 • Portrait / Vertical (Reels / TikTok • 304×540)",
                  },
                  {
                    value: "1:1",
                    label: "1:1 • Square (Instagram / Post • 540×540)",
                  },
                  {
                    value: "4:3",
                    label: "4:3 • Standard (Classic / Tablet • 720×540)",
                  },
                  {
                    value: "21:9",
                    label: "21:9 • Ultrawide (Cinematic • 960×411)",
                  },
                ]}
              />

              {/* Quick Select Preset Buttons */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {[
                  { id: "16:9" as AspectRatioType, name: "16:9", dims: "Landscape" },
                  { id: "9:16" as AspectRatioType, name: "9:16", dims: "Portrait" },
                  { id: "1:1" as AspectRatioType, name: "1:1", dims: "Square" },
                  { id: "4:3" as AspectRatioType, name: "4:3", dims: "Classic" },
                  { id: "21:9" as AspectRatioType, name: "21:9", dims: "Ultrawide" },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => handleAspectRatioChange(preset.id)}
                    className={`flex flex-col items-center justify-center p-1.5 rounded-lg border text-center transition-all cursor-pointer ${
                      currentAspectRatio === preset.id
                        ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300 font-bold shadow-xs"
                        : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-700"
                    }`}
                    title={`${preset.name} (${preset.dims})`}
                  >
                    <div
                      className={`border rounded-xs mb-1 transition-colors ${
                        currentAspectRatio === preset.id
                          ? "border-sky-500 bg-sky-400/20"
                          : "border-slate-400 dark:border-slate-600 bg-slate-200/50 dark:bg-slate-800"
                      }`}
                      style={{
                        width: preset.id === "9:16" ? "8px" : preset.id === "21:9" ? "18px" : preset.id === "16:9" ? "16px" : preset.id === "4:3" ? "13px" : "11px",
                        height: preset.id === "9:16" ? "16px" : preset.id === "21:9" ? "8px" : preset.id === "16:9" ? "9px" : preset.id === "4:3" ? "10px" : "11px",
                      }}
                    />
                    <span className="text-[10px] leading-tight">{preset.name}</span>
                    <span className="text-[8px] opacity-60 leading-tight scale-90">{preset.dims}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-medium">
                Timeline Duration
              </span>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono font-semibold text-slate-700 dark:text-slate-200">
                {(sceneGraph?.duration ?? 0).toFixed(1)}s
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-medium">Active Tracks</span>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200">
                {sceneGraph?.tracks.length || 0} Tracks Active
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const clipType = selectedClip.asset?.type || "video";
  const contentName =
    selectedClip.asset?.content || selectedClip.asset?.public_id || "Element";

  return (
    <div className="relative shrink-0 flex h-full z-20">
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={
          isCollapsed ? "Expand Properties Panel" : "Collapse Properties Panel"
        }
        className="absolute top-1/2 -translate-y-1/2 -left-4 z-40 w-4 h-14 bg-white dark:bg-slate-900 border border-r-0 border-slate-200 dark:border-slate-800 rounded-l-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shadow-md cursor-pointer transition-colors"
      >
        {isCollapsed ? (
          <ChevronLeft className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      <div
        className={`transition-all duration-300 ease-in-out h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-lg text-slate-800 dark:text-slate-100 select-none flex flex-col overflow-y-auto ${
          isCollapsed
            ? "w-0 opacity-0 overflow-hidden border-l-0"
            : "w-80 opacity-100"
        }`}
      >
        {/* 1. Header Title */}
        <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {clipType === "text" && (
              <Type className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            {clipType === "qr" && (
              <QrIcon className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            {clipType === "shape" && (
              <Square className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            {clipType === "slider" && (
              <SlidersHorizontal className="w-4 h-4 text-sky-500 shrink-0" />
            )}
            <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
              {contentName}
            </h3>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 uppercase font-bold tracking-wider">
            {clipType}
          </span>
        </div>

        {/* 2. Quick Action Toolbar Grid */}
        <div className="p-3 border-b border-slate-100 dark:border-slate-800/80 grid grid-cols-5 gap-1.5">
          <button
            onClick={handleDuplicate}
            title="Duplicate Element"
            className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>

          {clipType === "video" && (
            <button
              onClick={handleSeparateSound}
              title="Separate Sound"
              className="flex items-center justify-center p-2 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-sky-500 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer"
            >
              <Music className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={handleShiftLeft}
            title="Shift Left (1s)"
            className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleShiftRight}
            title="Shift Right (1s)"
            className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDelete}
            title="Delete Element"
            className="flex items-center justify-center p-2 rounded-xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* 3. Form Inspectors */}
        <div className="p-4 space-y-5 flex-1">
          {/* A. TEXT INSPECTOR */}
          {clipType === "text" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Text Content
                </label>
                <textarea
                  rows={2}
                  value={
                    textStyles.content ??
                    selectedClip.asset?.content ??
                    "Title Goes There"
                  }
                  onChange={(e) =>
                    handleUpdateTextStyles({ content: e.target.value })
                  }
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Text Color
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={textStyles.color || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateTextStyles({ color: e.target.value })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={textStyles.color || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateTextStyles({ color: e.target.value })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Background
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={textStyles.backgroundColor || ""}
                      placeholder="None"
                      onChange={(e) =>
                        handleUpdateTextStyles({
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={textStyles.backgroundColor || "#000000"}
                      onChange={(e) =>
                        handleUpdateTextStyles({
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Font Family
                  </label>
                  <CommonSelect
                    value={textStyles.fontFamily || "Inter"}
                    onValueChange={(val) =>
                      handleUpdateTextStyles({ fontFamily: val })
                    }
                    options={[
                      { value: "Inter", label: "Inter" },
                      { value: "Roboto", label: "Roboto" },
                      { value: "Poppins", label: "Poppins" },
                      { value: "Arial", label: "Arial" },
                      { value: "Impact", label: "Impact" },
                      { value: "Georgia", label: "Georgia" },
                      { value: "Courier New", label: "Courier New" },
                    ]}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Font Weight
                  </label>
                  <CommonSelect
                    value={textStyles.fontWeight || "Bold"}
                    onValueChange={(val) =>
                      handleUpdateTextStyles({ fontWeight: val })
                    }
                    options={[
                      { value: "Normal", label: "Normal" },
                      { value: "Medium", label: "Medium" },
                      { value: "SemiBold", label: "SemiBold" },
                      { value: "Bold", label: "Bold" },
                    ]}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Align
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      ["left", AlignLeft],
                      ["center", AlignCenter],
                      ["right", AlignRight],
                    ] as const
                  ).map(([align, Icon]) => (
                    <button
                      key={align}
                      onClick={() => handleUpdateTextStyles({ align })}
                      className={`flex items-center justify-center rounded-lg border py-1.5 cursor-pointer ${
                        (textStyles.align || "center") === align
                          ? "border-sky-500 bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-300"
                          : "border-slate-200 text-slate-500 dark:border-slate-800"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Font Size</span>
                  <span>{textStyles.fontSize || 36}px</span>
                </div>
                <input
                  type="range"
                  min={12}
                  max={120}
                  value={textStyles.fontSize || 36}
                  onChange={(e) =>
                    handleUpdateTextStyles({
                      fontSize: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* B. QR CODE INSPECTOR */}
          {clipType === "qr" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  QR Target URL / Text
                </label>
                <input
                  type="text"
                  value={
                    qrStyles.qrContent ||
                    selectedClip.asset?.content ||
                    "https://example.com"
                  }
                  onChange={(e) =>
                    handleUpdateQrStyles({ qrContent: e.target.value })
                  }
                  placeholder="https://mysite.com"
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    QR Modules Color
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={qrStyles.foregroundColor || "#000000"}
                      onChange={(e) =>
                        handleUpdateQrStyles({
                          foregroundColor: e.target.value,
                        })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={qrStyles.foregroundColor || "#000000"}
                      onChange={(e) =>
                        handleUpdateQrStyles({
                          foregroundColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Background
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={qrStyles.backgroundColor || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateQrStyles({
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={qrStyles.backgroundColor || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateQrStyles({
                          backgroundColor: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* C. SHAPE INSPECTOR */}
          {clipType === "shape" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Shape Type
                </label>
                <CommonSelect
                  value={
                    shapeStyles.shapeType ||
                    (selectedClip.asset?.content as any) ||
                    "Rectangle"
                  }
                  onValueChange={(val) =>
                    handleUpdateShapeStyles({
                      shapeType: val as any,
                    })
                  }
                  options={[
                    { value: "Rectangle", label: "Rectangle" },
                    { value: "Ellipses", label: "Ellipse / Circle" },
                    { value: "Triangle", label: "Triangle" },
                    { value: "Star", label: "Star" },
                    { value: "Line", label: "Line" },
                  ]}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fill Color
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={shapeStyles.fillColor || "#38bdf8"}
                      onChange={(e) =>
                        handleUpdateShapeStyles({ fillColor: e.target.value })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={shapeStyles.fillColor || "#38bdf8"}
                      onChange={(e) =>
                        handleUpdateShapeStyles({ fillColor: e.target.value })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Stroke Color
                  </label>
                  <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                    <input
                      type="text"
                      value={shapeStyles.strokeColor || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateShapeStyles({ strokeColor: e.target.value })
                      }
                      className="w-full text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                    />
                    <input
                      type="color"
                      value={shapeStyles.strokeColor || "#ffffff"}
                      onChange={(e) =>
                        handleUpdateShapeStyles({ strokeColor: e.target.value })
                      }
                      className="w-6 h-6 rounded border-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Stroke / Line Thickness</span>
                  <span>
                    {shapeStyles.strokeWidth ??
                      (shapeStyles.shapeType === "line" ||
                      (shapeStyles.shapeType as any) === "Line"
                        ? 4
                        : 0)}
                    px
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={40}
                  value={
                    shapeStyles.strokeWidth ??
                    (shapeStyles.shapeType === "line" ||
                    (shapeStyles.shapeType as any) === "Line"
                      ? 4
                      : 0)
                  }
                  onChange={(e) =>
                    handleUpdateShapeStyles({
                      strokeWidth: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              {String(shapeStyles.shapeType || selectedClip.asset?.content || "").toLowerCase() === "rectangle" && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span>Corner Radius</span>
                    <span>{shapeStyles.borderRadius ?? 12}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={80}
                    value={shapeStyles.borderRadius ?? 12}
                    onChange={(e) =>
                      handleUpdateShapeStyles({ borderRadius: parseInt(e.target.value) })
                    }
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}

          {/* D. SLIDER INSPECTOR */}
          {clipType === "slider" && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Slide Transition
                </label>
                <CommonSelect
                  value={sliderStyles.transition || "fade"}
                  onValueChange={(val) =>
                    handleUpdateSliderStyles({
                      transition: val as any,
                    })
                  }
                  options={[
                    { value: "fade", label: "Cross Fade" },
                    { value: "left", label: "Slide Left" },
                    { value: "right", label: "Slide Right" },
                    { value: "zoom", label: "Zoom" },
                  ]}
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                  <span>Slide Duration</span>
                  <span>{sliderStyles.slideDuration || 2.5}s</span>
                </div>
                <input
                  type="range"
                  min={0.5}
                  max={10}
                  step={0.5}
                  value={sliderStyles.slideDuration || 2.5}
                  onChange={(e) =>
                    handleUpdateSliderStyles({
                      slideDuration: parseFloat(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Photos {(sliderStyles.images || []).length > 0 ? `(${sliderStyles.images?.length})` : ""}
                  </label>
                  <button
                    onClick={() => slideFileRef.current?.click()}
                    className="px-2.5 py-1 rounded-lg border border-sky-400 bg-sky-50 text-[11px] font-medium text-sky-700 cursor-pointer"
                  >
                    Add photos
                  </button>
                  <input
                    ref={slideFileRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      handleAddSlidePhotos(Array.from(event.target.files || []));
                      event.target.value = "";
                    }}
                  />
                </div>
                {(sliderStyles.images || []).length === 0 && (
                  <p className="text-[11px] text-slate-400">
                    Add two or more photos. They play in order with the transition above. Press play to watch the sample slides.
                  </p>
                )}
                <div className="space-y-1.5">
                  {(sliderStyles.images || []).map((url, index) => (
                    <div key={`${url}-${index}`} className="flex items-center gap-2">
                      <img
                        src={getMediaUrl(url)}
                        alt=""
                        className="h-12 w-16 rounded-lg object-cover bg-slate-200 shrink-0"
                      />
                      <span className="text-[11px] text-slate-500 flex-1">Slide {index + 1}</span>
                      <button
                        onClick={() => moveSlide(index, -1)}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Move earlier"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveSlide(index, 1)}
                        className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Move later"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() =>
                          handleUpdateSliderStyles({
                            images: (sliderStyles.images || []).filter((_, item) => item !== index),
                          })
                        }
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Remove"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {imageAssets.length > 0 && (
                  <CommonSelect
                    value=""
                    placeholder="Add from library"
                    onValueChange={(val) => {
                      if (!val || !selectedClip) return;
                      handleUpdateSliderStyles({
                        images: [...(sliderStyles.images || []), val],
                      });
                      playSliderFrom(selectedClip.startTime);
                    }}
                    options={imageAssets.map((asset) => ({
                      value: asset.original_url || asset.preview_url || asset._id,
                      label: asset.public_id || "Image",
                    }))}
                  />
                )}
              </div>
            </div>
          )}

          {/* D. TRANSFORM / POSITION & SCALE INSPECTOR (All visual clips) */}
          {clipType !== "audio" && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Move className="w-3.5 h-3.5 text-sky-500" /> Transform &
                Position
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400">Position X</span>
                  <input
                    type="number"
                    value={transform.x ?? 0}
                    onChange={(e) =>
                      handleUpdateTransform({
                        x: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] text-slate-400">Position Y</span>
                  <input
                    type="number"
                    value={transform.y ?? 0}
                    onChange={(e) =>
                      handleUpdateTransform({
                        y: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Scale</span>
                  <span>{Math.round((transform.scale ?? 1.0) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={3.0}
                  step={0.05}
                  value={transform.scale ?? 1.0}
                  onChange={(e) =>
                    handleUpdateTransform({ scale: parseFloat(e.target.value) })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Rotation</span>
                  <span>{transform.rotation ?? 0}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  value={transform.rotation ?? 0}
                  onChange={(e) =>
                    handleUpdateTransform({
                      rotation: parseInt(e.target.value),
                    })
                  }
                  className="w-full accent-sky-500 cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* E. AUDIO / VIDEO VOLUME CONTROLS */}
          {(clipType === "video" || clipType === "audio") && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-sky-500" /> Volume
                </span>
                <span>
                  {selectedClip.volume !== undefined
                    ? selectedClip.volume
                    : 100}
                  %
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={
                  selectedClip.volume !== undefined ? selectedClip.volume : 100
                }
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>
          )}

          {/* F. ANIMATION PICKER */}
          {clipType !== "audio" && (
            <div className="space-y-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-sky-500" /> Animations
              </span>
              {(["enter", "emphasis", "exit"] as const).map((category) => {
                const slot = animationSlots[category];
                return (
                  <div key={category} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-slate-600 dark:text-slate-300 capitalize">
                        {category}
                        <span className="font-normal text-slate-400">
                          {" "}
                          {animationLabel(slot?.type)}
                        </span>
                      </span>
                      <button
                        onClick={() => {
                          setModalCategory(category);
                          setIsAnimationModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 text-[11px] font-medium text-slate-700 dark:text-slate-300 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Choose</span>
                      </button>
                    </div>
                    {slot?.type && (
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-slate-500 shrink-0">
                          {(slot.duration ?? 0.6).toFixed(1)}s
                        </span>
                        <input
                          type="range"
                          min={0.2}
                          max={2}
                          step={0.1}
                          value={slot.duration ?? 0.6}
                          onChange={(event) =>
                            handleAnimationDuration(category, parseFloat(event.target.value))
                          }
                          className="w-full accent-sky-500 cursor-pointer"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {clipType !== "audio" && transitionClip && (
            <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {nextCut ? "Transition to next clip" : "Transition from previous clip"}:{" "}
                <span className="font-normal text-slate-400">
                  {transitionLabel(transitionClip.transitionOut?.type)}
                </span>
              </span>
              <div className="grid grid-cols-2 gap-1.5">
                {TRANSITIONS.map((item) => {
                  const active = (transitionClip.transitionOut?.type || "none") === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleTransition(item.id)}
                      className={`px-2 py-1.5 rounded-lg border text-[11px] font-medium cursor-pointer ${
                        active
                          ? "border-sky-500 bg-sky-50 dark:bg-sky-950/40 text-sky-600 dark:text-sky-300"
                          : "border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-sky-400"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
              {(transitionClip.transitionOut?.type || "none") !== "none" && (
                <div className="flex items-center gap-3">
                  <span className="text-[11px] text-slate-500 shrink-0">
                    {(transitionClip.transitionOut?.duration ?? 0.8).toFixed(1)}s
                  </span>
                  <input
                    type="range"
                    min={0.2}
                    max={2}
                    step={0.1}
                    value={transitionClip.transitionOut?.duration ?? 0.8}
                    onChange={(event) =>
                      handleTransition(
                        transitionClip.transitionOut?.type || "crossfade",
                        parseFloat(event.target.value),
                      )
                    }
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modals */}
        <SelectLayoutModal
          isOpen={isLayoutModalOpen}
          onClose={() => setIsLayoutModalOpen(false)}
          onSelectLayout={(layoutId) => setCurrentLayout(layoutId)}
          currentLayout={currentLayout}
        />

        <AnimationModal
          isOpen={isAnimationModalOpen}
          onClose={() => setIsAnimationModalOpen(false)}
          onSelectAnimation={handleUpdateAnimation}
          initialCategory={modalCategory}
          selected={{
            enter: animationSlots.enter?.type,
            emphasis: animationSlots.emphasis?.type,
            exit: animationSlots.exit?.type,
          }}
          durations={{
            enter: animationSlots.enter?.duration ?? 0.6,
            emphasis: animationSlots.emphasis?.duration ?? 0.6,
            exit: animationSlots.exit?.duration ?? 0.6,
          }}
        />
      </div>
    </div>
  );
}

export default PropertiesPanel;
