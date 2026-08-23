import { clamp } from "./math";

export interface GameLoopCallbacks {
  readonly update: (fixedDeltaSeconds: number) => void;
  readonly render: (interpolation: number) => void;
}

export class FixedStepGameLoop {
  private accumulator = 0;
  private running = false;
  private previousTimeMs = 0;
  private frameHandle: number | undefined;

  public constructor(
    private readonly fixedStepSeconds: number,
    private readonly maximumFrameSeconds: number,
    private readonly maximumSubSteps: number,
    private readonly callbacks: GameLoopCallbacks,
  ) {}

  public start(): void {
    if (this.running) return;
    this.running = true;
    this.previousTimeMs = performance.now();
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  public stop(): void {
    this.running = false;
    if (this.frameHandle !== undefined) cancelAnimationFrame(this.frameHandle);
    this.frameHandle = undefined;
    this.accumulator = 0;
  }

  public advance(frameSeconds: number): number {
    this.accumulator += clamp(frameSeconds, 0, this.maximumFrameSeconds);
    let steps = 0;
    while (this.accumulator >= this.fixedStepSeconds && steps < this.maximumSubSteps) {
      this.callbacks.update(this.fixedStepSeconds);
      this.accumulator -= this.fixedStepSeconds;
      steps += 1;
    }
    if (steps === this.maximumSubSteps) this.accumulator = 0;
    this.callbacks.render(this.accumulator / this.fixedStepSeconds);
    return steps;
  }

  private readonly tick = (timeMs: number): void => {
    if (!this.running) return;
    this.advance((timeMs - this.previousTimeMs) / 1000);
    this.previousTimeMs = timeMs;
    this.frameHandle = requestAnimationFrame(this.tick);
  };
}
