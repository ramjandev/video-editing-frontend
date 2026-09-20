/**
 * Browser Export Engine
 * Unified rendering engine that orchestrates canvas-based frame rendering
 * and routes to the optimal encoder (WebCodecs → WASM → MediaRecorder → Server).
 *
 * Flow:
 * 1. Detect browser capabilities
 * 2. Initialize the appropriate encoder
 * 3. Render each frame on an offscreen canvas
 * 4. Feed frames to the encoder
 * 5. Finalize and upload the MP4 blob to the server
 */
import { detectCapabilities, estimateRenderTimeSec } from './browserCapabilities';
import { WebCodecEncoder } from './webcodecEncoder';
import { WasmEncoder } from './wasmEncoder';
import { getMediaUrl, API_BASE } from '@/lib/api';
import type { BrowserCapabilities } from './browserCapabilities';

export interface BrowserExportCallbacks {
  onProgress: (percent: number, status: string, etaSec: number | null) => void;
  onComplete: (uploadedUrl: string) => void;
  onError: (message: string) => void;
}

interface EncoderAdapter {
  init(totalFrames: number): Promise<void>;
  addFrame(canvas: HTMLCanvasElement): Promise<void>;
  finalize(): Promise<Blob>;
  destroy(): void;
}

/**
 * Check if we can render in the browser for targetMode ('browser' | 'server').
 */
export async function canRenderInBrowser(
  sceneGraph: any,
  targetMode: 'browser' | 'server' = 'server',
): Promise<{
  canRender: boolean;
  capabilities: BrowserCapabilities;
  estimatedSec: number;
  reason: string;
}> {
  const caps = await detectCapabilities();
  const estimatedSec = estimateRenderTimeSec(sceneGraph, caps);

  if (targetMode === 'server') {
    return {
      canRender: false,
      capabilities: caps,
      estimatedSec,
      reason: 'User selected Cloud Server Engine',
    };
  }

  if (caps.recommendedEncoder === 'server') {
    return {
      canRender: false,
      capabilities: caps,
      estimatedSec,
      reason: 'No in-browser encoder available in your browser',
    };
  }

  return {
    canRender: true,
    capabilities: caps,
    estimatedSec,
    reason: 'User selected Local Browser Engine',
  };
}

/**
 * Main browser export function.
 * Renders the sceneGraph frame-by-frame on canvas and encodes to MP4.
 */
export async function exportInBrowser(
  sceneGraph: any,
  callbacks: BrowserExportCallbacks,
): Promise<void> {
  const caps = await detectCapabilities();
  const fps = sceneGraph.fps || 30;
  const duration = sceneGraph.duration || 10;
  const totalFrames = Math.ceil(duration * fps);
  const width = sceneGraph.resolution?.w || 1280;
  const height = sceneGraph.resolution?.h || 720;

  let encoderName = '';
  let encoder: EncoderAdapter;

  // Select encoder based on capabilities
  if (caps.hasWebCodecs) {
    encoderName = 'WebCodecs H.264';
    encoder = new WebCodecEncoder({
      width,
      height,
      fps,
      bitrate: 4_000_000,
      onProgress: (p) => callbacks.onProgress(p, `Encoding with ${encoderName}...`, null),
    });
  } else if (caps.hasWasm && caps.hasSharedArrayBuffer) {
    encoderName = 'ffmpeg.wasm (WASM)';
    encoder = new WasmEncoder({
      width,
      height,
      fps,
      bitrate: 4_000_000,
      onProgress: (p) => callbacks.onProgress(p, `Encoding with ${encoderName}...`, null),
      onLog: (msg) => console.log('[WasmEncoder]', msg),
    });
  } else {
    // MediaRecorder fallback — produces WebM, not MP4
    encoderName = 'MediaRecorder (WebM)';
    encoder = createMediaRecorderAdapter(width, height, fps, (p) =>
      callbacks.onProgress(p, `Encoding with ${encoderName}...`, null),
    );
  }

  callbacks.onProgress(2, `Initializing ${encoderName} encoder...`, null);

  try {
    // 1. Initialize encoder
    await encoder.init(totalFrames);

    // 2. Create offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 3. Preload media assets
    callbacks.onProgress(5, 'Loading media assets...', null);
    const videoElements = await preloadAssets(sceneGraph);

    // 4. Render frame-by-frame
    const startTime = performance.now();

    for (let frame = 0; frame < totalFrames; frame++) {
      const currentTime = frame / fps;

      // Clear canvas
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      // Find and draw active clips
      const activeClips = findActiveClips(sceneGraph, currentTime);

      for (const clip of activeClips) {
        drawClip(ctx, clip, currentTime, width, height, videoElements);
      }

      // Feed frame to encoder
      await encoder.addFrame(canvas);

      // Calculate ETA
      const elapsed = (performance.now() - startTime) / 1000;
      const framesPerSec = (frame + 1) / elapsed;
      const remainingFrames = totalFrames - frame - 1;
      const etaSec = framesPerSec > 0 ? remainingFrames / framesPerSec : null;

      // Progress: 5-85% for rendering, 85-95% for encoding finalization
      const renderPercent = Math.round(5 + (frame / totalFrames) * 80);
      callbacks.onProgress(renderPercent, `Rendering frame ${frame + 1}/${totalFrames} (${encoderName})`, etaSec);

      // Yield to browser every 2 frames to prevent UI freeze
      if (frame % 2 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    }

    // 5. Finalize encoding
    callbacks.onProgress(88, 'Finalizing video encoding...', 3);
    const videoBlob = await encoder.finalize();

    // 6. Upload to server
    callbacks.onProgress(92, 'Uploading rendered video to server...', null);
    const uploadedUrl = await uploadToServer(videoBlob, encoderName.includes('WebM') ? 'webm' : 'mp4');

    callbacks.onProgress(100, 'Export complete!', 0);
    callbacks.onComplete(uploadedUrl);

    // Cleanup video elements
    videoElements.forEach((v) => {
      v.pause();
      v.src = '';
    });
  } catch (err: any) {
    console.error('[BrowserExportEngine] Export failed:', err);
    callbacks.onError(err.message || 'Browser export failed');
  } finally {
    encoder.destroy();
  }
}

// ──────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────

async function preloadAssets(sceneGraph: any): Promise<Map<string, HTMLVideoElement>> {
  const videoElements = new Map<string, HTMLVideoElement>();
  const loadPromises: Promise<void>[] = [];

  for (const track of sceneGraph.tracks || []) {
    for (const clip of track.clips || []) {
      if (clip.asset?.type === 'video' || clip.asset?.type === 'audio') {
        const v = document.createElement('video');
        v.crossOrigin = 'anonymous';
        v.preload = 'auto';
        v.muted = true;
        v.src = getMediaUrl(clip.asset.original_url || clip.asset.preview_url);

        loadPromises.push(
          new Promise<void>((resolve) => {
            v.onloadeddata = () => resolve();
            v.onerror = () => resolve();
            setTimeout(resolve, 5000); // 5s timeout per asset
          }),
        );

        v.load();
        videoElements.set(clip.assetId, v);
      }
    }
  }

  await Promise.all(loadPromises);
  return videoElements;
}

function findActiveClips(sceneGraph: any, currentTime: number): any[] {
  const active: any[] = [];
  for (const track of sceneGraph.tracks || []) {
    for (const clip of track.clips || []) {
      if (currentTime >= clip.startTime && currentTime <= clip.endTime) {
        active.push(clip);
      }
    }
  }
  // Reverse so bottom tracks render first (painters algorithm)
  return active.reverse();
}

function drawClip(
  ctx: CanvasRenderingContext2D,
  clip: any,
  currentTime: number,
  canvasWidth: number,
  canvasHeight: number,
  videoElements: Map<string, HTMLVideoElement>,
): void {
  if (clip.asset?.type === 'video') {
    const vid = videoElements.get(clip.assetId);
    if (vid && vid.readyState >= 2) {
      const targetTime = (clip.trimIn || 0) + (currentTime - clip.startTime);
      if (Math.abs(vid.currentTime - targetTime) > 0.05) {
        vid.currentTime = targetTime;
      }
      const scale = Math.min(canvasWidth / vid.videoWidth, canvasHeight / vid.videoHeight);
      const dw = vid.videoWidth * scale;
      const dh = vid.videoHeight * scale;
      ctx.drawImage(vid, (canvasWidth - dw) / 2, (canvasHeight - dh) / 2, dw, dh);
    }
  } else if (clip.asset?.type === 'image') {
    // Images would need preloading too — handled similarly
  } else if (clip.asset?.type === 'text') {
    ctx.save();
    ctx.font = `bold ${Math.round(canvasHeight * 0.07)}px Inter, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clip.asset.content || '', canvasWidth / 2, canvasHeight / 2);
    ctx.restore();
  }
}

async function uploadToServer(blob: Blob, format: string): Promise<string> {
  const formData = new FormData();
  const fileName = `browser_export_${Date.now()}.${format}`;
  formData.append('file', blob, fileName);

  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/export/browser-upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed with status ${response.status}`);
  }

  const result = await response.json();
  return result.url;
}

/**
 * MediaRecorder adapter — wraps the legacy MediaRecorder API
 * to conform to the EncoderAdapter interface.
 * Produces WebM output (not MP4).
 */
function createMediaRecorderAdapter(
  width: number,
  height: number,
  fps: number,
  onProgress: (percent: number) => void,
): EncoderAdapter {
  let canvas: HTMLCanvasElement | null = null;
  let stream: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let frameCount = 0;
  let totalFrames = 0;

  return {
    async init(total: number) {
      totalFrames = total;
      frameCount = 0;
      chunks = [];

      canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      stream = canvas.captureStream(fps);

      let mimeType = 'video/webm;codecs=vp9';
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm;codecs=vp8';
      }
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = 'video/webm';
      }

      recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 4_000_000,
      });

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.start(100);
    },

    async addFrame(sourceCanvas: HTMLCanvasElement) {
      // Copy source canvas to the stream canvas
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(sourceCanvas, 0, 0);
        }
      }
      frameCount++;
      const percent = Math.round((frameCount / totalFrames) * 90);
      onProgress(percent);
    },

    async finalize(): Promise<Blob> {
      return new Promise((resolve) => {
        if (!recorder) {
          resolve(new Blob(chunks, { type: 'video/webm' }));
          return;
        }

        recorder.onstop = () => {
          resolve(new Blob(chunks, { type: recorder?.mimeType || 'video/webm' }));
        };

        recorder.stop();
      });
    },

    destroy() {
      if (recorder && recorder.state !== 'inactive') {
        try { recorder.stop(); } catch {}
      }
      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }
      canvas = null;
      stream = null;
      recorder = null;
      chunks = [];
    },
  };
}
