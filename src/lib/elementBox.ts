import type { Clip, TextStyles } from "@/types";

export interface TextLayout {
  width: number;
  height: number;
  lines: string[];
  fontSize: number;
  lineHeight: number;
  padding: number;
  align: CanvasTextAlign;
  font: string;
  color: string;
  background?: string;
  borderRadius: number;
}

let measureCtx: CanvasRenderingContext2D | null = null;

function context(): CanvasRenderingContext2D {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d");
  }
  if (!measureCtx) throw new Error("Canvas text measurement is unavailable");
  return measureCtx;
}

export function cssFontWeight(weight?: string) {
  const key = (weight || "bold").toLowerCase().replace(/[\s_-]/g, "");
  if (key === "normal" || key === "400") return "400";
  if (key === "medium" || key === "500") return "500";
  if (key === "semibold" || key === "600") return "600";
  if (key === "bold" || key === "700") return "700";
  if (/^\d{3}$/.test(key)) return key;
  return "700";
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth?: number) {
  const paragraphs = (text.length ? text : " ").split("\n");
  if (!maxWidth) return paragraphs;
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.split(" ");
    let current = "";
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (current && ctx.measureText(next).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    lines.push(current);
  }
  return lines.length ? lines : [""];
}

export function measureTextLayout(clip: Clip, stylesOverride?: TextStyles): TextLayout {
  const styles = stylesOverride || clip.textStyles || {};
  const text = styles.content ?? clip.asset?.content ?? "Title Goes There";
  const fontSize = styles.fontSize || 48;
  const font = `${styles.fontStyle || "normal"} ${cssFontWeight(styles.fontWeight)} ${fontSize}px ${styles.fontFamily || "Inter"}, sans-serif`;
  const padding = styles.backgroundColor ? styles.backgroundPadding ?? 12 : 6;
  const lineHeight = fontSize * 1.25;
  const ctx = context();
  ctx.font = font;
  const maxInner =
    clip.transform?.width != null ? Math.max(20, clip.transform.width - padding * 2) : undefined;
  const lines = wrapText(ctx, text, maxInner);
  const contentWidth = Math.max(8, ...lines.map((line) => ctx.measureText(line || " ").width));
  const width = clip.transform?.width != null ? clip.transform.width : contentWidth + padding * 2;
  const height = Math.max(lineHeight, lines.length * lineHeight + padding * 2);
  return {
    width,
    height,
    lines,
    fontSize,
    lineHeight,
    padding,
    align: styles.align || "center",
    font,
    color: styles.color || "#ffffff",
    background: styles.backgroundColor,
    borderRadius: styles.borderRadius ?? 8,
  };
}

export function isDesignElement(clip: Clip) {
  const type = clip.asset?.type;
  return type === "text" || type === "qr" || type === "shape" || type === "slider";
}

export function isLineShape(clip: Clip) {
  const shape = clip.shapeStyles?.shapeType || clip.asset?.content || "";
  return clip.asset?.type === "shape" && String(shape).toLowerCase() === "line";
}

export function elementSize(clip: Clip) {
  if (clip.asset?.type === "text") {
    const layout = measureTextLayout(clip);
    return { width: layout.width, height: layout.height };
  }
  if (clip.asset?.type === "qr") {
    return { width: clip.transform?.width || 200, height: clip.transform?.height || 200 };
  }
  if (clip.asset?.type === "slider") {
    return { width: clip.transform?.width || 480, height: clip.transform?.height || 270 };
  }
  if (isLineShape(clip)) {
    const stroke = clip.shapeStyles?.strokeWidth ?? 6;
    return {
      width: clip.transform?.width || 320,
      height: Math.max(clip.transform?.height || 0, stroke, 8),
    };
  }
  return { width: clip.transform?.width || 200, height: clip.transform?.height || 150 };
}

export function pointInElement(clip: Clip, x: number, y: number) {
  const size = elementSize(clip);
  const scale = clip.transform?.scale ?? 1;
  const cx = (clip.transform?.x ?? 0) + 480;
  const cy = (clip.transform?.y ?? 0) + 270;
  const rot = (-(clip.transform?.rotation ?? 0) * Math.PI) / 180;
  const dx = x - cx;
  const dy = y - cy;
  const lx = dx * Math.cos(rot) - dy * Math.sin(rot);
  const ly = dx * Math.sin(rot) + dy * Math.cos(rot);
  return Math.abs(lx) <= (size.width * scale) / 2 && Math.abs(ly) <= (size.height * scale) / 2;
}
