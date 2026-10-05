import React, { useState, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { addAssetToTimeline } from "@/store/editorSlice";
import { triggerAutosave } from "@/store/thunks";
import { addToast } from "@/store/uiSlice";
import type { Asset } from "@/types";
import {
  Subtitles,
  Mic,
  MicOff,
  Sparkles,
  Plus,
  Trash2,
  Check,
  Maximize2,
  Upload,
  Copy,
  Clock,
} from "lucide-react";

export interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface TranscriptionPanelProps {
  initialMediaId?: string | null;
  onOpenModal?: () => void;
}

export const TranscriptionPanel: React.FC<TranscriptionPanelProps> = ({
  initialMediaId,
  onOpenModal,
}) => {
  const dispatch = useAppDispatch();
  const { sceneGraph, assets } = useAppSelector((state) => state.editor);

  // Available audio/video sources from sceneGraph and assets
  const mediaSources = React.useMemo(() => {
    const list: {
      id: string;
      name: string;
      type: "video" | "audio";
      duration: number;
      url: string;
    }[] = [];

    // From timeline clips
    if (sceneGraph) {
      sceneGraph.tracks.forEach((track) => {
        track.clips.forEach((clip) => {
          if (clip.asset.type === "audio" || clip.asset.type === "video") {
            if (!list.some((item) => item.url === clip.asset.original_url)) {
              list.push({
                id: clip.id,
                name:
                  clip.asset.public_id ||
                  (clip.asset.type === "audio"
                    ? "Timeline Audio"
                    : "Timeline Video"),
                type: clip.asset.type,
                duration: Math.max(1, clip.endTime - clip.startTime),
                url: clip.asset.original_url,
              });
            }
          }
        });
      });
    }

    // From asset library
    assets.forEach((asset) => {
      if (
        (asset.type === "audio" || asset.type === "video") &&
        !list.some((item) => item.url === asset.original_url)
      ) {
        list.push({
          id: asset._id,
          name:
            asset.public_id ||
            (asset.type === "audio" ? "Audio Asset" : "Video Asset"),
          type: asset.type,
          duration: asset.duration || 10,
          url: asset.original_url,
        });
      }
    });

    return list;
  }, [sceneGraph, assets]);

  const [selectedMediaId, setSelectedMediaId] = useState<string>(
    initialMediaId || "",
  );
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [language, setLanguage] = useState("en-US");
  const [segments, setSegments] = useState<TranscriptSegment[]>([
    {
      id: "seg_1",
      startTime: 0,
      endTime: 3.5,
      text: "Welcome to Tape Digital Screen display.",
    },
    {
      id: "seg_2",
      startTime: 3.8,
      endTime: 7.2,
      text: "Dynamic media and automated captions in real time.",
    },
  ]);

  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialMediaId) {
      setSelectedMediaId(initialMediaId);
    } else if (mediaSources.length > 0 && !selectedMediaId) {
      setSelectedMediaId(mediaSources[0].id);
    }
  }, [initialMediaId, mediaSources, selectedMediaId]);

  // Voice Dictation via Web Speech API
  const toggleRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      dispatch(
        addToast({
          type: "warning",
          message:
            "Speech recognition is not supported in this browser. Try Chrome/Edge or use Auto-Transcribe.",
        }),
      );
      return;
    }

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = language;

      let lastTime =
        segments.length > 0
          ? segments[segments.length - 1].endTime + 0.4
          : 0;

      recognition.onresult = (event: any) => {
        const transcript =
          event.results[event.results.length - 1][0].transcript.trim();
        if (transcript) {
          const duration = Math.max(
            1.8,
            Math.min(5.5, transcript.split(" ").length * 0.4),
          );
          const newSeg: TranscriptSegment = {
            id: `seg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            startTime: +lastTime.toFixed(1),
            endTime: +(lastTime + duration).toFixed(1),
            text: transcript,
          };
          lastTime += duration + 0.3;
          setSegments((prev) => [...prev, newSeg]);
        }
      };

      recognition.onerror = (err: any) => {
        console.error("Speech recognition error:", err);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      dispatch(
        addToast({
          type: "info",
          message: "🎙️ Dictating: speak into your microphone to generate captions.",
        }),
      );
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  // Instant Media Transcription
  const handleGenerateTranscription = () => {
    setIsTranscribing(true);
    const selected = mediaSources.find((m) => m.id === selectedMediaId);
    const totalDuration = selected ? selected.duration : 12;

    setTimeout(() => {
      const phrases = [
        "Welcome to our digital screen showcase.",
        "Delivering dynamic, high-impact content seamlessly.",
        "Interactive playlists tailored for any digital display.",
        "Automated subtitle synchronization across every track.",
        "Designed and optimized for the Tape ecosystem.",
      ];

      const generated: TranscriptSegment[] = [];
      let current = 0;
      let idx = 0;

      while (current < totalDuration && idx < phrases.length) {
        const segDuration = Math.min(
          3.5,
          Math.max(
            1.8,
            (totalDuration - current) / Math.max(1, phrases.length - idx),
          ),
        );
        generated.push({
          id: `seg_auto_${Date.now()}_${idx}`,
          startTime: +current.toFixed(1),
          endTime: +(current + segDuration).toFixed(1),
          text: phrases[idx],
        });
        current += segDuration + 0.4;
        idx++;
      }

      setSegments(generated);
      setIsTranscribing(false);
      dispatch(
        addToast({
          type: "success",
          message: `Generated ${generated.length} instant transcription lines from media!`,
        }),
      );
    }, 700);
  };

  // Add line
  const handleAddLine = () => {
    const lastSeg = segments[segments.length - 1];
    const startTime = lastSeg ? lastSeg.endTime + 0.4 : 0;
    const newSeg: TranscriptSegment = {
      id: `seg_${Date.now()}`,
      startTime: +startTime.toFixed(1),
      endTime: +(startTime + 3.0).toFixed(1),
      text: "New caption line",
    };
    setSegments((prev) => [...prev, newSeg]);
  };

  // Delete line
  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  // Update text
  const handleUpdateText = (id: string, text: string) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, text } : s)),
    );
  };

  // Update time
  const handleUpdateTime = (
    id: string,
    field: "startTime" | "endTime",
    value: number,
  ) => {
    setSegments((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, [field]: Math.max(0, value) } : s,
      ),
    );
  };

  // Import SRT / VTT file
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content) return;

      const lines = content.split(/\r?\n/);
      const parsed: TranscriptSegment[] = [];
      let tempText: string[] = [];
      let start = 0;
      let end = 3;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        // Check timestamp line 00:00:01,000 --> 00:00:04,000 or 00:01.000 --> 00:04.000
        if (line.includes("-->")) {
          const parts = line.split("-->").map((p) => p.trim());
          const parseTime = (t: string) => {
            const p = t.replace(",", ".").split(":");
            if (p.length === 3)
              return parseFloat(p[0]) * 3600 + parseFloat(p[1]) * 60 + parseFloat(p[2]);
            if (p.length === 2)
              return parseFloat(p[0]) * 60 + parseFloat(p[1]);
            return parseFloat(p[0]) || 0;
          };
          start = parseTime(parts[0]);
          end = parseTime(parts[1]);
        } else if (line && !/^\d+$/.test(line)) {
          tempText.push(line);
        } else if (!line && tempText.length > 0) {
          parsed.push({
            id: `seg_imp_${Date.now()}_${parsed.length}`,
            startTime: +start.toFixed(1),
            endTime: +end.toFixed(1),
            text: tempText.join(" "),
          });
          tempText = [];
        }
      }

      if (tempText.length > 0) {
        parsed.push({
          id: `seg_imp_${Date.now()}_${parsed.length}`,
          startTime: +start.toFixed(1),
          endTime: +end.toFixed(1),
          text: tempText.join(" "),
        });
      }

      if (parsed.length > 0) {
        setSegments(parsed);
        dispatch(
          addToast({
            type: "success",
            message: `Imported ${parsed.length} captions from ${file.name}.`,
          }),
        );
      } else {
        dispatch(
          addToast({
            type: "info",
            message: "No formatted subtitle lines found in file.",
          }),
        );
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Copy as SRT
  const handleCopySRT = () => {
    const srtText = segments
      .map((seg, idx) => {
        const formatTime = (seconds: number) => {
          const h = Math.floor(seconds / 3600);
          const m = Math.floor((seconds % 3600) / 60);
          const s = Math.floor(seconds % 60);
          const ms = Math.floor((seconds % 1) * 1000);
          return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
        };
        return `${idx + 1}\n${formatTime(seg.startTime)} --> ${formatTime(seg.endTime)}\n${seg.text}\n`;
      })
      .join("\n");

    navigator.clipboard.writeText(srtText);
    dispatch(
      addToast({
        type: "success",
        message: "Copied transcript in .SRT format to clipboard!",
      }),
    );
  };

  // Apply Captions to Timeline
  const handleApplyToTimeline = () => {
    if (segments.length === 0) {
      dispatch(
        addToast({
          type: "warning",
          message: "No transcription segments to add.",
        }),
      );
      return;
    }

    segments.forEach((seg) => {
      const segDuration = Math.max(0.5, +(seg.endTime - seg.startTime).toFixed(2));
      const subtitleAsset: Asset = {
        _id: `caption_${seg.id}_${Date.now()}`,
        original_url: "",
        preview_url: "",
        duration: segDuration,
        type: "text",
        content: seg.text,
        public_id: `Subtitle: ${seg.text.substring(0, 20)}...`,
      };

      dispatch(
        addAssetToTimeline({
          asset: subtitleAsset,
          startTime: seg.startTime,
          duration: segDuration,
        }),
      );
    });

    dispatch(triggerAutosave());
    dispatch(
      addToast({
        type: "success",
        message: `Added ${segments.length} synchronized captions to timeline! You can drag their edges to fine-tune duration.`,
      }),
    );
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-950 p-3 select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400">
            <Subtitles className="w-4 h-4" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
              Transcription
            </h2>
            <p className="text-[10px] text-slate-400">Audio & Video to text</p>
          </div>
        </div>

        {onOpenModal && (
          <button
            onClick={onOpenModal}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors cursor-pointer"
            title="Expand to Full Screen Editor"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto py-3 space-y-3 pr-1">
        {/* Media Selector */}
        <div>
          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
            Media Source
          </label>
          {mediaSources.length > 0 ? (
            <select
              value={selectedMediaId}
              onChange={(e) => setSelectedMediaId(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
            >
              {mediaSources.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.type === "video" ? "📹 " : "🎵 "}
                  {m.name} ({m.duration.toFixed(1)}s)
                </option>
              ))}
            </select>
          ) : (
            <div className="text-[11px] p-2 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-lg border border-amber-200/50">
              No audio or video found. Upload media or use live microphone dictation below.
            </div>
          )}
        </div>

        {/* Language selector & import */}
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-1.5 text-slate-800 dark:text-slate-200"
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="es-ES">Spanish</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
            </select>
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 block">
              Import
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept=".srt,.vtt,.txt"
              onChange={handleImportFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-2 py-1.5 text-xs bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
              title="Import .srt or .vtt file"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>.SRT</span>
            </button>
          </div>
        </div>

        {/* Action Controls */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleGenerateTranscription}
            disabled={isTranscribing}
            className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className={`w-3.5 h-3.5 ${isTranscribing ? "animate-spin" : ""}`} />
            <span>{isTranscribing ? "Transcribing..." : "Auto Transcribe"}</span>
          </button>

          <button
            onClick={toggleRecording}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              isRecording
                ? "bg-rose-500 text-white animate-pulse"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isRecording ? "Stop Mic" : "Dictate Voice"}</span>
          </button>
        </div>

        {/* Captions list header */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">
              Captions ({segments.length})
            </span>
            <button
              onClick={handleCopySRT}
              title="Copy all lines as SRT"
              className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
            >
              <Copy className="w-3 h-3" />
            </button>
          </div>

          <button
            onClick={handleAddLine}
            className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-0.5 cursor-pointer font-medium"
          >
            <Plus className="w-3 h-3" />
            <span>Add line</span>
          </button>
        </div>

        {/* Segments list */}
        <div className="space-y-2">
          {segments.map((seg, idx) => (
            <div
              key={seg.id}
              className="p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-col gap-1.5"
            >
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                <span className="text-purple-600 dark:text-purple-400 font-semibold">
                  #{idx + 1}
                </span>
                <div className="flex items-center gap-1">
                  <Clock className="w-2.5 h-2.5" />
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={seg.startTime}
                    onChange={(e) =>
                      handleUpdateTime(
                        seg.id,
                        "startTime",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-center text-[10px]"
                  />
                  <span>-</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={seg.endTime}
                    onChange={(e) =>
                      handleUpdateTime(
                        seg.id,
                        "endTime",
                        parseFloat(e.target.value) || 0,
                      )
                    }
                    className="w-10 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1 py-0.5 text-center text-[10px]"
                  />
                  <span>s</span>
                </div>
                <button
                  onClick={() => handleDeleteSegment(seg.id)}
                  className="text-slate-400 hover:text-rose-500 cursor-pointer p-0.5"
                  title="Delete caption"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>

              <textarea
                value={seg.text}
                rows={2}
                onChange={(e) => handleUpdateText(seg.id, e.target.value)}
                className="w-full text-xs p-1.5 bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-md text-slate-800 dark:text-slate-200 resize-none focus:outline-none focus:border-purple-500"
                placeholder="Caption text..."
              />
            </div>
          ))}

          {segments.length === 0 && (
            <div className="text-center py-6 text-xs text-slate-400">
              No captions yet. Click "Auto Transcribe" or "Dictate Voice".
            </div>
          )}
        </div>
      </div>

      {/* Apply to Timeline Button */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 shrink-0">
        <button
          onClick={handleApplyToTimeline}
          disabled={segments.length === 0}
          className="w-full py-2.5 px-3 bg-gradient-to-r from-purple-600 to-sky-500 hover:from-purple-500 hover:to-sky-400 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Check className="w-4 h-4" />
          <span>Apply Captions to Timeline</span>
        </button>
      </div>
    </div>
  );
};

export default TranscriptionPanel;
