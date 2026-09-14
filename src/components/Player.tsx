import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { store } from "@/store";
import type { Clip } from "@/types";
import { getMediaUrl } from "@/lib/api";
import { LayoutGrid } from "lucide-react";

interface PlayerProps {
  zoomScale?: number;
}

export function Player({ zoomScale = 0.6 }: PlayerProps) {
  const dispatch = useAppDispatch();
  const { sceneGraph } = useAppSelector(
    (state) => state.editor
  );
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const reqRef = useRef<number>(0);
  const imageCache = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    if (!sceneGraph) return;

    sceneGraph.tracks.forEach((track) => {
      track.clips.forEach((clip) => {
        if (
          (clip.asset.type === "video" || clip.asset.type === "audio") &&
          !videoRefs.current.has(clip.id)
        ) {
          const isAudio = clip.asset.type === "audio";
          const media = document.createElement(isAudio ? "audio" : "video");
          const mediaUrl = getMediaUrl(clip.asset.preview_url || clip.asset.original_url);
          media.src = mediaUrl;
          if (mediaUrl.startsWith("http")) {
            media.crossOrigin = "anonymous";
          }
          media.preload = "auto";
          const isMuted = clip.muted || clip.volume === 0;
          media.muted = isMuted;
          media.volume = isMuted ? 0 : Math.min(1, Math.max(0, (clip.volume ?? 100) / 100));
          videoRefs.current.set(clip.id, media as HTMLVideoElement);
        }
      });
    });

    return () => {
      videoRefs.current.forEach((video) => {
        video.pause();
        video.removeAttribute("src");
        video.load();
      });
      videoRefs.current.clear();
    };
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
              } else if (Math.abs(media.currentTime - currentClipTime) > 0.35) {
                media.currentTime = currentClipTime;
              }
            } else {
              if (!media.paused) {
                media.pause();
              }
              if (Math.abs(media.currentTime - currentClipTime) > 0.05) {
                media.currentTime = currentClipTime;
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
      const video = currentVideoClip ? videoRefs.current.get(currentVideoClip.id) : null;

      const isDark = document.documentElement.classList.contains("dark");

      // Fill canvas background
      ctx.fillStyle = isDark ? "#090d16" : "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Render active clips from bottom track to top track
      [...activeClips].reverse().forEach((clip) => {
        if (clip.asset.type === "audio") return;

        if (clip.asset.type === "video" && clip.id === currentVideoClip?.id && video) {
          try {
            if (video.readyState >= 2) {
              const scale = Math.min(
                canvas.width / video.videoWidth,
                canvas.height / video.videoHeight
              );
              const w = video.videoWidth * scale;
              const h = video.videoHeight * scale;
              const x = (canvas.width - w) / 2;
              const y = (canvas.height - h) / 2;
              ctx.drawImage(video, x, y, w, h);
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
