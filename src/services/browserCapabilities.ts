/**
 * Browser Capability Detection for Video Export
 * Detects WebCodecs, WASM, and MediaRecorder support to route
 * export rendering to the optimal encoder pipeline.
 */

export interface BrowserCapabilities {
  hasWebCodecs: boolean;
  hasWasm: boolean;
  hasMediaRecorder: boolean;
  hasSharedArrayBuffer: boolean;
  cores: number;
  memoryGb: number;
  browserName: 'chrome' | 'edge' | 'firefox' | 'safari' | 'other';
  recommendedEncoder: 'webcodecs' | 'wasm' | 'mediarecorder' | 'server';
}

let cachedCapabilities: BrowserCapabilities | null = null;

function detectBrowser(): BrowserCapabilities['browserName'] {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('edg/')) return 'edge';
  if (ua.includes('chrome') && !ua.includes('edg/')) return 'chrome';
  if (ua.includes('firefox')) return 'firefox';
  if (ua.includes('safari') && !ua.includes('chrome')) return 'safari';
  return 'other';
}

async function checkWebCodecsH264(): Promise<boolean> {
  if (typeof VideoEncoder === 'undefined') return false;
  try {
    const config = {
      codec: 'avc1.42001f', // H.264 Baseline Level 3.1
      width: 1280,
      height: 720,
      bitrate: 4_000_000,
      framerate: 30,
    };
    const support = await VideoEncoder.isConfigSupported(config);
    return support.supported === true;
  } catch {
    return false;
  }
}

function checkWasmSupport(): boolean {
  return typeof WebAssembly !== 'undefined' && typeof WebAssembly.instantiate === 'function';
}

function checkSharedArrayBuffer(): boolean {
  return typeof SharedArrayBuffer !== 'undefined';
}

function checkMediaRecorder(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
}

export async function detectCapabilities(): Promise<BrowserCapabilities> {
  if (cachedCapabilities) return cachedCapabilities;

  const hasWebCodecs = await checkWebCodecsH264();
  const hasWasm = checkWasmSupport();
  const hasSharedArrayBuffer = checkSharedArrayBuffer();
  const hasMediaRecorder = checkMediaRecorder();
  const cores = navigator.hardwareConcurrency || 4;
  const memoryGb = (navigator as any).deviceMemory || 4;
  const browserName = detectBrowser();

  // Determine recommended encoder:
  // 1. WebCodecs (Chrome/Edge) — hardware-accelerated H.264
  // 2. WASM (ffmpeg.wasm) — requires SharedArrayBuffer + COOP/COEP headers
  // 3. MediaRecorder — universal fallback (WebM output)
  // 4. Server — ultimate fallback
  let recommendedEncoder: BrowserCapabilities['recommendedEncoder'] = 'server';

  if (hasWebCodecs) {
    recommendedEncoder = 'webcodecs';
  } else if (hasWasm && hasSharedArrayBuffer) {
    recommendedEncoder = 'wasm';
  } else if (hasMediaRecorder) {
    recommendedEncoder = 'mediarecorder';
  }

  cachedCapabilities = {
    hasWebCodecs,
    hasWasm,
    hasMediaRecorder,
    hasSharedArrayBuffer,
    cores,
    memoryGb,
    browserName,
    recommendedEncoder,
  };

  console.log('[BrowserCapabilities]', cachedCapabilities);
  return cachedCapabilities;
}

/**
 * Estimate render time in seconds based on timeline duration, tracks, and hardware.
 * Returns estimated wall-clock seconds to render the video in-browser.
 */
export function estimateRenderTimeSec(sceneGraph: any, caps: BrowserCapabilities): number {
  const duration = sceneGraph.duration || 10;
  const fps = sceneGraph.fps || 30;
  const totalFrames = Math.ceil(duration * fps);
  const trackCount = (sceneGraph.tracks || []).length;
  const clipCount = (sceneGraph.tracks || []).reduce(
    (sum: number, t: any) => sum + (t.clips || []).length,
    0,
  );

  // Base: ~2ms per frame for simple scenes on a 4-core machine
  const baseMsPerFrame = 2;
  // Complexity multiplier based on clips
  const complexityMultiplier = 1 + (clipCount * 0.15) + (trackCount * 0.1);
  // Hardware multiplier (inverse of cores)
  const hardwareMultiplier = 4 / Math.max(caps.cores, 2);
  // Encoder overhead: WebCodecs is ~1x, WASM is ~3x, MediaRecorder is ~1.5x
  const encoderMultiplier =
    caps.recommendedEncoder === 'webcodecs' ? 1.0 :
    caps.recommendedEncoder === 'wasm' ? 3.0 :
    caps.recommendedEncoder === 'mediarecorder' ? 1.5 : 1.0;

  const totalMs = totalFrames * baseMsPerFrame * complexityMultiplier * hardwareMultiplier * encoderMultiplier;
  return totalMs / 1000;
}

/** Threshold in seconds (7 minutes) — if estimated render exceeds this, use server */
export const BROWSER_RENDER_THRESHOLD_SEC = 7 * 60;

export function shouldRenderInBrowser(sceneGraph: any, caps: BrowserCapabilities): boolean {
  if (caps.recommendedEncoder === 'server') return false;
  const estimatedSec = estimateRenderTimeSec(sceneGraph, caps);
  return estimatedSec < BROWSER_RENDER_THRESHOLD_SEC;
}
