import { create as createQRCode } from "qrcode";

/**
 * Scannable QR matrix for the canvas preview and export.
 */
export function generateQRMatrix(text: string): boolean[][] {
  const data = text || "https://example.com";
  try {
    const symbol = createQRCode(data, { errorCorrectionLevel: "M" });
    const size = symbol.modules.size;
    return Array.from({ length: size }, (_, row) =>
      Array.from({ length: size }, (_, col) => symbol.modules.get(row, col) === 1),
    );
  } catch {
    const size = 21;
    return Array.from({ length: size }, () => Array(size).fill(false));
  }
}

/**
 * Draw QR Code directly on a CanvasRenderingContext2D at specified position and size
 */
export function drawQRCode(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fgColor: string = "#000000",
  bgColor: string = "#ffffff"
) {
  const grid = generateQRMatrix(text);
  const size = grid.length;
  const quiet = Math.min(width, height) * 0.08;
  const innerX = x + quiet;
  const innerY = y + quiet;
  const cellSizeX = (width - quiet * 2) / size;
  const cellSizeY = (height - quiet * 2) / size;

  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.fillRect(x, y, width, height);

  ctx.fillStyle = fgColor;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c]) {
        ctx.fillRect(
          innerX + c * cellSizeX,
          innerY + r * cellSizeY,
          cellSizeX + 0.5,
          cellSizeY + 0.5,
        );
      }
    }
  }
  ctx.restore();
}
