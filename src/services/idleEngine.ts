import type { NodeState } from '@/types';

export interface IdleEngineConfig {
  mouse: number;
  keyboard: number;
  click: number;
  scroll: number;
  touch: number;
  idleThreshold: number;
  activeScore: number;
  candidateScore: number;
  heartbeatInterval: number;
}

export const DEFAULT_IDLE_CONFIG: IdleEngineConfig = {
  mouse: 30_000,
  keyboard: 30_000,
  click: 45_000,
  scroll: 45_000,
  touch: 45_000,
  idleThreshold: 60_000,
  activeScore: 40,
  candidateScore: 20,
  heartbeatInterval: 5_000,
};

export type PreemptCallback = (reason: string) => void;
export type StateChangeCallback = (state: NodeState, score: number, idleSeconds: number) => void;

export class IdleEngine {
  private config: IdleEngineConfig;
  private lastActivity = {
    mouse: 0,
    keyboard: 0,
    click: 0,
    scroll: 0,
    touch: 0,
  };

  private currentState: NodeState = 'ACTIVE';
  private evaluationTimer: any = null;
  private isRendering = false;
  private pauseRequested = false;

  private onPreemptCb: PreemptCallback | null = null;
  private onStateChangeCb: StateChangeCallback | null = null;

  constructor(config: Partial<IdleEngineConfig> = {}) {
    this.config = { ...DEFAULT_IDLE_CONFIG, ...config };
  }

  public init(onPreempt: PreemptCallback, onStateChange: StateChangeCallback) {
    this.onPreemptCb = onPreempt;
    this.onStateChangeCb = onStateChange;

    const now = Date.now();
    this.lastActivity = {
      mouse: now,
      keyboard: now,
      click: now,
      scroll: now,
      touch: now,
    };

    this.attachListeners();
    this.evaluationTimer = setInterval(() => this.evaluate(), 1_000);
  }

  public destroy() {
    this.detachListeners();
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
  }

  public setRendering(isRendering: boolean) {
    this.isRendering = isRendering;
    if (isRendering) {
      this.pauseRequested = false;
      this.transitionTo('RENDERING');
    } else {
      this.evaluate();
    }
  }

  public isPauseRequested(): boolean {
    return this.pauseRequested;
  }

  public clearPauseRequest() {
    this.pauseRequested = false;
  }

  public getCurrentState(): NodeState {
    return this.currentState;
  }

  public getTelemetry(): { state: NodeState; score: number; idleSeconds: number; workerAvailable: boolean } {
    const { score, idleTimeMs } = this.calculateScore();
    const idleSeconds = Math.floor(idleTimeMs / 1000);
    return {
      state: this.currentState,
      score,
      idleSeconds,
      workerAvailable: this.currentState === 'IDLE' && !this.isRendering,
    };
  }

  private register(type: keyof typeof this.lastActivity) {
    this.lastActivity[type] = Date.now();

    // Fast-path: Immediate synchronous local preemption if currently rendering
    if (this.isRendering) {
      this.pauseRequested = true;
      this.isRendering = false;
      this.transitionTo('PREEMPTED');

      if (this.onPreemptCb) {
        this.onPreemptCb(`USER_INPUT_${type.toUpperCase()}`);
      }

      // Restore to ACTIVE after signaling local yield
      setTimeout(() => {
        if (this.currentState === 'PREEMPTED') {
          this.transitionTo('ACTIVE');
        }
      }, 50);
    } else if (this.currentState !== 'ACTIVE') {
      this.evaluate();
    }
  }

  public calculateScore(): { score: number; idleTimeMs: number } {
    const now = Date.now();
    let score = 0;

    const weights = {
      keyboard: { threshold: this.config.keyboard, weight: 25 },
      mouse:    { threshold: this.config.mouse,    weight: 20 },
      click:    { threshold: this.config.click,    weight: 20 },
      touch:    { threshold: this.config.touch,    weight: 15 },
      scroll:   { threshold: this.config.scroll,   weight: 10 },
    };

    let maxLastActivity = 0;
    for (const [key, conf] of Object.entries(weights)) {
      const last = this.lastActivity[key as keyof typeof weights];
      maxLastActivity = Math.max(maxLastActivity, last);
      const elapsed = now - last;
      if (elapsed <= conf.threshold) {
        score += conf.weight;
      }
    }

    // Context modifier: tab visibility
    if (typeof document !== 'undefined' && !document.hidden) {
      score += 10;
    }

    const idleTimeMs = now - maxLastActivity;
    return { score, idleTimeMs };
  }

  private evaluate() {
    if (this.isRendering || this.currentState === 'PREEMPTED') {
      return;
    }

    const { score, idleTimeMs } = this.calculateScore();
    const idleSeconds = Math.floor(idleTimeMs / 1000);

    let nextState: NodeState;
    if (score >= this.config.activeScore || idleTimeMs < 30_000) {
      nextState = 'ACTIVE';
    } else if (idleTimeMs >= this.config.idleThreshold && score < this.config.candidateScore) {
      nextState = 'IDLE';
    } else {
      nextState = 'IDLE_CANDIDATE';
    }

    this.transitionTo(nextState, score, idleSeconds);
  }

  private transitionTo(newState: NodeState, score?: number, idleSeconds?: number) {
    if (this.currentState !== newState) {
      this.currentState = newState;

      const calc = this.calculateScore();
      const s = typeof score === 'number' ? score : calc.score;
      const i = typeof idleSeconds === 'number' ? idleSeconds : Math.floor(calc.idleTimeMs / 1000);

      if (this.onStateChangeCb) {
        this.onStateChangeCb(newState, s, i);
      }
    }
  }

  private handleMouseMove = () => this.register('mouse');
  private handleKeyDown = () => this.register('keyboard');
  private handleClick = () => this.register('click');
  private handleScroll = () => this.register('scroll');
  private handleTouch = () => this.register('touch');

  private attachListeners() {
    if (typeof window === 'undefined') return;
    window.addEventListener('mousemove', this.handleMouseMove, { passive: true });
    window.addEventListener('keydown', this.handleKeyDown, { passive: true });
    window.addEventListener('click', this.handleClick, { passive: true });
    window.addEventListener('scroll', this.handleScroll, { passive: true });
    window.addEventListener('touchstart', this.handleTouch, { passive: true });
  }

  private detachListeners() {
    if (typeof window === 'undefined') return;
    window.removeEventListener('mousemove', this.handleMouseMove);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('click', this.handleClick);
    window.removeEventListener('scroll', this.handleScroll);
    window.removeEventListener('touchstart', this.handleTouch);
  }
}

export const idleEngine = new IdleEngine();
export default idleEngine;
