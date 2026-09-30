export const LAYOUT_CANVAS_W = 960;
export const LAYOUT_CANVAS_H = 540;
const GAP = 8;

export interface LayoutCell {
  x: number;
  y: number;
  width: number;
  height: number;
}

function cellFromTopLeft(left: number, top: number, width: number, height: number): LayoutCell {
  return {
    x: left + width / 2 - LAYOUT_CANVAS_W / 2,
    y: top + height / 2 - LAYOUT_CANVAS_H / 2,
    width,
    height,
  };
}

function rowSplit(count: number): LayoutCell[] {
  const height = (LAYOUT_CANVAS_H - GAP * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) =>
    cellFromTopLeft(0, index * (height + GAP), LAYOUT_CANVAS_W, height),
  );
}

function columnSplit(count: number): LayoutCell[] {
  const width = (LAYOUT_CANVAS_W - GAP * (count - 1)) / count;
  return Array.from({ length: count }, (_, index) =>
    cellFromTopLeft(index * (width + GAP), 0, width, LAYOUT_CANVAS_H),
  );
}

function grid(columns: number, rows: number): LayoutCell[] {
  const width = (LAYOUT_CANVAS_W - GAP * (columns - 1)) / columns;
  const height = (LAYOUT_CANVAS_H - GAP * (rows - 1)) / rows;
  const cells: LayoutCell[] = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      cells.push(
        cellFromTopLeft(column * (width + GAP), row * (height + GAP), width, height),
      );
    }
  }
  return cells;
}

/** Center-relative cells for the 960×540 editor canvas, in reading order. */
export function getLayoutCells(layoutId: string): LayoutCell[] {
  const rowH = (LAYOUT_CANVAS_H - GAP) / 2;
  const colW = (LAYOUT_CANVAS_W - GAP) / 2;

  switch (layoutId) {
    case "1-Column":
      return [cellFromTopLeft(0, 0, LAYOUT_CANVAS_W, LAYOUT_CANVAS_H)];
    case "2:1 Horizontal":
      return rowSplit(2);
    case "2:1 Vertical":
      return columnSplit(2);
    case "3-Row":
      return rowSplit(3);
    case "3-Column":
      return columnSplit(3);
    case "4-Grid":
      return grid(2, 2);
    case "Top-BottomSplit":
      return [
        cellFromTopLeft(0, 0, LAYOUT_CANVAS_W, rowH),
        cellFromTopLeft(0, rowH + GAP, colW, rowH),
        cellFromTopLeft(colW + GAP, rowH + GAP, colW, rowH),
      ];
    case "Top2-Bottom1":
      return [
        cellFromTopLeft(0, 0, colW, rowH),
        cellFromTopLeft(colW + GAP, 0, colW, rowH),
        cellFromTopLeft(0, rowH + GAP, LAYOUT_CANVAS_W, rowH),
      ];
    case "Left2-Right1":
      return [
        cellFromTopLeft(0, 0, colW, rowH),
        cellFromTopLeft(0, rowH + GAP, colW, rowH),
        cellFromTopLeft(colW + GAP, 0, colW, LAYOUT_CANVAS_H),
      ];
    case "Left1-Right2":
      return [
        cellFromTopLeft(0, 0, colW, LAYOUT_CANVAS_H),
        cellFromTopLeft(colW + GAP, 0, colW, rowH),
        cellFromTopLeft(colW + GAP, rowH + GAP, colW, rowH),
      ];
    default:
      return [];
  }
}

/** Stroke every layout pane, including empty ones, using the same origin as clip transforms. */
export function drawLayoutStrokes(
  ctx: CanvasRenderingContext2D,
  layoutId: string | null | undefined,
  canvasWidth: number,
  canvasHeight: number,
) {
  if (!layoutId) return;
  const cells = getLayoutCells(layoutId);
  if (cells.length === 0) return;

  const scaleX = canvasWidth / LAYOUT_CANVAS_W;
  const scaleY = canvasHeight / LAYOUT_CANVAS_H;

  ctx.save();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 3 * scaleX;
  ctx.lineJoin = "miter";

  for (const cell of cells) {
    const width = cell.width * scaleX;
    const height = cell.height * scaleY;
    const left = cell.x * scaleX + canvasWidth / 2 - width / 2;
    const top = cell.y * scaleY + canvasHeight / 2 - height / 2;
    const inset = ctx.lineWidth / 2;
    ctx.strokeRect(left + inset, top + inset, width - inset * 2, height - inset * 2);
  }

  ctx.restore();
}
