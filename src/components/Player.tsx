import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { store } from "@/store";
import type { Clip } from "@/types";
import { getMediaUrl } from "@/lib/api";
import { LayoutGrid } from "lucide-react";

import { mediaManager } from "@/services/mediaManager";
import { getAssetFrameSnapshots, saveAssetFrameSnapshots } from "@/services/indexedDbCache";

interface PlayerProps {
  zoomScale?: number;
}

interface MediaSeekTracker {
  isSeeking: boolean;
  pendingTime: number | null;
  lastSeekTimestamp: number;
  cleanup?: () => void;
}

export function Player({ zoomScale = 0.6 }: PlayerProps) {
  const dispatch = useAppDispatch();
  const { sceneGraph } = useAppSelector((state) => state.editor);
  const videoRefs = useRef<Map<string, HTMLMediaElement>>(new Map());
  const seekMapRef = useRef<Map<string, MediaSeekTracker>>(new Map());
  const frameCacheRef = useRef<Map<string, Map<number, HTMLCanvasElement | HTMLImageElement>>>(new Map());
  const sampledClipsRef = useRef<Set<string>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>(0);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});

  const saveFrameSnapshot = (assetKey: string, time: number, source: HTMLVideoElement) => {
    if (!source || source.videoWidth === 0 || !assetKey) return;
    let clipMap = frameCacheRef.current.get(assetKey);
    if (!clipMap) {
      clipMap = new Map();
      frameCacheRef.current.set(assetKey, clipMap);
    }
    const key = Math.round(time * 2) / 2; // 0.5s resolution
    if (!clipMap.has(key) && clipMap.size < 300) {
      try {
        const offscreen = document.createElement("canvas");
        offscreen.width = 480;
        offscreen.height = 270;
        const offCtx = offscreen.getContext("2d");
        if (offCtx) {
          offCtx.drawImage(source, 0, 0, offscreen.width, offscreen.height);
          clipMap.set(key, offscreen);
        }
      } catch {}
    }
  };

  const triggerLocalPreSampling = (assetKey: string, blobUrl: string, duration: number) => {
    if (sampledClipsRef.current.has(assetKey) || !blobUrl.startsWith("blob:")) return;
    sampledClipsRef.current.add(assetKey);

    const offscreen = document.createElement("video");
    offscreen.src = blobUrl;
    offscreen.preload = "auto";
    offscreen.muted = true;

    const clipDuration = duration > 0 ? duration : 10;
    const step = Math.max(1, clipDuration / 25);
    let sampleSec = 0;

    const sampleNext = () => {
      if (sampleSec > clipDuration) {
        offscreen.removeAttribute("src");
        offscreen.load();
        // Persist frame snapshots to IndexedDB for instant reload support
        const clipMap = frameCacheRef.current.get(assetKey);
        if (clipMap && clipMap.size > 0) {
          const framesToStore: { time: number; dataUrl: string }[] = [];
          clipMap.forEach((val, time) => {
            if (val instanceof HTMLCanvasElement) {
              try {
                framesToStore.push({ time, dataUrl: val.toDataURL("image/jpeg", 0.6) });
              } catch {}
            }
          });
          if (framesToStore.length > 0) {
            saveAssetFrameSnapshots(assetKey, framesToStore);
          }
        }
        return;
      }
      offscreen.currentTime = sampleSec;
    };

    offscreen.addEventListener(
      "loadeddata",
      () => {
        sampleNext();
      },
      { once: true }
    );

    offscreen.addEventListener("seeked", () => {
      if (offscreen.videoWidth > 0) {
        saveFrameSnapshot(assetKey, sampleSec, offscreen);
      }
      sampleSec += step;
      sampleNext();
    });
  };

  const getClosestFrame = (assetKey: string, targetTime: number): CanvasImageSource | null => {
    const clipMap = frameCacheRef.current.get(assetKey);
    if (!clipMap || clipMap.size === 0) return null;

    let closestFrame: CanvasImageSource | null = null;
    let minDiff = Infinity;

    for (const [key, frame] of clipMap.entries()) {
      const diff = Math.abs(key - targetTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestFrame = frame;
      }
    }

    return closestFrame;
  };

  // Full unmount cleanup
  useEffect(() => {
    return () => {
      seekMapRef.current.forEach((tracker) => {
        if (tracker.cleanup) tracker.cleanup();
      });
      seekMapRef.current.clear();
      videoRefs.current.forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
      videoRefs.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!sceneGraph) return;

    const currentClipIds = new Set<string>();

    sceneGraph.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (clip.asset.type === "video" || clip.asset.type === "audio") {
          currentClipIds.add(clip.id);

          const assetKey = clip.asset._id || clip.asset.public_id || clip.id;
          const media = videoRefs.current.get(clip.id);
          const isAudio = clip.asset.type === "audio";
          const rawUrl = getMediaUrl(clip.asset.preview_url || clip.asset.original_url);

          // Asynchronously pre-load saved frame snapshots from IndexedDB if not already in memory
          if (!isAudio && assetKey && !frameCacheRef.current.has(assetKey)) {
            frameCacheRef.current.set(assetKey, new Map());
            getAssetFrameSnapshots(assetKey).then((savedFrames) => {
              if (savedFrames && savedFrames.length > 0) {
                const map = frameCacheRef.current.get(assetKey) || new Map();
                savedFrames.forEach(({ time, dataUrl }) => {
                  const img = new Image();
                  img.src = dataUrl;
                  map.set(time, img);
                });
                frameCacheRef.current.set(assetKey, map);
                sampledClipsRef.current.add(assetKey);
              }
            });
          }

          if (media) {
            // Hot-swap media src if 480p preview proxy becomes available
            const cachedBlobUrl = mediaManager.getCachedBlobUrlSync(clip.asset._id, rawUrl);
            const targetUrl = cachedBlobUrl || rawUrl;
            if (targetUrl && clip.asset.preview_url && !media.src.includes(clip.asset.preview_url)) {
              const currentPos = media.currentTime;
              const wasPaused = media.paused;
              media.src = targetUrl;
              media.currentTime = currentPos;
              if (!wasPaused) media.play().catch(() => {});
            }
          } else {
            const createdMedia = document.createElement(isAudio ? "audio" : "video");
            const cachedBlobUrl = mediaManager.getCachedBlobUrlSync(clip.asset._id, rawUrl);
            createdMedia.src = cachedBlobUrl || rawUrl;
            if (createdMedia.src.startsWith("http")) {
              createdMedia.crossOrigin = "anonymous";
            }
            createdMedia.preload = "auto";
            const isMuted = clip.muted || clip.volume === 0;
            createdMedia.muted = isMuted;
            createdMedia.volume = isMuted ? 0 : Math.min(1, Math.max(0, (clip.volume ?? 100) / 100));

            // Non-blocking seek tracker for continuous, instant scrubbing
            const tracker: MediaSeekTracker = {
              isSeeking: false,
              pendingTime: null,
              lastSeekTimestamp: 0,
            };
            seekMapRef.current.set(clip.id, tracker);

            const performSeek = (time: number) => {
              tracker.isSeeking = true;
              tracker.lastSeekTimestamp = performance.now();
              if ("fastSeek" in createdMedia && typeof (createdMedia as any).fastSeek === "function") {
                try {
                  (createdMedia as any).fastSeek(time);
                } catch {
                  createdMedia.currentTime = time;
                }
              } else {
                createdMedia.currentTime = time;
              }
            };

            const onSeeked = () => {
              tracker.isSeeking = false;
              if (createdMedia instanceof HTMLVideoElement) {
                saveFrameSnapshot(assetKey, createdMedia.currentTime, createdMedia);
              }

              if (tracker.pendingTime !== null) {
                const nextTime = tracker.pendingTime;
                tracker.pendingTime = null;
                if (Math.abs(createdMedia.currentTime - nextTime) > 0.02) {
                  performSeek(nextTime);
                }
              }
            };

            createdMedia.addEventListener("seeked", onSeeked);
            tracker.cleanup = () => createdMedia.removeEventListener("seeked", onSeeked);
            videoRefs.current.set(clip.id, createdMedia);

            // Fetch into local blob / IndexedDB in background
            mediaManager.getOrLoadMediaBlobUrl(clip.asset._id, rawUrl).then((blobUrl) => {
              if (blobUrl && createdMedia && createdMedia.src !== blobUrl) {
                const currentPos = createdMedia.currentTime;
                const wasPaused = createdMedia.paused;
                createdMedia.src = blobUrl;
                createdMedia.currentTime = currentPos;
                if (!wasPaused) createdMedia.play().catch(() => {});

                if (!isAudio) {
                  triggerLocalPreSampling(
                    assetKey,
                    blobUrl,
                    clip.asset.duration || clip.endTime - clip.startTime
                  );
                }
              }
            });

            // If already cached locally, trigger pre-sampling right away
            if (cachedBlobUrl && !isAudio) {
              triggerLocalPreSampling(
                assetKey,
                cachedBlobUrl,
                clip.asset.duration || clip.endTime - clip.startTime
              );
            }
          }
        }
      });
    });

    // Clean up ONLY clips that were genuinely removed from the project
    for (const [id, media] of videoRefs.current.entries()) {
      if (!currentClipIds.has(id)) {
        const tracker = seekMapRef.current.get(id);
        if (tracker?.cleanup) tracker.cleanup();
        seekMapRef.current.delete(id);
        media.pause();
        media.removeAttribute("src");
        media.load();
        videoRefs.current.delete(id);
      }
    }
  }, [sceneGraph]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const {
        playhead: currentPlayhead,
        isPlaying: currentIsPlaying,
        sceneGraph: currentSceneGraph,
      } = store.getState().editor;

      if (!currentSceneGraph) {
        reqRef.current = requestAnimationFrame(render);
        return;
      }

      const activeClips: Clip[] = [];
      for (const track of currentSceneGraph.tracks) {
        const clip = track.clips.find(
          (c) => currentPlayhead >= c.startTime && currentPlayhead <= c.endTime
        );
        if (clip) {
          activeClips.push(clip);
        }
      }

      // Sync HTML video and audio elements smoothly
      activeClips.forEach((clip) => {
        if (clip.asset.type === "video" || clip.asset.type === "audio") {
          const media = videoRefs.current.get(clip.id);
          if (media) {
            const currentClipTime = clip.trimIn + (currentPlayhead - clip.startTime);
            const isMuted = clip.muted || clip.volume === 0;
            media.muted = isMuted;
            media.volume = isMuted ? 0 : Math.min(1, Math.max(0, (clip.volume ?? 100) / 100));

            if (currentIsPlaying) {
              if (media.paused) {
                media.currentTime = currentClipTime;
                media.play().catch((err) => {
                  console.warn(`Media play failed for clip ${clip.id}:`, err);
                });
              } else if (Math.abs(media.currentTime - currentClipTime) > 1.5) {
                // Only resync if drift is substantial (prevents infinite seek loops during playback)
                media.currentTime = currentClipTime;
              }
            } else {
              // SCRUBBING MODE: non-blocking seek queue with cadence throttle
              if (!media.paused) {
                media.pause();
              }
              // Skip seeking audio while scrubbing to save decoder threads for video
              if (clip.asset.type === "audio") return;

              const tracker = seekMapRef.current.get(clip.id);
              if (tracker) {
                if (Math.abs(media.currentTime - currentClipTime) > 0.02) {
                  const now = performance.now();
                  if (media.seeking || tracker.isSeeking) {
                    // Queue latest time without aborting the in-progress hardware decoder frame
                    tracker.pendingTime = currentClipTime;
                  } else {
                    if (now - tracker.lastSeekTimestamp >= 25) {
                      tracker.lastSeekTimestamp = now;
                      tracker.isSeeking = true;
                      if ("fastSeek" in media && typeof (media as any).fastSeek === "function") {
                        try {
                          (media as any).fastSeek(currentClipTime);
                        } catch {
                          media.currentTime = currentClipTime;
                        }
                      } else {
                        media.currentTime = currentClipTime;
                      }
                    } else {
                      tracker.pendingTime = currentClipTime;
                    }
                  }
                }
              }
            }
          }
        }
      });

      for (const [id, video] of videoRefs.current.entries()) {
        const isActive = activeClips.some((c) => c.id === id);
        if (!isActive && !video.paused) {
          video.pause();
        }
      }

      const currentVideoClip = activeClips.find((c) => c.asset.type === "video");
      const video = currentVideoClip ? (videoRefs.current.get(currentVideoClip.id) as HTMLVideoElement | undefined) : null;

      const isDark = document.documentElement.classList.contains("dark");

      // Fill canvas background with dark/black letterbox (NEVER white, to prevent blinding strobe flashes)
      ctx.fillStyle = isDark ? "#090d16" : "#0f172a";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render active clips from bottom track to top track
      [...activeClips].reverse().forEach((clip) => {
        if (clip.asset.type === "audio") return;

        if (clip.asset.type === "video" && clip.id === currentVideoClip?.id && video) {
          try {
            const assetKey = clip.asset._id || clip.asset.public_id || clip.id;
            const currentClipTime = clip.trimIn + (currentPlayhead - clip.startTime);
            const tracker = seekMapRef.current.get(clip.id);

            if (video.videoWidth > 0) {
              const scale = Math.min(
                canvas.width / video.videoWidth,
                canvas.height / video.videoHeight
              );
              const w = video.videoWidth * scale;
              const h = video.videoHeight * scale;
              const x = (canvas.width - w) / 2;
              const y = (canvas.height - h) / 2;

              // If scrubbing fast and we have a cached snapshot close to target time, show snapshot for instant feedback
              const cached = tracker?.isSeeking ? getClosestFrame(assetKey, currentClipTime) : null;
              if (cached) {
                ctx.drawImage(cached, x, y, w, h);
              } else {
                // Always draw video element's latest frame — eliminates blank flashes
                ctx.drawImage(video, x, y, w, h);
              }

              if (!tracker?.isSeeking && video.readyState >= 2) {
                saveFrameSnapshot(assetKey, currentClipTime, video);
              }
            }
          } catch (e) {
            console.error("Failed drawing video frame", e);
          }
        } else if (clip.asset.type === "image") {
          const url = getMediaUrl(clip.asset.preview_url || clip.asset.original_url);
          if (url) {
            let img = imageCache.current[url];
            if (!img) {
              img = new Image();
              img.crossOrigin = "anonymous";
              img.src = url;
              imageCache.current[url] = img;
            }
            if (img.complete && img.width > 0) {
              const scale = Math.min(canvas.width / img.width, canvas.height / img.height);
              const w = img.width * scale;
              const h = img.height * scale;
              const x = (canvas.width - w) / 2;
              const y = (canvas.height - h) / 2;
              ctx.drawImage(img, x, y, w, h);
            }
          }
        } else if (clip.asset.type === "text") {
          ctx.fillStyle = isDark ? "#f8fafc" : "#0f172a";
          ctx.font = "bold 36px Inter, sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(clip.asset.content || "Title Goes There", canvas.width / 2, canvas.height - 60);
        }
      });

      reqRef.current = requestAnimationFrame(render);
    };

    reqRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(reqRef.current);
  }, [dispatch]);

  return (
    <div className="flex-1 flex flex-col items-center justify-center relative w-full h-full p-6 select-none overflow-hidden bg-slate-100 dark:bg-slate-900">
      {/* Top Left Layout Grid Icon Button */}
      <button className="absolute top-6 left-6 w-9 h-9 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors z-20 cursor-pointer">
        <LayoutGrid className="w-5 h-5" />
      </button>

      {/* Main Canvas Canvas Frame Container */}
      <div
        className="relative bg-white dark:bg-slate-950 shadow-2xl rounded-sm transition-transform duration-200"
        style={{
          transform: `scale(${zoomScale})`,
          transformOrigin: "center center",
        }}
      >
        <canvas
          ref={canvasRef}
          width={960}
          height={540}
          className="w-[960px] h-[540px] block"
        />

        {/* Selected Element Transform Bounding Box Handle Overlay */}
        <div className="absolute inset-4 border-2 border-sky-400 pointer-events-none rounded-xs">
          {/* 8 Transform Control Dots */}
          <div className="w-3 h-3 bg-white border-2 border-sky-500 rounded-full absolute -top-1.5 -left-1.5 shadow-sm" />
          <div className="w-3 h-3 bg-white border-2 border-sky-500 rounded-full absolute -top-1.5 left-1/2 -translate-x-1/2 shadow-sm" />
          <div className="w-3 h-3 bg-white border-2 border-sky-500 rounded-full absolute -top-1.5 -right-1.5 shadow-sm" />
          <div className="w-3 h-3 bg-white border-2 border-sky-500 rounded-full absolute top-1/2 -left-1.5 -translate-y-1/2 shadow-sm" />
          <div className="w-3 h-3 bg-white border-2 border-sky-500 rounded-full absolute top-1/2 -right-1.5 -translate-y-1/2 shadow-sm" />
          <div className="w-3 h-3 bg-white border-2 border-sky-500 rounded-full absolute -bottom-1.5 -left-1.5 shadow-sm" />
          <div className="w-3 h-3 bg-white border-2 border-sky-500 rounded-full absolute -bottom-1.5 left-1/2 -translate-x-1/2 shadow-sm" />
          <div className="w-3 h-3 bg-white border-2 border-sky-500 rounded-full absolute -bottom-1.5 -right-1.5 shadow-sm" />
        </div>
      </div>
    </div>
  );
}

export default Player;
