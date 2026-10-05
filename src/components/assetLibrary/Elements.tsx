import {
  Circle,
  Minus,
  QrCode,
  SlidersHorizontal,
  Square,
  Star as StarIcon,
  Subtitles,
  Triangle,
  Type as TypeIcon,
} from "lucide-react";
import React from "react";
import { useAppDispatch } from "@/store/hooks";
import { setTranscriptionModalOpen } from "@/store/uiSlice";

interface ElementsProps {
  handleAddText: () => void;
  handleAddQR: () => void;
  handleAddSlider: () => void;
  handleAddShape: (shape: string) => void;
}
const Elements: React.FC<ElementsProps> = ({
  handleAddText,
  handleAddQR,
  handleAddSlider,
  handleAddShape,
}) => {
  const dispatch = useAppDispatch();

  return (
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
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            Text
          </span>
        </button>

        <button
          onClick={handleAddQR}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
        >
          <QrCode className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            QR
          </span>
        </button>

        <button
          onClick={handleAddSlider}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
        >
          <SlidersHorizontal className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            Slider
          </span>
        </button>

        <button
          onClick={() => handleAddShape("Rectangle")}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
        >
          <Square className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            Rectangle
          </span>
        </button>

        <button
          onClick={() => handleAddShape("Ellipses")}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
        >
          <Circle className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            Ellipses
          </span>
        </button>

        <button
          onClick={() => handleAddShape("Triangle")}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
        >
          <Triangle className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            Triangle
          </span>
        </button>

        <button
          onClick={() => handleAddShape("Star")}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
        >
          <StarIcon className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            Star
          </span>
        </button>

        <button
          onClick={() => handleAddShape("Line")}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-sky-400 transition-all cursor-pointer group"
        >
          <Minus className="w-5 h-5 text-slate-600 dark:text-slate-400 group-hover:text-sky-500 mb-1" />
          <span className="text-[10px] text-slate-600 dark:text-slate-300 font-medium">
            Line
          </span>
        </button>

        <button
          onClick={() => dispatch(setTranscriptionModalOpen(true))}
          className="flex flex-col items-center justify-center p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 hover:border-purple-400 hover:bg-purple-500/5 transition-all cursor-pointer group"
          title="Transcribe Audio/Video and generate captions"
        >
          <Subtitles className="w-5 h-5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform mb-1" />
          <span className="text-[10px] text-slate-700 dark:text-slate-200 font-medium">
            Transcription
          </span>
        </button>
      </div>
    </div>
  );
};

export default Elements;
