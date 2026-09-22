import {
  addAssetToTimeline,
  deleteClip,
  deleteTrack,
  addTrack,
  moveClip,
  redo,
  setPlayhead,
  setSelectedClip,
  splitClip,
  separateAudio,
  togglePlay,
  undo,
} from "@/store/editorSlice";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { triggerAutosave } from "@/store/thunks";
import type { Clip } from "@/types";
import {
  Home,
  Pause,
  Play,
  Scissors,
  Type,
  Video,
  Volume2,
  Music,
  Trash2,
  Plus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

const pixelsPerSecond = 200 / 60; // 200px per minute scale matching Figma

// ActionButton helper component for Timeline header buttons
function ActionButton({
  onClick,
  title,
  icon: Icon,
  label,
  color = "sky",
}: {
  onClick: () => void;
  title?: string;
  icon: any;
  label: string;
  color?: "sky" | "emerald";
  size?: "sm" | "md";
}) {
  const bgClass =
    color === "emerald"
      ? "bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800"
      : "bg-sky-500 hover:bg-sky-600 active:bg-sky-700";

  return (
    <button
      onClick={onClick}
      title={title}
      className={`px-3 py-1 rounded-lg ${bgClass} text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs`}
    >
      <Icon className="w-3.5 h-3.5" />
      <span>{label}</span>
    </button>
  );
}

// Playhead Indicator (Figma Style)
function PlayheadIndicator({
  onPlayheadMouseDown,
}: {
  onPlayheadMouseDown: (e: React.MouseEvent) => void;
}) {
  const playhead = useAppSelector((state) => state.editor.playhead);

  return (
    <div
      className="absolute top-0 bottom-0 w-[1.5px] bg-sky-500 z-50 pointer-events-none transition-none ml-12"
      style={{ left: `${playhead * pixelsPerSecond}px` }}
    >
      <svg
        width="18"
        height="24"
        viewBox="0 0 18 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute top-[40px] -ml-[8.25px] cursor-ew-resize pointer-events-auto drop-shadow-md z-50"
        onMouseDown={onPlayheadMouseDown}
      >
        <path
          d="M 2 2 H 16 V 12 L 9 22 L 2 12 Z"
          fill="#0284c7"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <line
          x1="7"
          y1="6"
          x2="7"
          y2="11"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <line
          x1="11"
          y1="6"
          x2="11"
          y2="11"
          stroke="#ffffff"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function Timeline() {
  const dispatch = useAppDispatch();
  const sceneGraph = useAppSelector((state) => state.editor.sceneGraph);
  const selectedClipId = useAppSelector((state) => state.editor.selectedClipId);
  const playhead = useAppSelector((state) => state.editor.playhead);
  const isPlaying = useAppSelector((state) => state.editor.isPlaying);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [dragState, setDragState] = useState<{
    clipId: string;
    startX: number;
    startY: number;
    originalStartTime: number;
    originalTrackId: string;
  } | null>(null);

  // Smooth playhead dragging & auto-scrolling with RAF coalescing
  const handlePlayheadMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    let rafId: number | null = null;
    let pendingX: number | null = null;

    const commitPlayhead = () => {
      if (pendingX !== null) {
        dispatch(setPlayhead(pendingX / pixelsPerSecond));
        pendingX = null;
      }
      rafId = null;
    };

    const updatePlayhead = (moveEvent: MouseEvent) => {
      const container = document.getElementById("timeline-scroll-container");
      if (container) {
        const rect = container.getBoundingClientRect();
        let newX = moveEvent.clientX - rect.left + container.scrollLeft - 48;
        newX = Math.max(0, newX);

        // Smooth auto-scroll when dragging near viewport edges
        if (moveEvent.clientX > rect.right - 50) {
          container.scrollLeft += 15;
        } else if (moveEvent.clientX < rect.left + 80) {
          container.scrollLeft -= 15;
        }

        pendingX = newX;
        if (rafId === null) {
          rafId = requestAnimationFrame(commitPlayhead);
        }
      }
    };

    // Immediate update on initial click down
    updatePlayhead(e.nativeEvent);
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      commitPlayhead();
    }

    const onMouseMove = (moveEvent: MouseEvent) => {
      updatePlayhead(moveEvent);
    };

    const onMouseUp = () => {
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        commitPlayhead();
      }
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const playheadRef = useRef(playhead);
  playheadRef.current = playhead;

  const duration = sceneGraph?.duration ?? 0;
  const durationRef = useRef(duration);
  durationRef.current = duration;

  // Playhead timer animation loop (smooth 60fps)
  useEffect(() => {
    let animationFrameId: number;
    if (isPlaying) {
      let lastTime = performance.now();
      const update = (now: number) => {
        const delta = (now - lastTime) / 1000;
        lastTime = now;
        const nextPlayhead = playheadRef.current + delta;

        if (durationRef.current > 0 && nextPlayhead >= durationRef.current) {
          dispatch(setPlayhead(0));
          dispatch(togglePlay());
          return;
        }

        dispatch(setPlayhead(nextPlayhead));
        animationFrameId = requestAnimationFrame(update);
      };
      animationFrameId = requestAnimationFrame(update);
    }
    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, dispatch]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if ((e.key === "Backspace" || e.key === "Delete") && selectedClipId) {
        dispatch(deleteClip(selectedClipId));
        dispatch(triggerAutosave());
        return;
      }
      if (e.key === " ") {
        e.preventDefault();
        dispatch(togglePlay());
        return;
      }
      if (
        e.key.toLowerCase() === "s" ||
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")
      ) {
        e.preventDefault();
        dispatch(splitClip({}));
        dispatch(triggerAutosave());
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        dispatch(undo());
        return;
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        dispatch(redo());
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedClipId, dispatch]);

  // Clip mouse drag move handler
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragState && containerRef.current && sceneGraph) {
        const deltaX = e.clientX - dragState.startX;
        const deltaSeconds = deltaX / pixelsPerSecond;
        const newStartTime = Math.max(
          0,
          dragState.originalStartTime + deltaSeconds,
        );

        const rect = containerRef.current.getBoundingClientRect();
        let trackIndex = Math.floor((e.clientY - rect.top - 80) / 60);
        trackIndex = Math.max(
          0,
          Math.min(trackIndex, sceneGraph.tracks.length - 1),
        );
        const targetTrack = sceneGraph.tracks[trackIndex];

        // Find clip to check type
        let currentClip: Clip | undefined;
        for (const t of sceneGraph.tracks) {
          const c = t.clips.find((clip) => clip.id === dragState.clipId);
          if (c) {
            currentClip = c;
            break;
          }
        }

        let newTrackId = dragState.originalTrackId;
        if (currentClip && targetTrack) {
          const isAudioClip = currentClip.asset?.type === "audio";
          const isTargetAudio = targetTrack.type === "audio";
          // Strictly enforce: Audio clips -> Audio tracks, Video/Image clips -> Video tracks
          if (isAudioClip === isTargetAudio) {
            newTrackId = targetTrack.id;
          }
        }

        // Auto-scroll timeline when dragging near viewport right/left edges
        const scrollContainer = document.getElementById(
          "timeline-scroll-container",
        );
        if (scrollContainer) {
          const scrollRect = scrollContainer.getBoundingClientRect();
          if (e.clientX > scrollRect.right - 50) {
            scrollContainer.scrollLeft += 15;
          } else if (e.clientX < scrollRect.left + 80) {
            scrollContainer.scrollLeft -= 15;
          }
        }

        dispatch(
          moveClip({ clipId: dragState.clipId, newStartTime, newTrackId }),
        );
      }
    };

    const handleMouseUp = () => {
      if (dragState) {
        setDragState(null);
        dispatch(triggerAutosave());
      }
    };

    if (dragState) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragState, dispatch, sceneGraph]);

  if (!sceneGraph)
    return (
      <div className="h-full bg-white dark:bg-slate-900 p-4 text-slate-400">
        No project loaded
      </div>
    );

  const visualMinutes = Math.max(5, Math.ceil(((duration > 0 ? duration : 60) + 60) / 60));
  const visualDuration = visualMinutes * 60;

  const formatTimecode = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const handleClipMouseDown = (
    e: React.MouseEvent,
    clip: Clip,
    trackId: string,
  ) => {
    e.stopPropagation();
    dispatch(setSelectedClip(clip.id));
    setDragState({
      clipId: clip.id,
      startX: e.clientX,
      startY: e.clientY,
      originalStartTime: clip.startTime,
      originalTrackId: trackId,
    });
  };

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 select-none overflow-hidden"
      ref={containerRef}
    >
      {/* 1. Playback Header Controls Bar */}
      <div className="h-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 flex items-center justify-center relative shrink-0 z-30">
        <div className="flex items-center gap-3">
          <button
            onClick={() => dispatch(togglePlay())}
            className="w-8 h-8 rounded-full bg-sky-500 hover:bg-sky-400 text-white flex items-center justify-center shadow-md cursor-pointer transition-transform active:scale-95"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4 fill-white" />
            ) : (
              <Play className="w-4 h-4 fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={() => {
              dispatch(splitClip({}));
              dispatch(triggerAutosave());
            }}
            title="Split Clip at Playhead (S or Ctrl+K)"
            className="px-2.5 py-1 rounded-lg bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors shadow-xs"
          >
            <Scissors className="w-3.5 h-3.5 text-sky-500" />
            <span>Split</span>
          </button>

          <button
            onClick={() => {
              dispatch(separateAudio({}));
              dispatch(triggerAutosave());
            }}
            title="Separate / Extract Audio from Video (Full Clip or Selected Region)"
            className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/60 text-sky-600 dark:text-sky-400 text-xs font-semibold flex items-center gap-1.5 border border-sky-300 dark:border-sky-800 cursor-pointer transition-colors shadow-xs"
          >
            <Music className="w-3.5 h-3.5 text-sky-500" />
            <span>Separate Sound</span>
          </button>

          <div className="text-xs font-mono font-medium text-slate-600 dark:text-slate-300">
            {formatTimecode(playhead)}{" "}
            <span className="text-slate-400 mx-1">|</span>{" "}
            {formatTimecode(duration)}
          </div>
        </div>
      </div>

      {/* 2. Scrollable Timeline Track Area */}
      <div
        id="timeline-scroll-container"
        className="flex-1 overflow-auto flex flex-col relative"
        ref={scrollContainerRef}
      >
        {/* Page / Layout Badges Header Line */}
        <div
          className="sticky top-0 z-30 h-10 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 shrink-0 flex items-center w-max min-w-full"
          style={{ width: `${visualDuration * pixelsPerSecond + 48}px` }}
        >
          {/* Left Home Icon Pill */}
          <button
            onClick={() => dispatch(setPlayhead(0))}
            title="Reset Playhead to Start"
            className="w-12 h-full bg-sky-500 hover:bg-sky-600 active:bg-sky-700 text-white flex items-center justify-center shrink-0 sticky left-0 z-40 cursor-pointer transition-colors"
          >
            <Home className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 px-3 py-1">
            <ActionButton
              onClick={() => {
                dispatch(addTrack({ type: "video" }));
                dispatch(triggerAutosave());
              }}
              title="Add New Video Track"
              icon={Plus}
              label="Add Video Track"
              size="sm"
            />
            <ActionButton
              onClick={() => {
                dispatch(addTrack({ type: "audio" }));
                dispatch(triggerAutosave());
              }}
              color="emerald"
              title="Add New Audio Track"
              icon={Plus}
              label="Add Audio Track"
              size="sm"
            />
          </div>
        </div>

        {/* Ruler Bar (Exact Figma Match from media_1789275976556.png) */}
        <div
          onMouseDown={handlePlayheadMouseDown}
          className="sticky top-10 z-30 h-9 bg-white dark:bg-slate-900 border-t border-b border-slate-200 dark:border-slate-800 shrink-0 flex w-max min-w-full cursor-pointer select-none"
          style={{ width: `${visualDuration * pixelsPerSecond + 48}px` }}
        >
          <div className="w-12 shrink-0 bg-slate-50 dark:bg-slate-950 sticky left-0 z-40 border-r border-slate-200 dark:border-slate-800 border-t border-slate-200 dark:border-slate-800"></div>
          <div
            className="flex-1 relative"
            style={{ width: `${visualDuration * pixelsPerSecond}px` }}
          >
            {Array.from({ length: visualMinutes + 1 }).map((_, m) => {
              const minuteSecond = m * 60;
              return (
                <div key={`m_${m}`}>
                  {/* Major 1-minute tick (Full height line + 01:00 text) */}
                  <div
                    className="absolute top-0 bottom-0"
                    style={{ left: `${minuteSecond * pixelsPerSecond}px` }}
                  >
                    <div className="absolute top-0 bottom-0 border-l border-slate-300 dark:border-slate-600" />
                    <span className="absolute bottom-0.5 left-1 text-[12px] text-slate-400 dark:text-slate-400 font-mono tracking-tight leading-none select-none">
                      {formatTimecode(minuteSecond)}
                    </span>
                  </div>

                  {/* 9 Minor sub-ticks between minutes */}
                  {m < visualMinutes &&
                    Array.from({ length: 9 }).map((_, sub) => {
                      const subSecond = minuteSecond + (sub + 1) * 6;
                      return (
                        <div
                          key={`sub_${m}_${sub}`}
                          className="absolute top-0 h-2 border-l border-slate-300/80 dark:border-slate-700/80"
                          style={{ left: `${subSecond * pixelsPerSecond}px` }}
                        />
                      );
                    })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Track Lanes */}
        <div
          className="flex-1 relative pb-10 w-max min-w-full"
          style={{ width: `${visualDuration * pixelsPerSecond + 48}px` }}
        >
          {sceneGraph.tracks.map((track) => (
            <div
              key={track.id}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const rawData = e.dataTransfer.getData("application/json");
                if (rawData) {
                  try {
                    const asset = JSON.parse(rawData);
                    const container = document.getElementById(
                      "timeline-scroll-container",
                    );
                    const scrollLeft = container ? container.scrollLeft : 0;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const dropX = e.clientX - rect.left + scrollLeft - 48;
                    const dropTime = Math.max(0, dropX / pixelsPerSecond);

                    dispatch(
                      addAssetToTimeline({
                        asset,
                        trackId: track.id,
                        startTime: dropTime,
                      }),
                    );
                    dispatch(triggerAutosave());
                  } catch (err) {
                    console.error("Drop error", err);
                  }
                }
              }}
              className="flex h-14 border-b border-slate-200 dark:border-slate-800/80 relative hover:bg-slate-50/50 dark:hover:bg-slate-850/50"
            >
              {/* Track Header Icon (Sticky Left - High Z-Index to prevent clipping) */}
              <div className="w-12 bg-white dark:bg-slate-900 flex items-center justify-center border-r border-slate-200 dark:border-slate-800 shrink-0 text-slate-500 dark:text-slate-400 z-30 sticky left-0 shadow-xs h-full group relative">
                {track.type === "audio" ? (
                  <Volume2 className="w-4 h-4 text-emerald-500 shrink-0" />
                ) : track.type === "text" ? (
                  <Type className="w-4 h-4 text-purple-500 shrink-0" />
                ) : (
                  <Video className="w-4 h-4 text-sky-500 shrink-0" />
                )}

                {sceneGraph.tracks.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch(deleteTrack(track.id));
                      dispatch(triggerAutosave());
                    }}
                    title="Delete Track"
                    className="absolute inset-0 bg-red-500/90 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-40 rounded-xs"
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                  </button>
                )}
              </div>

              {/* Track Clip Canvas */}
              <div className="flex-1 relative z-10 overflow-hidden">
                {track.clips.map((clip) => {
                  const isSelected = selectedClipId === clip.id;
                  const isAudio = clip.asset.type === "audio";
                  const isText = clip.asset.type === "text";

                  return (
                    <div
                      key={clip.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        dispatch(setSelectedClip(clip.id));
                      }}
                      onMouseDown={(e) =>
                        handleClipMouseDown(e, clip, track.id)
                      }
                      className={`absolute top-2 bottom-2 rounded-xl border flex items-center px-3 text-xs cursor-grab active:cursor-grabbing transition-all ${
                        isAudio
                          ? "bg-emerald-600 dark:bg-emerald-700 text-white border-emerald-500 shadow-xs"
                          : isText
                            ? "bg-purple-50 dark:bg-purple-950/40 border-purple-400 text-purple-700 dark:text-purple-300"
                            : "bg-amber-50 dark:bg-amber-950/40 border-amber-400 text-amber-800 dark:text-amber-300"
                      } ${isSelected ? "ring-2 ring-sky-500 shadow-md z-10" : ""}`}
                      style={{
                        left: `${clip.startTime * pixelsPerSecond}px`,
                        width: `${(clip.endTime - clip.startTime) * pixelsPerSecond}px`,
                      }}
                    >
                      {isAudio && (
                        <Volume2 className="w-3.5 h-3.5 mr-1.5 shrink-0 opacity-90" />
                      )}
                      <span className="truncate flex-1 font-medium">
                        {isText
                          ? clip.asset.content || "Text"
                          : clip.asset.public_id ||
                            clip.asset.original_url.split("/").pop() ||
                            "Clip"}
                      </span>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            dispatch(
                              splitClip({
                                trackId: track.id,
                                clipId: clip.id,
                                splitAtTime: playhead,
                              }),
                            );
                            dispatch(triggerAutosave());
                          }}
                          title="Split clip at playhead"
                          className="ml-1 p-1 rounded hover:bg-black/20 dark:hover:bg-white/20 text-current shrink-0 cursor-pointer"
                        >
                          <Scissors className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <PlayheadIndicator onPlayheadMouseDown={handlePlayheadMouseDown} />
      </div>
    </div>
  );
}

export default Timeline;
