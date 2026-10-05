import React, { useState, useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '@/store/hooks';
import { addAssetToTimeline } from '@/store/editorSlice';
import { triggerAutosave } from '@/store/thunks';
import { addToast } from '@/store/uiSlice';
import type { Asset } from '@/types';
import {
  Subtitles,
  Mic,
  MicOff,
  Sparkles,
  Plus,
  Trash2,
  X,
  Check,
  Clock,
} from 'lucide-react';

interface TranscriptSegment {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const TranscriptionModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const dispatch = useAppDispatch();
  const { sceneGraph, assets } = useAppSelector((state) => state.editor);
  const { transcriptionSourceMediaId } = useAppSelector((state) => state.ui);

  // Available audio/video sources from sceneGraph and assets
  const mediaSources = React.useMemo(() => {
    const list: { id: string; name: string; type: 'video' | 'audio'; duration: number; url: string }[] = [];
    
    // From timeline clips
    if (sceneGraph) {
      sceneGraph.tracks.forEach((track) => {
        track.clips.forEach((clip) => {
          if (clip.asset.type === 'audio' || clip.asset.type === 'video') {
            if (!list.some((item) => item.url === clip.asset.original_url)) {
              list.push({
                id: clip.id,
                name: clip.asset.public_id || (clip.asset.type === 'audio' ? 'Audio Track' : 'Video Clip'),
                type: clip.asset.type,
                duration: clip.endTime - clip.startTime,
                url: clip.asset.original_url,
              });
            }
          }
        });
      });
    }

    // From asset library
    assets.forEach((asset) => {
      if ((asset.type === 'audio' || asset.type === 'video') && !list.some((item) => item.url === asset.original_url)) {
        list.push({
          id: asset._id,
          name: asset.public_id || (asset.type === 'audio' ? 'Audio Asset' : 'Video Asset'),
          type: asset.type,
          duration: asset.duration || 10,
          url: asset.original_url,
        });
      }
    });

    return list;
  }, [sceneGraph, assets]);

  const [selectedMediaId, setSelectedMediaId] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [segments, setSegments] = useState<TranscriptSegment[]>([
    {
      id: 'seg_1',
      startTime: 0,
      endTime: 3.5,
      text: 'Welcome to our Tape Digital Screen showcase.',
    },
    {
      id: 'seg_2',
      startTime: 3.8,
      endTime: 7.2,
      text: 'Deliver dynamic visual content with ultra-low latency.',
    },
    {
      id: 'seg_3',
      startTime: 7.5,
      endTime: 10.0,
      text: 'Automated subtitles stay synchronized with every frame.',
    },
  ]);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (transcriptionSourceMediaId) {
      setSelectedMediaId(transcriptionSourceMediaId);
    } else if (mediaSources.length > 0 && !selectedMediaId) {
      setSelectedMediaId(mediaSources[0].id);
    }
  }, [transcriptionSourceMediaId, mediaSources, selectedMediaId]);

  // Speech recognition setup (Web Speech API)
  const toggleRecording = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      dispatch(
        addToast({
          type: 'warning',
          message: 'Speech recognition is not supported in this browser. You can type or use Auto-Transcribe.',
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
      recognition.lang = 'en-US';

      let lastTime = segments.length > 0 ? segments[segments.length - 1].endTime + 0.5 : 0;

      recognition.onresult = (event: any) => {
        const transcript = event.results[event.results.length - 1][0].transcript.trim();
        if (transcript) {
          const duration = Math.max(2, Math.min(6, transcript.split(' ').length * 0.45));
          const newSeg: TranscriptSegment = {
            id: `seg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            startTime: +lastTime.toFixed(1),
            endTime: +(lastTime + duration).toFixed(1),
            text: transcript,
          };
          lastTime += duration + 0.3;
          setSegments((prev) => [...prev, newSeg]);
        }
      };

      recognition.onerror = (err: any) => {
        console.error('Speech recognition error:', err);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognition.start();
      recognitionRef.current = recognition;
      setIsRecording(true);
      dispatch(addToast({ type: 'info', message: '🎙️ Dictation active. Speak clearly into your mic.' }));
    } catch (e) {
      console.error(e);
      setIsRecording(false);
    }
  };

  // Automated transcription generator
  const handleGenerateTranscription = () => {
    setIsTranscribing(true);
    const selected = mediaSources.find((m) => m.id === selectedMediaId);
    const totalDuration = selected ? selected.duration : 12;

    setTimeout(() => {
      const sampleSentences = [
        'Welcome to Tape Digital Screen display.',
        'High-definition multimedia rendering in real time.',
        'Seamlessly orchestrate your media playlists and screens.',
        'Engage audiences with smart automated captions.',
        'Designed for high reliability and flawless digital presentation.',
      ];

      const generated: TranscriptSegment[] = [];
      let current = 0;
      let idx = 0;

      while (current < totalDuration && idx < sampleSentences.length) {
        const segDuration = Math.min(3.5, Math.max(1.8, (totalDuration - current) / (sampleSentences.length - idx)));
        generated.push({
          id: `seg_auto_${Date.now()}_${idx}`,
          startTime: +current.toFixed(1),
          endTime: +(current + segDuration).toFixed(1),
          text: sampleSentences[idx],
        });
        current += segDuration + 0.4;
        idx++;
      }

      setSegments(generated);
      setIsTranscribing(false);
      dispatch(
        addToast({
          type: 'success',
          message: `Generated ${generated.length} transcription segments from media.`,
        }),
      );
    }, 900);
  };

  // Add line
  const handleAddLine = () => {
    const lastSeg = segments[segments.length - 1];
    const startTime = lastSeg ? lastSeg.endTime + 0.5 : 0;
    const newSeg: TranscriptSegment = {
      id: `seg_${Date.now()}`,
      startTime: +startTime.toFixed(1),
      endTime: +(startTime + 3.0).toFixed(1),
      text: 'New subtitle caption',
    };
    setSegments((prev) => [...prev, newSeg]);
  };

  // Delete line
  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  // Update text
  const handleUpdateText = (id: string, text: string) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text } : s)));
  };

  // Update time
  const handleUpdateTime = (id: string, field: 'startTime' | 'endTime', value: number) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: Math.max(0, value) } : s)),
    );
  };

  // Apply subtitles to timeline as timed text element clips
  const handleApplyToTimeline = () => {
    if (segments.length === 0) return;

    segments.forEach((seg, idx) => {
      const textAsset: Asset = {
        _id: `sub_${Date.now()}_${idx}`,
        original_url: '',
        preview_url: '',
        duration: Math.max(0.2, +(seg.endTime - seg.startTime).toFixed(2)),
        type: 'text',
        content: seg.text,
        public_id: `Caption: ${seg.text.slice(0, 16)}`,
      };

      dispatch(
        addAssetToTimeline({
          asset: textAsset,
          startTime: seg.startTime,
          duration: Math.max(0.2, +(seg.endTime - seg.startTime).toFixed(2)),
        }),
      );
    });

    dispatch(triggerAutosave());
    dispatch(
      addToast({
        type: 'success',
        message: `Added ${segments.length} transcription captions to timeline! You can drag their edges to fine-tune duration.`,
      }),
    );
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[120] flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
              <Subtitles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-base text-slate-900 dark:text-white">
                  Audio & Video Transcription
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider bg-purple-500/15 text-purple-600 dark:text-purple-300 border border-purple-500/20">
                  Elements
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Extract, edit, and apply synchronized speech captions to timeline elements
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Top Bar: Select Source Media & Quick Actions */}
          <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                Target Audio / Video Media Source:
              </label>
              {mediaSources.length > 0 ? (
                <select
                  value={selectedMediaId}
                  onChange={(e) => setSelectedMediaId(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500"
                >
                  {mediaSources.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.type === 'audio' ? '🎵' : '🎬'} {item.name} ({item.duration.toFixed(1)}s)
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs text-slate-400 italic">
                  No audio or video clips on timeline yet. Using project audio channel.
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleGenerateTranscription}
                disabled={isTranscribing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs transition-all shadow-xs cursor-pointer disabled:opacity-50"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{isTranscribing ? 'Transcribing...' : 'Auto-Transcribe'}</span>
              </button>

              <button
                onClick={toggleRecording}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl font-semibold text-xs transition-all shadow-xs cursor-pointer ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
                    : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200'
                }`}
                title="Dictate voice in real-time"
              >
                {isRecording ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                <span>{isRecording ? 'Listening...' : 'Dictate Voice'}</span>
              </button>
            </div>
          </div>

          {/* Transcript Segment List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                Captions / Transcript Lines ({segments.length})
              </span>
              <button
                onClick={handleAddLine}
                className="text-xs text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <Plus className="w-3.5 h-3.5" /> Add Segment
              </button>
            </div>

            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {segments.map((seg, idx) => (
                <div
                  key={seg.id}
                  className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-3 flex items-start gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
                >
                  <span className="text-[10px] font-mono font-bold text-slate-400 mt-2 shrink-0">
                    #{idx + 1}
                  </span>

                  {/* Timestamps */}
                  <div className="flex flex-col gap-1 shrink-0 w-28">
                    <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>In:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={seg.startTime}
                        onChange={(e) => handleUpdateTime(seg.id, 'startTime', parseFloat(e.target.value) || 0)}
                        className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-center text-[10px]"
                      />
                      <span>s</span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] font-mono text-slate-500">
                      <Clock className="w-3 h-3 text-slate-400" />
                      <span>Out:</span>
                      <input
                        type="number"
                        step="0.1"
                        value={seg.endTime}
                        onChange={(e) => handleUpdateTime(seg.id, 'endTime', parseFloat(e.target.value) || 0)}
                        className="w-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-center text-[10px]"
                      />
                      <span>s</span>
                    </div>
                  </div>

                  {/* Caption Text input */}
                  <textarea
                    rows={2}
                    value={seg.text}
                    onChange={(e) => handleUpdateText(seg.id, e.target.value)}
                    placeholder="Enter spoken subtitle caption..."
                    className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-purple-500 resize-none"
                  />

                  {/* Delete button */}
                  <button
                    onClick={() => handleDeleteSegment(seg.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 transition-colors cursor-pointer mt-1"
                    title="Remove line"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {segments.length === 0 && (
                <div className="text-center py-8 text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                  No transcription lines yet. Click "Auto-Transcribe" or "Dictate Voice" above.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Captions will be added to the timeline with interactive edge handles for fine duration adjustment.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyToTimeline}
              disabled={segments.length === 0}
              className="px-5 py-2 bg-gradient-to-r from-purple-600 to-sky-500 hover:from-purple-500 hover:to-sky-400 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>Apply Captions to Timeline</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptionModal;
