import { clamp, normalize2, type Vec2 } from "../core/math";
import { EMPTY_ACTIONS, type InputActions, type InputSource } from "./actions";

export class DesktopInput implements InputSource {
  private readonly pressedKeys = new Set<string>();
  private lookDelta: Vec2 = { x: 0, y: 0 };
  private firing = false;
  private interactRequested = false;
  private pauseRequested = false;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDown);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("mousemove", this.onMouseMove);
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("click", this.onCanvasClick);
    this.canvas.addEventListener("contextmenu", this.preventContextMenu);
  }

  public sample(): InputActions {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return EMPTY_ACTIONS;
    const rawMove = {
      x: Number(this.pressedKeys.has("KeyD")) - Number(this.pressedKeys.has("KeyA")),
      y: Number(this.pressedKeys.has("KeyW")) - Number(this.pressedKeys.has("KeyS")),
    };
    const actions: InputActions = {
      move: normalize2(rawMove),
      look: this.lookDelta,
      fire: this.firing,
      interact: this.interactRequested,
      pause: this.pauseRequested,
    };
    this.lookDelta = { x: 0, y: 0 };
    this.interactRequested = false;
    this.pauseRequested = false;
    return actions;
  }

  public dispose(): void {
    window.removeEventListener("keydown", this.onKeyDown);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("mousemove", this.onMouseMove);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("click", this.onCanvasClick);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    this.pressedKeys.add(event.code);
    if (event.code === "KeyE" && !event.repeat) this.interactRequested = true;
    if (event.code === "Escape" && !event.repeat) this.pauseRequested = true;
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.pressedKeys.delete(event.code);
  };

  private readonly onMouseMove = (event: MouseEvent): void => {
    if (document.pointerLockElement !== this.canvas) return;
    this.lookDelta = {
      x: this.lookDelta.x + clamp(event.movementX, -160, 160),
      y: this.lookDelta.y + clamp(event.movementY, -160, 160),
    };
  };

  private readonly onMouseDown = (event: MouseEvent): void => {
    if (event.button === 0 && document.pointerLockElement === this.canvas) this.firing = true;
  };

  private readonly onMouseUp = (event: MouseEvent): void => {
    if (event.button === 0) this.firing = false;
  };

  private readonly onCanvasClick = (): void => {
    if (document.pointerLockElement === null) void this.canvas.requestPointerLock();
  };

  private readonly preventContextMenu = (event: Event): void => event.preventDefault();
}
