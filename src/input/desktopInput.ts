import { clamp } from "../core/math";
import type { InputActionState, InputSettings, InputSource } from "./actions";
import { DesktopActionMapper } from "./desktopActionMapper";

export class DesktopInput implements InputSource {
  public readonly mode = "desktop" as const;
  private pointerWasLocked = false;
  private ignoreNextPointerLockLoss = false;

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly maximumLookDeltaPixels: number,
    private readonly mapper = new DesktopActionMapper(),
  ) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    document.addEventListener("pointerlockchange", this.onPointerLockChange);
    this.canvas.addEventListener("pointerdown", this.onCanvasPointerDown);
  }

  public sample(settings: InputSettings): InputActionState {
    return this.mapper.sample(settings);
  }

  public reset(): void {
    this.mapper.reset();
  }

  public releasePointerLock(): void {
    if (document.pointerLockElement !== this.canvas) return;
    this.ignoreNextPointerLockLoss = true;
    void document.exitPointerLock();
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    document.removeEventListener("pointerlockchange", this.onPointerLockChange);
    this.canvas.removeEventListener("pointerdown", this.onCanvasPointerDown);
    this.releasePointerLock();
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.code === "Escape" && !event.repeat) {
      this.mapper.reset();
      this.releasePointerLock();
    }
    this.mapper.keyDown(event.code, event.repeat);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => this.mapper.keyUp(event.code);

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.mapper.addLookDelta(
      clamp(event.movementX, -this.maximumLookDeltaPixels, this.maximumLookDeltaPixels),
      clamp(event.movementY, -this.maximumLookDeltaPixels, this.maximumLookDeltaPixels),
    );
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0 && document.pointerLockElement === this.canvas) {
      this.mapper.setFiring(true);
    }
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.mapper.setFiring(false);
  };

  private readonly onCanvasPointerDown = (event: PointerEvent): void => {
    if (
      event.pointerType !== "mouse" ||
      event.button !== 0 ||
      document.pointerLockElement !== null
    ) {
      return;
    }
    void this.canvas.requestPointerLock().catch(() => undefined);
  };

  private readonly onPointerLockChange = (): void => {
    const locked = document.pointerLockElement === this.canvas;
    if (this.pointerWasLocked && !locked) {
      this.mapper.reset();
      if (!this.ignoreNextPointerLockLoss) this.mapper.requestPause("force");
    }
    this.ignoreNextPointerLockLoss = false;
    this.pointerWasLocked = locked;
  };
}
