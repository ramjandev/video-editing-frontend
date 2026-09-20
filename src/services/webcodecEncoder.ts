/**
 * WebCodecs H.264 Encoder + MP4 Muxer
 * Uses the browser's hardware-accelerated VideoEncoder API (Chrome/Edge)
 * and mp4-muxer to produce MP4 output from canvas frames.
 */
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface WebCodecEncoderOptions {
  width: number;
  height: number;
  fps: number;
  bitrate?: number;
  onProgress?: (percent: number) => void;
}

export class WebCodecEncoder {
  private muxer: Muxer<ArrayBufferTarget> | null = null;
  private encoder: VideoEncoder | null = null;
  private frameIndex = 0;
  private totalFrames = 0;
  private options: Required<WebCodecEncoderOptions>;
  private encodedFrameCount = 0;

  constructor(opts: WebCodecEncoderOptions) {
    this.options = {
      width: opts.width,
      height: opts.height,
      fps: opts.fps,
      bitrate: opts.bitrate || 4_000_000,
      onProgress: opts.onProgress || (() => {}),
    };
  }

  async init(totalFrames: number): Promise<void> {
    this.totalFrames = totalFrames;
    this.frameIndex = 0;
    this.encodedFrameCount = 0;

    this.muxer = new Muxer({
      target: new ArrayBufferTarget(),
      video: {
        codec: 'avc',
        width: this.options.width,
        height: this.options.height,
      },
      fastStart: 'in-memory',
    });

    const muxer = this.muxer;

    this.encoder = new VideoEncoder({
      output: (chunk, meta) => {
        muxer.addVideoChunk(chunk, meta ?? undefined);
        this.encodedFrameCount++;
      },
      error: (e) => {
        console.error('[WebCodecEncoder] Encoder error:', e);
      },
    });

    this.encoder.configure({
      codec: 'avc1.42001f', // H.264 Baseline Level 3.1
      width: this.options.width,
      height: this.options.height,
      bitrate: this.options.bitrate,
      framerate: this.options.fps,
      latencyMode: 'quality',
      avc: { format: 'avc' },
    });
  }

  async addFrame(canvas: HTMLCanvasElement): Promise<void> {
    if (!this.encoder || this.encoder.state === 'closed') return;

    const timestamp = (this.frameIndex / this.options.fps) * 1_000_000; // microseconds
    const duration = (1 / this.options.fps) * 1_000_000;

    const frame = new VideoFrame(canvas, {
      timestamp,
      duration,
    });

    // Insert keyframe every 2 seconds
    const isKeyFrame = this.frameIndex % (this.options.fps * 2) === 0;

    this.encoder.encode(frame, { keyFrame: isKeyFrame });
    frame.close();

    this.frameIndex++;

    // Report progress
    const percent = Math.round((this.frameIndex / this.totalFrames) * 90);
    this.options.onProgress(percent);

    // Backpressure: if encoder queue is building up, wait
    if (this.encoder.encodeQueueSize > 5) {
      await new Promise<void>((resolve) => {
        const check = () => {
          if (!this.encoder || this.encoder.encodeQueueSize <= 2) {
            resolve();
          } else {
            setTimeout(check, 1);
          }
        };
        check();
      });
    }
  }

  async finalize(): Promise<Blob> {
    if (!this.encoder || !this.muxer) {
      throw new Error('Encoder not initialized');
    }

    // Flush remaining frames
    await this.encoder.flush();
    this.encoder.close();

    // Finalize MP4
    this.muxer.finalize();

    const { buffer } = this.muxer.target;
    this.options.onProgress(95);

    return new Blob([buffer], { type: 'video/mp4' });
  }

  destroy(): void {
    if (this.encoder && this.encoder.state !== 'closed') {
      try { this.encoder.close(); } catch {}
    }
    this.encoder = null;
    this.muxer = null;
  }
}
