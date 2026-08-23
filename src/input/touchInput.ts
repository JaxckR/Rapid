import type { InputActionState, InputSettings, InputSource } from "./actions";
import { requireElement } from "./dom";
import { isInTouchLookRegion, TouchActionMapper } from "./touchActionMapper";

export class TouchInput implements InputSource {
  public readonly mode = "touch" as const;
  private readonly moveZone = requireElement<HTMLDivElement>("move-zone");
  private readonly moveStick = requireElement<HTMLDivElement>("move-stick");
  private readonly fireButton = requireElement<HTMLButtonElement>("fire-button");
  private readonly interactButton = requireElement<HTMLButtonElement>("interact-button");
  private readonly pauseButton = requireElement<HTMLButtonElement>("pause-button");

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly joystickRadiusPixels: number,
    private readonly getSettings: () => InputSettings,
    private readonly mapper = new TouchActionMapper(),
  ) {
    this.moveZone.addEventListener("pointerdown", this.onMoveStart);
    this.canvas.addEventListener("pointerdown", this.onLookStart);
    window.addEventListener("pointermove", this.onPointerMove, { passive: false });
    window.addEventListener("pointerup", this.onPointerEnd);
    window.addEventListener("pointercancel", this.onPointerEnd);
    this.fireButton.addEventListener("pointerdown", this.onFireStart);
    this.fireButton.addEventListener("pointerup", this.onPointerEnd);
    this.fireButton.addEventListener("pointercancel", this.onPointerEnd);
    this.interactButton.addEventListener("pointerdown", this.onInteract);
    this.pauseButton.addEventListener("pointerdown", this.onPause);
  }

  public sample(settings: InputSettings): InputActionState {
    return this.mapper.sample(settings);
  }

  public reset(): void {
    this.mapper.reset();
    this.resetStick();
  }

  public dispose(): void {
    this.moveZone.removeEventListener("pointerdown", this.onMoveStart);
    this.canvas.removeEventListener("pointerdown", this.onLookStart);
    window.removeEventListener("pointermove", this.onPointerMove);
    window.removeEventListener("pointerup", this.onPointerEnd);
    window.removeEventListener("pointercancel", this.onPointerEnd);
    this.fireButton.removeEventListener("pointerdown", this.onFireStart);
    this.fireButton.removeEventListener("pointerup", this.onPointerEnd);
    this.fireButton.removeEventListener("pointercancel", this.onPointerEnd);
    this.interactButton.removeEventListener("pointerdown", this.onInteract);
    this.pauseButton.removeEventListener("pointerdown", this.onPause);
    this.reset();
  }

  private readonly onMoveStart = (event: PointerEvent): void => {
    if (!this.isTouchLike(event) || !this.mapper.beginMove(event.pointerId, this.position(event))) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.moveZone.setPointerCapture(event.pointerId);
  };

  private readonly onLookStart = (event: PointerEvent): void => {
    if (!this.isTouchLike(event)) return;
    const bounds = this.canvas.getBoundingClientRect();
    if (
      !isInTouchLookRegion(
        event.clientX,
        bounds.left,
        bounds.width,
        this.getSettings().leftHanded,
      ) ||
      !this.mapper.beginLook(event.pointerId, this.position(event))
    ) {
      return;
    }
    event.preventDefault();
    this.canvas.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (!this.isTouchLike(event)) return;
    this.mapper.updatePointer(event.pointerId, this.position(event), this.joystickRadiusPixels);
    const offset = this.mapper.currentMoveOffset();
    this.moveStick.style.translate =
      offset.x === 0 && offset.y === 0
        ? "-50% -50%"
        : `calc(-50% + ${offset.x}px) calc(-50% + ${offset.y}px)`;
    event.preventDefault();
  };

  private readonly onPointerEnd = (event: PointerEvent): void => {
    if (!this.isTouchLike(event)) return;
    this.mapper.endPointer(event.pointerId);
    const offset = this.mapper.currentMoveOffset();
    if (offset.x === 0 && offset.y === 0) this.resetStick();
    event.preventDefault();
    event.stopPropagation();
  };

  private readonly onFireStart = (event: PointerEvent): void => {
    if (!this.isTouchLike(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.mapper.beginFire(event.pointerId);
    this.fireButton.setPointerCapture(event.pointerId);
  };

  private readonly onInteract = (event: PointerEvent): void => {
    if (!this.isTouchLike(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.mapper.requestInteract();
  };

  private readonly onPause = (event: PointerEvent): void => {
    if (!this.isTouchLike(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.reset();
    this.mapper.requestPause();
  };

  private position(event: PointerEvent): { readonly x: number; readonly y: number } {
    return { x: event.clientX, y: event.clientY };
  }

  private isTouchLike(event: PointerEvent): boolean {
    return event.pointerType === "touch" || event.pointerType === "pen";
  }

  private resetStick(): void {
    this.moveStick.style.translate = "-50% -50%";
  }
}
