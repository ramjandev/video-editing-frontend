import { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { updateClip, setSelectedClip, deleteClip, separateAudio, duplicateClip } from "@/store/editorSlice";
import { triggerAutosave } from "@/store/thunks";
import { SelectLayoutModal } from "./SelectLayoutModal";
import { AnimationModal } from "./AnimationModal";
import {
  Copy,
  ArrowRight,
  ArrowLeft,
  Trash2,
  Edit2,
  Plus,
  X,
  Volume2,
  Music,
  Scissors,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
} from "lucide-react";

export function PropertiesPanel() {
  const dispatch = useAppDispatch();
  const selectedClipId = useAppSelector((s) => s.editor.selectedClipId);
  const sceneGraph = useAppSelector((s) => s.editor.sceneGraph);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLayoutModalOpen, setIsLayoutModalOpen] = useState(false);
  const [isAnimationModalOpen, setIsAnimationModalOpen] = useState(false);
  const [currentLayout, setCurrentLayout] = useState("2:1 Horizontal");
  const [currentAnimation, setCurrentAnimation] = useState<string | undefined>(undefined);

  // Inspector states
  const [textColor, setTextColor] = useState("#000000");
  const [textContent, setTextContent] = useState("Title Goes There");
  const [fontFamily, setFontFamily] = useState("Inter");
  const [fontSize, setFontSize] = useState(24);
  const [fontWeight, setFontWeight] = useState("Bold");
  const [volume, setVolume] = useState(75);
  const [freePosition, setFreePosition] = useState(false);
  const [fadeIn] = useState(1.5);
  const [fadeOut] = useState(1.5);
  const [slideImages, setSlideImages] = useState<string[]>([
    "Image.png",
    "Image.png",
    "Image.png",
    "Image.png",
  ]);

  let selectedClip: any = null;
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

  useEffect(() => {
    if (selectedClip) {
      setVolume(selectedClip.volume !== undefined ? selectedClip.volume : 100);
    }
  }, [selectedClip?.id, selectedClip?.volume]);

  if (!selectedClip) {
    return (
      <div className="relative shrink-0 flex h-full z-20">
        {/* Edge Toggle Tab Button matching media_1789286541012.png */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          title={isCollapsed ? "Expand Properties Panel" : "Collapse Properties Panel"}
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
            isCollapsed ? "w-0 opacity-0 overflow-hidden border-l-0" : "w-80 opacity-100 p-4"
          }`}
        >
          <div className="pb-4 border-b border-slate-100 dark:border-slate-800/80">
            <h3 className="font-bold text-base text-slate-900 dark:text-white">
              Canvas Properties
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Select any clip on the timeline to edit its specific properties.
            </p>
          </div>

          <div className="pt-4 space-y-4 text-xs">
            <div className="space-y-1">
              <span className="text-slate-500 font-medium">Aspect Ratio</span>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-semibold text-slate-700 dark:text-slate-200">
                16:9 Landscape (960 x 540)
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-medium">Total Timeline Duration</span>
              <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 font-mono font-semibold text-slate-700 dark:text-slate-200">
                {sceneGraph?.duration || 180}s
              </div>
            </div>

            <div className="space-y-1">
              <span className="text-slate-500 font-medium">Total Tracks</span>
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
  const clipTitle =
    clipType === "text"
      ? "Text"
      : clipType === "audio"
      ? "Audio.mp3"
      : selectedClip.asset?.content === "Slider Widget"
      ? "Slider"
      : selectedClip.asset?.public_id || "Video.mp4";

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    if (selectedClip && selectedTrackId) {
      dispatch(
        updateClip({
          trackId: selectedTrackId,
          clipId: selectedClip.id,
          updates: { volume: newVolume },
        })
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
    dispatch(deleteClip(selectedClip.id));
    dispatch(setSelectedClip(null));
    dispatch(triggerAutosave());
  };

  const handleShiftRight = () => {
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: {
          startTime: selectedClip.startTime + 1,
          endTime: selectedClip.endTime + 1,
        },
      })
    );
    dispatch(triggerAutosave());
  };

  const handleShiftLeft = () => {
    dispatch(
      updateClip({
        trackId: selectedTrackId,
        clipId: selectedClip.id,
        updates: {
          startTime: Math.max(0, selectedClip.startTime - 1),
          endTime: Math.max(1, selectedClip.endTime - 1),
        },
      })
    );
    dispatch(triggerAutosave());
  };

  const handleSeparateSound = () => {
    if (!selectedClip) return;
    dispatch(separateAudio({ clipId: selectedClip.id }));
    dispatch(triggerAutosave());
  };

  return (
    <div className="relative shrink-0 flex h-full z-20">
      {/* Vertical Edge Toggle Tab Button matching media_1789286541012.png */}
      <button
        onClick={() => setIsCollapsed(!isCollapsed)}
        title={isCollapsed ? "Expand Properties Panel" : "Collapse Properties Panel"}
        className="absolute top-1/2 -translate-y-1/2 -left-4 z-40 w-4 h-14 bg-white dark:bg-slate-900 border border-r-0 border-slate-200 dark:border-slate-800 rounded-l-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shadow-md cursor-pointer transition-colors"
      >
        {isCollapsed ? (
          <ChevronLeft className="w-3.5 h-3.5" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5" />
        )}
      </button>

      {/* Properties Sidebar Panel Body */}
      <div
        className={`transition-all duration-300 ease-in-out h-full bg-white dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-lg text-slate-800 dark:text-slate-100 select-none flex flex-col overflow-y-auto ${
          isCollapsed ? "w-0 opacity-0 overflow-hidden border-l-0" : "w-80 opacity-100"
        }`}
      >
      {/* 1. Header Title */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
        <h3 className="font-bold text-base text-slate-900 dark:text-white truncate">
          {clipTitle}
        </h3>
        <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer">
          <Edit2 className="w-4 h-4" />
        </button>
      </div>

      {/* 2. Quick Action Icon Grid */}
      <div className="p-4 border-b border-slate-100 dark:border-slate-800/80 grid grid-cols-5 gap-1.5">
        <button
          onClick={handleDuplicate}
          title="Duplicate"
          className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Copy className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleSeparateSound}
          title="Separate Sound from Video"
          className="flex items-center justify-center p-2 rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/40 text-sky-500 hover:bg-sky-100 dark:hover:bg-sky-900/60 transition-colors cursor-pointer"
        >
          <Music className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleShiftRight}
          title="Shift Right"
          className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ArrowRight className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleShiftLeft}
          title="Shift Left"
          className="flex items-center justify-center p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={handleDelete}
          title="Delete"
          className="flex items-center justify-center p-2 rounded-xl border border-red-200 dark:border-red-950 bg-red-50 dark:bg-red-950/40 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/60 transition-colors cursor-pointer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 3. Dynamic Form Inspectors */}
      <div className="p-4 space-y-5">
        {/* Layout Inspector (Page/Background) */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Layout
          </label>
          <button
            onClick={() => setIsLayoutModalOpen(true)}
            className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 cursor-pointer hover:border-sky-400"
          >
            <span>{currentLayout}</span>
            <ChevronDown className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Text Inspector (When clipType === "text") */}
        {clipType === "text" && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                <span>Text</span>
                <span className="text-slate-400 font-normal">?</span>
              </label>
              <textarea
                rows={3}
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Type Content"
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Text Color
              </label>
              <div className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900">
                <input
                  type="text"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="flex-1 px-2 text-xs font-mono bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none"
                />
                <input
                  type="color"
                  value={textColor}
                  onChange={(e) => setTextColor(e.target.value)}
                  className="w-6 h-6 rounded border-none cursor-pointer"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Font
              </label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
              >
                <option value="Inter">Inter</option>
                <option value="Roboto">Roboto</option>
                <option value="Poppins">Poppins</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Weight
                </label>
                <select
                  value={fontWeight}
                  onChange={(e) => setFontWeight(e.target.value)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                >
                  <option value="Regular">Regular</option>
                  <option value="Bold">Bold</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Font Size
                </label>
                <input
                  type="number"
                  value={fontSize}
                  onChange={(e) => setFontSize(parseInt(e.target.value) || 12)}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none"
                />
              </div>
            </div>
          </>
        )}

        {/* Video / Image Controls */}
        {(clipType === "video" || clipType === "image") && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Duration
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-200">
                <span>00:10:00</span>
                <span className="text-[10px] text-slate-400">hr:min:sec</span>
              </div>
            </div>

            {clipType === "video" && (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Volume2 className="w-4 h-4 text-slate-400" /> Volume
                    </span>
                    <span>{volume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={volume}
                    onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                    className="w-full accent-sky-500 cursor-pointer"
                  />
                </div>

                <div className="space-y-2 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>Audio Extraction</span>
                    <span className="text-[10px] text-sky-500 font-medium font-mono">Separate Sound</span>
                  </label>
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={handleSeparateSound}
                      className="w-full py-2 px-3 rounded-xl bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 border border-sky-200 dark:border-sky-800 text-sky-600 dark:text-sky-400 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Music className="w-4 h-4 text-sky-500" />
                      <span>Separate Sound (Full Video)</span>
                    </button>

                    <button
                      onClick={() => {
                        if (!selectedClip) return;
                        dispatch(separateAudio({ clipId: selectedClip.id, regionStart: selectedClip.startTime, regionEnd: selectedClip.endTime }));
                        dispatch(triggerAutosave());
                      }}
                      className="w-full py-2 px-3 rounded-xl bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                      <Scissors className="w-4 h-4 text-purple-500" />
                      <span>Separate Sound (Specific Region)</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between pt-1">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Free Position
              </span>
              <button
                onClick={() => setFreePosition(!freePosition)}
                className={`w-10 h-6 rounded-full p-1 transition-colors cursor-pointer ${
                  freePosition ? "bg-sky-500" : "bg-slate-200 dark:bg-slate-800"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    freePosition ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </>
        )}

        {/* Audio Controls */}
        {clipType === "audio" && (
          <>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Duration
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs font-mono text-slate-800 dark:text-slate-200">
                <span>00:10:00</span>
                <span className="text-[10px] text-slate-400">hr:min:sec</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-4 h-4 text-slate-400" /> Volume
                </span>
                <span>{volume}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
                className="w-full accent-sky-500 cursor-pointer"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Fade In
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200">
                <span>{fadeIn} s</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Fade Out
              </label>
              <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200">
                <span>{fadeOut} s</span>
              </div>
            </div>
          </>
        )}

        {/* Slider Widget Specific Inspector (Transition.png) */}
        {selectedClip.asset?.content === "Slider Widget" && (
          <>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Slide Images
              </label>
              <div className="space-y-2">
                {slideImages.map((img, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-slate-300 dark:bg-slate-700 flex items-center justify-center font-bold text-[10px]">
                        ::
                      </div>
                      <span>{img}</span>
                    </div>
                    <button
                      onClick={() =>
                        setSlideImages(slideImages.filter((_, i) => i !== idx))
                      }
                      className="text-slate-400 hover:text-red-500 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <button
                onClick={() => setSlideImages([...slideImages, "Image.png"])}
                className="w-full py-2 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-xs text-slate-600 dark:text-slate-300 font-medium hover:border-sky-400 transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-2"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Images</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Transition
                </label>
                <select className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none">
                  <option value="Left">Left</option>
                  <option value="Right">Right</option>
                  <option value="Fade">Fade</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Duration
                </label>
                <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200">
                  1.5 s
                </div>
              </div>
            </div>
          </>
        )}

        {/* Animation Picker Trigger Section */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Animation
          </span>
          <button
            onClick={() => setIsAnimationModalOpen(true)}
            className="w-7 h-7 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Layout Modal */}
      <SelectLayoutModal
        isOpen={isLayoutModalOpen}
        onClose={() => setIsLayoutModalOpen(false)}
        onSelectLayout={(layoutId) => setCurrentLayout(layoutId)}
        currentLayout={currentLayout}
      />

      {/* Animation Modal */}
      <AnimationModal
        isOpen={isAnimationModalOpen}
        onClose={() => setIsAnimationModalOpen(false)}
        onSelectAnimation={(anim) => setCurrentAnimation(anim.type)}
        currentAnimation={currentAnimation}
      />
      </div>
    </div>
  );
}

export default PropertiesPanel;
