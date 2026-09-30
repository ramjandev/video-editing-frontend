import { measureTextLayout } from "@/lib/elementBox";
import { getMediaUrl } from "@/lib/api";
import { LAYOUT_CANVAS_H, LAYOUT_CANVAS_W } from "@/lib/layouts";
import { computeMotion, isClipOnScreen } from "@/lib/motion";
import type { Clip, SceneGraph } from "@/types";
import { drawQRCode } from "./qrGenerator";

const slideImageCache = new Map<string, HTMLImageElement>();

function slideImage(url: string, media: RenderContextMedia): HTMLImageElement | null {
  const resolved = getMediaUrl(url);
  if (!resolved) return null;
  const preloaded = media.imageElements?.get(resolved) || media.imageElements?.get(url);
  if (preloaded && preloaded.complete && preloaded.naturalWidth > 0) return preloaded;
  let img = slideImageCache.get(resolved);
  if (!img) {
    img = new Image();
    if (!resolved.startsWith("blob:") && !resolved.startsWith("data:")) {
      img.crossOrigin = "anonymous";
    }
    img.src = resolved;
    slideImageCache.set(resolved, img);
  }
  return img.complete && img.naturalWidth > 0 ? img : null;
}

export interface DrawClipOptions {
  force?: boolean;
  opacity?: number;
  offsetX?: number;
  offsetY?: number;
  scale?: number;
  fallbackFrame?: CanvasImageSource | null;
}

/**
 * Get active clips at current playhead position sorted by Painter's Algorithm layer order.
 * Ensures video/background tracks are rendered FIRST and text/annotations/shapes/QR are rendered LAST (ON TOP).
 */
export function getSortedActiveClips(sceneGraph: SceneGraph | null | undefined, playhead: number): Clip[] {
  if (!sceneGraph || !sceneGraph.tracks) return [];

  const active: { clip: Clip; trackIndex: number }[] = [];

  sceneGraph.tracks.forEach((track, trackIndex) => {
    const matchingClips = track.clips.filter(
      (c) => c.asset?.type !== "audio" && isClipOnScreen(sceneGraph, c, playhead)
    );
    matchingClips.forEach((clip) => {
      active.push({ clip, trackIndex });
    });
  });

  const getPriority = (c: Clip) => {
    const type = c.asset?.type;
    if (type === "video") return 10;
    if (type === "image") return 20;
    if (type === "slider") return 30;
    if (type === "shape") return 40;
    if (type === "qr") return 50;
    if (type === "text") return 60;
    return 30;
  };

  // Painter's Algorithm: Lower priority (Video: 10) drawn FIRST (Background),
  // Higher priority (Text: 60) drawn LAST (Foreground - ON TOP OF EVERYTHING).
  active.sort((a, b) => {
    const prioA = getPriority(a.clip);
    const prioB = getPriority(b.clip);

    if (prioA !== prioB) {
      return prioA - prioB;
    }

    if (a.trackIndex !== b.trackIndex) {
      return b.trackIndex - a.trackIndex;
    }

    return a.clip.startTime - b.clip.startTime;
  });

  return active.map((item) => item.clip);
}

export interface RenderContextMedia {
  videoElements?: Map<string, HTMLMediaElement | HTMLVideoElement>;
  imageElements?: Map<string, HTMLImageElement>;
}

const SLIDE_COLORS = ["#0284c7", "#7c3aed", "#ea580c", "#059669"];

function drawSlide(
  ctx: CanvasRenderingContext2D,
  images: string[],
  index: number,
  width: number,
  height: number,
  media: RenderContextMedia,
  offsetX: number,
  opacity: number,
  scale: number,
) {
  ctx.save();
  ctx.globalAlpha *= Math.max(0, Math.min(1, opacity));
  ctx.translate(offsetX, 0);
  ctx.scale(scale, scale);
  const url = images[index];
  const img = url ? slideImage(url, media) : null;
  if (img) {
    const cover = Math.max(width / img.naturalWidth, height / img.naturalHeight);
    const dw = img.naturalWidth * cover;
    const dh = img.naturalHeight * cover;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    const color = SLIDE_COLORS[index % SLIDE_COLORS.length];
    const gradient = ctx.createLinearGradient(-width / 2, -height / 2, width / 2, height / 2);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, index % 2 === 0 ? "#0f172a" : "#ffffff");
    ctx.fillStyle = gradient;
    ctx.fillRect(-width / 2, -height / 2, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 32px Inter, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(images.length ? "Loading" : `Slide ${index + 1}`, 0, images.length ? 0 : -12);
    if (!images.length) {
      ctx.font = "16px Inter, sans-serif";
      ctx.fillText("Add photos on the right", 0, 22);
    }
  }
  ctx.restore();
}

export function drawClipToCanvas(
  ctx: CanvasRenderingContext2D,
  clip: Clip,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  media: RenderContextMedia = {},
  options: DrawClipOptions = {}
) {
  const outside = !clip || currentTime < clip.startTime || currentTime > clip.endTime;
  if (outside && !options.force) return;

  const elapsed = currentTime - clip.startTime;

  // 1. Transform Defaults
  const transform = clip.transform || {};
  const isLayoutCell = transform.objectFit === "cover";
  const layoutScaleX = isLayoutCell ? canvasWidth / LAYOUT_CANVAS_W : 1;
  const layoutScaleY = isLayoutCell ? canvasHeight / LAYOUT_CANVAS_H : 1;
  const posX = (transform.x ?? 0) * layoutScaleX + canvasWidth / 2;
  const posY = (transform.y ?? 0) * layoutScaleY + canvasHeight / 2;
  const scale = transform.scale ?? 1.0;
  const rotationRad = ((transform.rotation ?? 0) * Math.PI) / 180;
  let baseOpacity = transform.opacity ?? 1.0;

  const motionTime = Math.min(clip.endTime, Math.max(clip.startTime, currentTime));
  const motion = computeMotion(clip, motionTime, canvasWidth, canvasHeight);
  const animOffsetX = motion.offsetX + (options.offsetX ?? 0);
  const animOffsetY = motion.offsetY + (options.offsetY ?? 0);
  const animScaleX = motion.scaleX * (options.scale ?? 1);
  const animScaleY = motion.scaleY * (options.scale ?? 1);
  baseOpacity *= motion.opacity * (options.opacity ?? 1);

  if (baseOpacity <= 0) return;

  ctx.save();
  ctx.globalAlpha = baseOpacity;
  ctx.translate(posX + animOffsetX, posY + animOffsetY);
  ctx.rotate(rotationRad + motion.rotation);
  ctx.scale(scale * animScaleX, scale * animScaleY);

  const assetType = clip.asset?.type || "video";
  const content = clip.asset?.content;

  // ─── A. TEXT ELEMENT ──────────────────────────────────────────────────
  if (assetType === "text") {
    const styles = clip.textStyles || {};
    const layout = measureTextLayout(clip);
    ctx.font = layout.font;
    ctx.textAlign = layout.align;
    ctx.textBaseline = "middle";

    if (layout.background) {
      ctx.fillStyle = layout.background;
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(-layout.width / 2, -layout.height / 2, layout.width, layout.height, layout.borderRadius);
      } else {
        ctx.rect(-layout.width / 2, -layout.height / 2, layout.width, layout.height);
      }
      ctx.fill();
    }

    const blockHeight = layout.lines.length * layout.lineHeight;
    let textX = 0;
    if (layout.align === "left") textX = -layout.width / 2 + layout.padding;
    if (layout.align === "right") textX = layout.width / 2 - layout.padding;
    let textY = -blockHeight / 2 + layout.lineHeight / 2;

    for (const line of layout.lines) {
      if (styles.strokeColor && styles.strokeWidth) {
        ctx.strokeStyle = styles.strokeColor;
        ctx.lineWidth = styles.strokeWidth;
        ctx.strokeText(line, textX, textY);
      }
      ctx.fillStyle = layout.color;
      ctx.fillText(line, textX, textY);
      textY += layout.lineHeight;
    }
  }

  // ─── B. QR CODE ELEMENT ────────────────────────────────────────────────
  else if (assetType === "qr" || (assetType === "image" && content === "QR Code")) {
    const qrStyles = clip.qrStyles || {};
    const qrText = qrStyles.qrContent || content || "https://example.com";
    const fg = qrStyles.foregroundColor || "#000000";
    const bg = qrStyles.backgroundColor || "#ffffff";
    const width = transform.width || 180;
    const height = transform.height || 180;

    drawQRCode(ctx, qrText, -width / 2, -height / 2, width, height, fg, bg);
  }

  // ─── C. SHAPE ELEMENT ──────────────────────────────────────────────────
  else if (assetType === "shape" || (assetType === "image" && ["Rectangle", "Ellipses", "Triangle", "Star", "Line"].includes(content || ""))) {
    const shapeStyles = clip.shapeStyles || {};
    const shapeType = shapeStyles.shapeType || (content as any) || "Rectangle";
    const fill = shapeStyles.fillColor || "#38bdf8";
    const stroke = shapeStyles.strokeColor;
    const strokeW = shapeStyles.strokeWidth || 0;
    const radius = shapeStyles.borderRadius || 8;
    const width = transform.width || 200;
    const height = transform.height || 150;

    const halfW = width / 2;
    const halfH = height / 2;

    ctx.fillStyle = fill;
    if (stroke && strokeW > 0) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = strokeW;
    }

    ctx.beginPath();
    if (shapeType === "Rectangle" || shapeType === "rectangle") {
      if (typeof ctx.roundRect === "function" && radius > 0) {
        ctx.roundRect(-halfW, -halfH, width, height, radius);
      } else {
        ctx.rect(-halfW, -halfH, width, height);
      }
    } else if (shapeType === "Ellipses" || shapeType === "ellipse" || shapeType === "circle") {
      ctx.ellipse(0, 0, halfW, halfH, 0, 0, Math.PI * 2);
    } else if (shapeType === "Triangle" || shapeType === "triangle") {
      ctx.moveTo(0, -halfH);
      ctx.lineTo(halfW, halfH);
      ctx.lineTo(-halfW, halfH);
      ctx.closePath();
    } else if (shapeType === "Star" || shapeType === "star") {
      const spikes = 5;
      const outerRadius = Math.min(halfW, halfH);
      const innerRadius = outerRadius / 2.2;
      let rot = (Math.PI / 2) * 3;
      let step = Math.PI / spikes;
      ctx.moveTo(0, -outerRadius);
      for (let i = 0; i < spikes; i++) {
        ctx.lineTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
        rot += step;
        ctx.lineTo(Math.cos(rot) * innerRadius, Math.sin(rot) * innerRadius);
        rot += step;
      }
      ctx.closePath();
    } else if (shapeType === "Line" || shapeType === "line") {
      ctx.strokeStyle = stroke || fill || "#38bdf8";
      ctx.lineWidth = strokeW > 0 ? strokeW : 4;
      ctx.moveTo(-halfW, 0);
      ctx.lineTo(halfW, 0);
      ctx.stroke();
    }

    if (shapeType !== "Line" && shapeType !== "line") {
      ctx.fill();
      if (stroke && strokeW > 0) {
        ctx.stroke();
      }
    }
  }

  // ─── D. SLIDER / SLIDESHOW WIDGET ──────────────────────────────────────
  else if (assetType === "slider" || (assetType === "image" && content === "Slider Widget")) {
    const sliderStyles = clip.sliderStyles || {};
    const images = sliderStyles.images && sliderStyles.images.length > 0 ? sliderStyles.images : [];
    const slideDuration = Math.max(0.4, sliderStyles.slideDuration || 2.5);
    const totalSlides = images.length > 0 ? images.length : 3;
    const width = transform.width || 480;
    const height = transform.height || 270;
    const blend = Math.min(0.9, Math.max(0.45, slideDuration * 0.42));
    const safeElapsed = Math.max(0, elapsed);
    const cycle = safeElapsed % slideDuration;
    const index = Math.floor(safeElapsed / slideDuration) % totalSlides;
    const progress = cycle > slideDuration - blend ? (cycle - (slideDuration - blend)) / blend : 0;
    const transition = sliderStyles.transition || "fade";
    const hold = slideDuration <= blend ? 0.5 : Math.min(1, cycle / Math.max(0.01, slideDuration - blend));
    const ken = 1.04 + hold * 0.08;

    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(-width / 2, -height / 2, width, height, 12);
    } else {
      ctx.rect(-width / 2, -height / 2, width, height);
    }
    ctx.save();
    ctx.clip();
    const next = (index + 1) % totalSlides;
    if (progress <= 0 || totalSlides < 2) {
      drawSlide(ctx, images, index, width, height, media, 0, 1, ken);
    } else if (transition === "left" || transition === "right") {
      const dir = transition === "left" ? -1 : 1;
      drawSlide(ctx, images, index, width, height, media, dir * progress * width, 1, 1.04);
      drawSlide(ctx, images, next, width, height, media, dir * (progress - 1) * width, 1, 1.04);
    } else if (transition === "zoom") {
      drawSlide(ctx, images, index, width, height, media, 0, 1 - progress, 1 + progress * 0.35);
      drawSlide(ctx, images, next, width, height, media, 0, progress, 1.28 - progress * 0.24);
    } else {
      drawSlide(ctx, images, index, width, height, media, 0, 1, ken);
      drawSlide(ctx, images, next, width, height, media, 0, progress, 1.04);
    }
    ctx.restore();

    const dots = Math.min(totalSlides, 8);
    for (let i = 0; i < dots; i++) {
      ctx.beginPath();
      ctx.arc(-((dots - 1) * 12) / 2 + i * 12, height / 2 - 16, i === index % dots ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = i === index % dots ? "#ffffff" : "rgba(255,255,255,0.45)";
      ctx.fill();
    }
  }

  // ─── E. VIDEO & IMAGE CLIPS ────────────────────────────────────────────
  else if (assetType === "video" || assetType === "image") {
    let sourceMedia: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement | null = null;
    let naturalWidth = 960;
    let naturalHeight = 540;

    if (assetType === "video" && media.videoElements) {
      const vid = (media.videoElements.get(clip.id) || media.videoElements.get(clip.assetId)) as HTMLVideoElement | undefined;
      if (vid && vid instanceof HTMLVideoElement && vid.videoWidth > 0) {
        sourceMedia = vid;
        naturalWidth = vid.videoWidth;
        naturalHeight = vid.videoHeight;
      }
    }
    if (!sourceMedia && options.fallbackFrame) {
      const frame = options.fallbackFrame as CanvasImageSource & {
        videoWidth?: number;
        videoHeight?: number;
        naturalWidth?: number;
        naturalHeight?: number;
        width?: number;
        height?: number;
      };
      const frameWidth = frame.videoWidth || frame.naturalWidth || frame.width || 0;
      const frameHeight = frame.videoHeight || frame.naturalHeight || frame.height || 0;
      if (frameWidth > 0 && frameHeight > 0) {
        sourceMedia = frame as HTMLCanvasElement;
        naturalWidth = frameWidth;
        naturalHeight = frameHeight;
      }
    }
    if (!sourceMedia && assetType === "image" && media.imageElements) {
      const img = media.imageElements.get(clip.id) || media.imageElements.get(clip.assetId);
      if (img && img.complete && img.width > 0) {
        sourceMedia = img;
        naturalWidth = img.width;
        naturalHeight = img.height;
      }
    }

    const fitWidth = transform.width != null ? transform.width * layoutScaleX : canvasWidth;
    const fitHeight = transform.height != null ? transform.height * layoutScaleY : canvasHeight;

    if (sourceMedia) {
      const contain = Math.min(fitWidth / naturalWidth, fitHeight / naturalHeight);
      const cover = Math.max(fitWidth / naturalWidth, fitHeight / naturalHeight);
      const scaleFit = transform.objectFit === "cover" ? cover : contain;
      const dw = naturalWidth * scaleFit;
      const dh = naturalHeight * scaleFit;

      if (transform.objectFit === "cover") {
        ctx.beginPath();
        ctx.rect(-fitWidth / 2, -fitHeight / 2, fitWidth, fitHeight);
        ctx.clip();
      }

      ctx.drawImage(sourceMedia, -dw / 2, -dh / 2, dw, dh);
    }
  }

  ctx.restore();
}
