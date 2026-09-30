import type { AnimationCategory, AnimationProps, Clip, ClipAnimations, SceneGraph, TransitionKind } from "@/types";

const ABUT_TOLERANCE = 0.08;

export interface AnimationItem {
  id: string;
  label: string;
  category: AnimationCategory;
}

export const ANIMATIONS: AnimationItem[] = [
  { id: "fade_in", label: "Fade In", category: "enter" },
  { id: "enter_left", label: "Enter Left", category: "enter" },
  { id: "enter_right", label: "Enter Right", category: "enter" },
  { id: "enter_up", label: "Enter Up", category: "enter" },
  { id: "enter_down", label: "Enter Down", category: "enter" },
  { id: "zoom_in", label: "Zoom In", category: "enter" },
  { id: "rotate_in", label: "Rotate In", category: "enter" },
  { id: "flip_x", label: "Flip X", category: "enter" },
  { id: "flip_y", label: "Flip Y", category: "enter" },
  { id: "roll_in", label: "Roll In", category: "enter" },
  { id: "pulse", label: "Pulse", category: "emphasis" },
  { id: "bounce", label: "Bounce", category: "emphasis" },
  { id: "shake", label: "Shake", category: "emphasis" },
  { id: "flash", label: "Flash", category: "emphasis" },
  { id: "spin", label: "Spin", category: "emphasis" },
  { id: "fade_out", label: "Fade Out", category: "exit" },
  { id: "exit_left", label: "Exit Left", category: "exit" },
  { id: "exit_right", label: "Exit Right", category: "exit" },
  { id: "exit_up", label: "Exit Up", category: "exit" },
  { id: "exit_down", label: "Exit Down", category: "exit" },
  { id: "zoom_out", label: "Zoom Out", category: "exit" },
  { id: "flip_out", label: "Flip Out", category: "exit" },
];

export const TRANSITIONS: { id: TransitionKind; label: string }[] = [
  { id: "none", label: "None" },
  { id: "crossfade", label: "Crossfade" },
  { id: "dip_black", label: "Dip to Black" },
  { id: "wipe_left", label: "Wipe Left" },
  { id: "wipe_right", label: "Wipe Right" },
  { id: "wipe_up", label: "Wipe Up" },
  { id: "wipe_down", label: "Wipe Down" },
  { id: "slide_left", label: "Slide Left" },
  { id: "slide_right", label: "Slide Right" },
  { id: "zoom", label: "Zoom" },
];

const LEGACY_TYPE: Record<string, string> = {
  slide_left: "enter_left",
  slide_right: "enter_right",
  "Fade In": "fade_in",
  "Enter Left": "enter_left",
  "Enter Right": "enter_right",
  "Enter Up": "enter_up",
  "Enter Down": "enter_down",
  "Rotate In": "rotate_in",
  "Flip X": "flip_x",
  "Flip Y": "flip_y",
  Flip: "flip_x",
  "Zoom In": "zoom_in",
  "Roll In": "roll_in",
  "Slide In": "enter_left",
  "Fade Out": "fade_out",
  "Zoom Out": "zoom_out",
  Bounce: "bounce",
};

export function animationInfo(type?: string): { id: string; label: string; category: AnimationCategory } | null {
  if (!type) return null;
  const id = LEGACY_TYPE[type] || type;
  const item = ANIMATIONS.find((entry) => entry.id === id);
  if (!item) return { id, label: type, category: "emphasis" };
  return item;
}

export function animationLabel(type?: string) {
  return animationInfo(type)?.label || "None";
}

export function clipAnimations(clip: Clip): ClipAnimations {
  const slots: ClipAnimations = { ...(clip.animations || {}) };
  const hasSlot = !!(slots.enter?.type || slots.emphasis?.type || slots.exit?.type);
  if (!hasSlot && clip.animation?.type) {
    const info = animationInfo(clip.animation.type);
    const category = clip.animation.category || info?.category || "enter";
    slots[category] = clip.animation;
  }
  return slots;
}

function composeMotion(base: MotionFrame, next: MotionFrame): MotionFrame {
  return {
    opacity: base.opacity * next.opacity,
    offsetX: base.offsetX + next.offsetX,
    offsetY: base.offsetY + next.offsetY,
    scaleX: base.scaleX * next.scaleX,
    scaleY: base.scaleY * next.scaleY,
    rotation: base.rotation + next.rotation,
  };
}

export function transitionLabel(type?: TransitionKind) {
  return TRANSITIONS.find((item) => item.id === type)?.label || "None";
}

export interface MotionFrame {
  opacity: number;
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  rotation: number;
}

const IDENTITY: MotionFrame = {
  opacity: 1,
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
};

function easeOut(p: number) {
  const t = Math.min(1, Math.max(0, p));
  return 1 - Math.pow(1 - t, 3);
}

function locateClip(sceneGraph: SceneGraph, clipId: string) {
  for (const track of sceneGraph.tracks) {
    const clips = [...track.clips].sort((a, b) => a.startTime - b.startTime);
    const index = clips.findIndex((clip) => clip.id === clipId);
    if (index !== -1) return { clips, index };
  }
  return null;
}

function abuts(left: Clip, right: Clip) {
  if (left.asset?.type === "audio" || right.asset?.type === "audio") return false;
  return Math.abs(right.startTime - left.endTime) <= ABUT_TOLERANCE;
}

export function findNextAbutting(sceneGraph: SceneGraph, clip: Clip): Clip | null {
  const located = locateClip(sceneGraph, clip.id);
  if (!located) return null;
  const next = located.clips[located.index + 1];
  return next && abuts(clip, next) ? next : null;
}

export function findPrevAbutting(sceneGraph: SceneGraph, clip: Clip): Clip | null {
  const located = locateClip(sceneGraph, clip.id);
  if (!located || located.index === 0) return null;
  const prev = located.clips[located.index - 1];
  return prev && abuts(prev, clip) ? prev : null;
}

export function clipScreenWindow(sceneGraph: SceneGraph, clip: Clip) {
  let start = clip.startTime;
  let end = clip.endTime;
  const next = findNextAbutting(sceneGraph, clip);
  const prev = findPrevAbutting(sceneGraph, clip);
  if (next && clip.transitionOut && clip.transitionOut.type !== "none") {
    end += (clip.transitionOut.duration ?? 0.8) / 2;
  }
  if (prev?.transitionOut && prev.transitionOut.type !== "none") {
    start -= (prev.transitionOut.duration ?? 0.8) / 2;
  }
  return { start, end };
}

export function isClipOnScreen(sceneGraph: SceneGraph, clip: Clip, playhead: number) {
  const window = clipScreenWindow(sceneGraph, clip);
  return playhead >= window.start && playhead <= window.end;
}

export function mediaTimeForClip(clip: Clip, playhead: number) {
  const head = Math.min(clip.endTime, Math.max(clip.startTime, playhead));
  return (clip.trimIn || 0) + (head - clip.startTime);
}

function computeSingleMotion(
  animation: AnimationProps,
  clip: Clip,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
): MotionFrame {
  if (!animation.type) return IDENTITY;

  const type = LEGACY_TYPE[animation.type] || animation.type;
  const item = ANIMATIONS.find((entry) => entry.id === type);
  const category = animation.category || item?.category;
  if (!category) return IDENTITY;

  const duration = Math.max(0.15, animation.duration ?? 0.6);
  const time = Math.min(clip.endTime, Math.max(clip.startTime, currentTime));
  const elapsed = time - clip.startTime;
  const travelX = canvasWidth * 0.45;
  const travelY = canvasHeight * 0.45;

  let progress = 1;
  if (category === "enter") {
    if (elapsed > duration) return IDENTITY;
    progress = easeOut(elapsed / duration);
  } else if (category === "exit") {
    const remaining = clip.endTime - time;
    if (remaining > duration) return IDENTITY;
    progress = easeOut(1 - remaining / duration);
  } else {
    const length = Math.max(0.01, clip.endTime - clip.startTime);
    const emphasisStart = Math.max(0, (length - duration) / 2);
    const local = elapsed - emphasisStart;
    if (local < 0 || local > duration) return IDENTITY;
    progress = local / duration;
  }

  const enter = 1 - progress;
  const exit = progress;
  const frame: MotionFrame = { ...IDENTITY };

  switch (type) {
    case "fade_in":
      frame.opacity = progress;
      break;
    case "enter_left":
      frame.offsetX = enter * -travelX;
      break;
    case "enter_right":
      frame.offsetX = enter * travelX;
      break;
    case "enter_up":
      frame.offsetY = enter * -travelY;
      break;
    case "enter_down":
      frame.offsetY = enter * travelY;
      break;
    case "zoom_in":
      frame.scaleX = 0.15 + 0.85 * progress;
      frame.scaleY = frame.scaleX;
      frame.opacity = Math.min(1, progress * 1.4);
      break;
    case "rotate_in":
      frame.rotation = enter * -0.8;
      frame.scaleX = 0.7 + 0.3 * progress;
      frame.scaleY = frame.scaleX;
      break;
    case "flip_x":
      frame.scaleX = Math.max(0.02, progress);
      break;
    case "flip_y":
      frame.scaleY = Math.max(0.02, progress);
      break;
    case "roll_in":
      frame.offsetX = enter * -travelX;
      frame.rotation = enter * -Math.PI;
      break;
    case "pulse":
      frame.scaleX = 1 + Math.sin(progress * Math.PI * 2) * 0.12;
      frame.scaleY = frame.scaleX;
      break;
    case "bounce":
      frame.offsetY = -Math.abs(Math.sin(progress * Math.PI * 2)) * 48;
      break;
    case "shake":
      frame.offsetX = Math.sin(progress * Math.PI * 8) * 22;
      break;
    case "flash":
      frame.opacity = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(progress * Math.PI * 2));
      break;
    case "spin":
      frame.rotation = progress * Math.PI * 2;
      break;
    case "fade_out":
      frame.opacity = 1 - exit;
      break;
    case "exit_left":
      frame.offsetX = exit * -travelX;
      break;
    case "exit_right":
      frame.offsetX = exit * travelX;
      break;
    case "exit_up":
      frame.offsetY = exit * -travelY;
      break;
    case "exit_down":
      frame.offsetY = exit * travelY;
      break;
    case "zoom_out":
      frame.scaleX = 1 - 0.75 * exit;
      frame.scaleY = frame.scaleX;
      frame.opacity = 1 - exit;
      break;
    case "flip_out":
      frame.scaleX = Math.max(0.02, 1 - exit);
      frame.opacity = 1 - exit * 0.35;
      break;
    default:
      return IDENTITY;
  }

  return frame;
}

export function computeMotion(
  clip: Clip,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
): MotionFrame {
  const slots = clipAnimations(clip);
  return (["enter", "emphasis", "exit"] as const).reduce((frame, category) => {
    const slot = slots[category];
    if (!slot?.type) return frame;
    return composeMotion(
      frame,
      computeSingleMotion({ ...slot, category: slot.category || category }, clip, currentTime, canvasWidth, canvasHeight),
    );
  }, IDENTITY);
}

export interface TransitionFx {
  active: boolean;
  force: boolean;
  opacity: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  clipRect: { x: number; y: number; w: number; h: number } | null;
  edge: { x1: number; y1: number; x2: number; y2: number } | null;
}

const NO_TRANSITION: TransitionFx = {
  active: false,
  force: false,
  opacity: 1,
  offsetX: 0,
  offsetY: 0,
  scale: 1,
  clipRect: null,
  edge: null,
};

export function strokeTransitionEdge(ctx: CanvasRenderingContext2D, fx: TransitionFx) {
  if (!fx.edge) return;
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(fx.edge.x1, fx.edge.y1);
  ctx.lineTo(fx.edge.x2, fx.edge.y2);
  ctx.stroke();
  ctx.restore();
}

function smooth(p: number) {
  const t = Math.min(1, Math.max(0, p));
  return t * t * (3 - 2 * t);
}

function transitionRole(
  role: "in" | "out",
  type: TransitionKind,
  rawProgress: number,
  canvasWidth: number,
  canvasHeight: number,
  outside: boolean,
): TransitionFx {
  const p = smooth(rawProgress);
  const fx: TransitionFx = { ...NO_TRANSITION, active: true, force: outside, clipRect: null, edge: null };

  if (type === "crossfade") {
    fx.opacity = role === "out" ? 1 - p : p;
  } else if (type === "dip_black") {
    fx.opacity = role === "out" ? (p < 0.5 ? 1 - p / 0.5 : 0) : p < 0.5 ? 0 : (p - 0.5) / 0.5;
  } else if (type === "zoom") {
    fx.opacity = role === "out" ? 1 - p : p;
    fx.scale = role === "out" ? 1 + 0.22 * p : 1.22 - 0.22 * p;
  } else if (type === "slide_left") {
    fx.offsetX = role === "out" ? -p * canvasWidth : (1 - p) * canvasWidth;
  } else if (type === "slide_right") {
    fx.offsetX = role === "out" ? p * canvasWidth : (p - 1) * canvasWidth;
  } else if (role === "in" && type.startsWith("wipe_")) {
    const width = canvasWidth * p;
    const height = canvasHeight * p;
    if (type === "wipe_left") {
      fx.clipRect = { x: 0, y: 0, w: width, h: canvasHeight };
      fx.edge = { x1: width, y1: 0, x2: width, y2: canvasHeight };
    }
    if (type === "wipe_right") {
      fx.clipRect = { x: canvasWidth - width, y: 0, w: width, h: canvasHeight };
      fx.edge = { x1: canvasWidth - width, y1: 0, x2: canvasWidth - width, y2: canvasHeight };
    }
    if (type === "wipe_down") {
      fx.clipRect = { x: 0, y: 0, w: canvasWidth, h: height };
      fx.edge = { x1: 0, y1: height, x2: canvasWidth, y2: height };
    }
    if (type === "wipe_up") {
      fx.clipRect = { x: 0, y: canvasHeight - height, w: canvasWidth, h: height };
      fx.edge = { x1: 0, y1: canvasHeight - height, x2: canvasWidth, y2: canvasHeight - height };
    }
    if (fx.clipRect && (fx.clipRect.w <= 1 || fx.clipRect.h <= 1)) fx.opacity = 0;
  }

  return fx;
}

export function getTransitionFx(
  sceneGraph: SceneGraph,
  clip: Clip,
  time: number,
  canvasWidth: number,
  canvasHeight: number,
): TransitionFx {
  const next = findNextAbutting(sceneGraph, clip);
  if (next && clip.transitionOut && clip.transitionOut.type !== "none") {
    const duration = clip.transitionOut.duration ?? 0.8;
    const start = clip.endTime - duration / 2;
    const end = clip.endTime + duration / 2;
    if (time >= start && time <= end) {
      return transitionRole(
        "out",
        clip.transitionOut.type,
        (time - start) / duration,
        canvasWidth,
        canvasHeight,
        time > clip.endTime,
      );
    }
  }

  const prev = findPrevAbutting(sceneGraph, clip);
  if (prev?.transitionOut && prev.transitionOut.type !== "none") {
    const duration = prev.transitionOut.duration ?? 0.8;
    const start = prev.endTime - duration / 2;
    const end = prev.endTime + duration / 2;
    if (time >= start && time <= end) {
      return transitionRole(
        "in",
        prev.transitionOut.type,
        (time - start) / duration,
        canvasWidth,
        canvasHeight,
        time < clip.startTime,
      );
    }
  }

  return NO_TRANSITION;
}
