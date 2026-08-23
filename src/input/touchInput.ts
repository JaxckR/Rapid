import { clamp, normalize2, type Vec2 } from "../core/math";
import { EMPTY_ACTIONS, type InputActions, type InputSource } from "./actions";
import { requireElement } from "./dom";

export class TouchInput implements InputSource {
  private movePointer: number | undefined;
  private lookPointer: number | undefined;
  private moveOrigin: Vec2 = { x: 0, y: 0 };
  private move: Vec2 = { x: 0, y: 0 };
  private previousLook: Vec2 = { x: 0, y: 0 };
  private lookDelta: Vec2 = { x: 0, y: 0 };
  private firing = false;
  private interactRequested = false;
  private pauseRequested = false;
  private readonly moveZone = requireElement<HTMLDivElement>("move-zone");
  private readonly moveStick = requireElement<HTMLDivElement>("move-stick");
  private readonly fireButton = requireElement<HTMLButtonElement>("fire-button");
  private readonly interactButton = requireElement<HTMLButtonElement>("interact-button");
  private readonly pauseButton = requireElement<HTMLButtonElement>("pause-button");

  public constructor(private readonly canvas: HTMLCanvasElement) {
    this.moveZone.addEventListener("pointerdown", this.onMoveStart);
    this.canvas.addEventListener("pointerdown", this.onLookStart);
    window.addEventListener("pointermove", this.onPointerMove);
    window.addEventListener("pointerup", this.onPointerEnd);
    window.addEventListener("pointercancel", this.onPointerEnd);
    this.fireButton.addEventListener("pointerdown", this.onFireStart);
    this.fireButton.addEventListener("pointerup", this.onFireEnd);
    this.fireButton.addEventListener("pointercancel", this.onFireEnd);
    this.interactButton.addEventListener("pointerdown", this.onInteract);
    this.pauseButton.addEventListener("pointerdown", this.onPause);
  }

  public sample(): InputActions {
    if (navigator.maxTouchPoints === 0) return EMPTY_ACTIONS;
    const actions: InputActions = {
      move: this.move,
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
    this.moveZone.removeEventListener("pointerdown", this.onMoveStart);
    this.canvas.removeEventListener("pointerdown", this.onLookStart);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerEnd);
    window.removeEventListener("pointercancel", this.onPointerEnd);
    this.fireButton.removeEventListener("pointerdown", this.onFireStart);
    this.fireButton.removeEventListener("pointerup", this.onFireEnd);
    this.fireButton.removeEventListener("pointercancel", this.onFireEnd);
    this.interactButton.removeEventListener("pointerdown", this.onInteract);
    this.pauseButton.removeEventListener("pointerdown", this.onPause);
  }

  private readonly onMoveStart = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" || this.movePointer !== undefined) return;
    event.stopPropagation();
    this.movePointer = event.pointerId;
    this.moveOrigin = { x: event.clientX, y: event.clientY };
    this.moveZone.setPointerCapture(event.pointerId);
  };

  private readonly onLookStart = (event: PointerEvent): void => {
    if (event.pointerType === "mouse" || this.lookPointer !== undefined) return;
    this.lookPointer = event.pointerId;
    this.previousLook = { x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId === this.movePointer) {
      const radius = 48;
      const offset = {
        x: clamp(event.clientX - this.moveOrigin.x, -radius, radius),
        y: clamp(event.clientY - this.moveOrigin.y, -radius, radius),
      };
      this.move = normalize2({ x: offset.x, y: -offset.y });
      this.moveStick.style.translate = `calc(-50% + ${offset.x}px) calc(-50% + ${offset.y}px)`;
    }
    if (event.pointerId === this.lookPointer) {
      this.lookDelta = {
        x: this.lookDelta.x + event.clientX - this.previousLook.x,
        y: this.lookDelta.y + event.clientY - this.previousLook.y,
      };
      this.previousLook = { x: event.clientX, y: event.clientY };
    }
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (event.pointerId === this.movePointer) {
      this.movePointer = undefined;
      this.move = { x: 0, y: 0 };
      this.moveStick.style.translate = "-50% -50%";
    }
    if (event.pointerId === this.lookPointer) this.lookPointer = undefined;
  };

  private readonly onFireStart = (event: PointerEvent): void => {
    event.stopPropagation();
    this.firing = true;
    this.fireButton.setPointerCapture(event.pointerId);
  };

  private readonly onFireEnd = (event: PointerEvent): void => {
    event.stopPropagation();
    this.firing = false;
  };

  private readonly onInteract = (event: PointerEvent): void => {
    event.stopPropagation();
    this.interactRequested = true;
  };

  private readonly onPause = (event: PointerEvent): void => {
    event.stopPropagation();
    this.pauseRequested = true;
  };
}
