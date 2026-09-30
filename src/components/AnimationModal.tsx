import { ANIMATIONS } from "@/lib/motion";
import type { AnimationCategory } from "@/types";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, RotateCw, Sparkles, X, Zap } from "lucide-react";
import React, { useEffect, useState } from "react";

interface AnimationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectAnimation: (anim: { category: AnimationCategory; type: string; duration: number }) => void;
  initialCategory?: AnimationCategory;
  selected?: Partial<Record<AnimationCategory, string | undefined>>;
  durations?: Partial<Record<AnimationCategory, number>>;
}

const ICONS: Record<string, React.ReactNode> = {
  fade_in: <div className="w-8 h-5 rounded bg-slate-300 dark:bg-slate-600 opacity-60" />,
  enter_left: <ArrowRight className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
  enter_right: <ArrowLeft className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
  enter_up: <ArrowUp className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
  enter_down: <ArrowDown className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
  zoom_in: <div className="w-6 h-6 rounded bg-sky-400" />,
  rotate_in: <RotateCw className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
  flip_x: <div className="w-8 h-5 rounded bg-slate-300 dark:bg-slate-600" />,
  flip_y: <div className="w-5 h-8 rounded bg-slate-300 dark:bg-slate-600" />,
  roll_in: <RotateCw className="w-6 h-6 text-sky-400" />,
  pulse: <Sparkles className="w-6 h-6 text-sky-500" />,
  bounce: <ArrowDown className="w-6 h-6 text-sky-500" />,
  shake: <ArrowRight className="w-6 h-6 text-sky-500" />,
  flash: <Zap className="w-6 h-6 text-sky-500" />,
  spin: <RotateCw className="w-6 h-6 text-sky-500" />,
  fade_out: <div className="w-8 h-5 rounded bg-slate-400 dark:bg-slate-500 opacity-40" />,
  exit_left: <ArrowLeft className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
  exit_right: <ArrowRight className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
  exit_up: <ArrowUp className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
  exit_down: <ArrowDown className="w-6 h-6 text-slate-500 dark:text-slate-400" />,
  zoom_out: <div className="w-4 h-4 rounded bg-slate-400" />,
  flip_out: <div className="w-8 h-1 rounded bg-slate-400" />,
};

export const AnimationModal: React.FC<AnimationModalProps> = ({
  isOpen,
  onClose,
  onSelectAnimation,
  initialCategory = "enter",
  selected,
  durations,
}) => {
  const [activeTab, setActiveTab] = useState<AnimationCategory>(initialCategory);
  const [animDuration, setAnimDuration] = useState(durations?.[initialCategory] ?? 0.6);

  useEffect(() => {
    if (!isOpen) return;
    setActiveTab(initialCategory);
    setAnimDuration(durations?.[initialCategory] ?? 0.6);
  }, [isOpen, initialCategory]);

  if (!isOpen) return null;

  const items = ANIMATIONS.filter((item) => item.category === activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16">
      <div className="w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1.5 rounded-full border border-slate-200 dark:border-slate-700/60 text-xs font-medium w-full max-w-md">
            {(["enter", "emphasis", "exit"] as AnimationCategory[]).map((tab) => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setAnimDuration(durations?.[tab] ?? 0.6);
                }}
                className={`flex-1 py-2 px-4 rounded-full transition-all cursor-pointer capitalize ${
                  activeTab === tab
                    ? "bg-white dark:bg-slate-900 text-sky-500 font-semibold shadow-sm border border-slate-200 dark:border-slate-700"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                {tab}
                {selected?.[tab] ? (
                  <span className="ml-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-500 align-middle" />
                ) : null}
              </button>
            ))}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors ml-4 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {items.map((item) => {
            const isSelected = selected?.[activeTab] === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectAnimation({ category: item.category, type: item.id, duration: animDuration });
                  onClose();
                }}
                className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all cursor-pointer ${
                  isSelected
                    ? "bg-sky-50 dark:bg-sky-950/40 text-sky-500 ring-2 ring-sky-500"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300"
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-2">
                  {ICONS[item.id]}
                </div>
                <span className="text-xs font-medium text-center">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center gap-4">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 shrink-0">
            Duration {animDuration.toFixed(1)}s
          </label>
          <input
            type="range"
            min={0.2}
            max={2}
            step={0.1}
            value={animDuration}
            onChange={(event) => setAnimDuration(parseFloat(event.target.value))}
            className="w-full accent-sky-500 cursor-pointer"
          />
          <button
            onClick={() => {
              onSelectAnimation({ category: activeTab, type: "", duration: animDuration });
              onClose();
            }}
            className="shrink-0 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-sky-400 cursor-pointer"
          >
            None
          </button>
        </div>
      </div>
    </div>
  );
};
