import { clamp, normalize2, type Vec2 } from "../core/math";
import type { InputActionState, InputSettings, PauseIntent } from "./actions";

export interface PointerPosition {
  readonly x: number;
  readonly y: number;
}

export class TouchActionMapper {
  private movePointer: number | undefined;
  private lookPointer: number | undefined;
  private moveOrigin: PointerPosition = { x: 0, y: 0 };
  private previousLook: PointerPosition = { x: 0, y: 0 };
  private move: Vec2 = { x: 0, y: 0 };
  private moveOffset: Vec2 = { x: 0, y: 0 };
  private lookDelta: Vec2 = { x: 0, y: 0 };
  private readonly firePointers = new Set<number>();
  private interactRequested = false;
  private pauseRequested: PauseIntent = "none";

  public beginMove(pointerId: number, position: PointerPosition): boolean {
    if (this.movePointer !== undefined) return false;
    this.movePointer = pointerId;
    this.moveOrigin = position;
    return true;
  }

  public beginLook(pointerId: number, position: PointerPosition): boolean {
    if (this.lookPointer !== undefined) return false;
    this.lookPointer = pointerId;
    this.previousLook = position;
    return true;
  }

  public updatePointer(pointerId: number, position: PointerPosition, joystickRadius: number): void {
    if (pointerId === this.movePointer) {
      const radius = Math.max(1, joystickRadius);
      this.moveOffset = {
        x: clamp(position.x - this.moveOrigin.x, -radius, radius),
        y: clamp(position.y - this.moveOrigin.y, -radius, radius),
      };
      this.move = normalize2({ x: this.moveOffset.x, y: -this.moveOffset.y });
    }
    if (pointerId === this.lookPointer) {
      this.lookDelta = {
        x: this.lookDelta.x + position.x - this.previousLook.x,
        y: this.lookDelta.y + position.y - this.previousLook.y,
      };
      this.previousLook = position;
    }
  }

  public endPointer(pointerId: number): void {
    if (pointerId === this.movePointer) {
      this.movePointer = undefined;
      this.move = { x: 0, y: 0 };
      this.moveOffset = { x: 0, y: 0 };
    }
    if (pointerId === this.lookPointer) this.lookPointer = undefined;
    this.firePointers.delete(pointerId);
  }

  public beginFire(pointerId: number): void {
    this.firePointers.add(pointerId);
  }

  public requestInteract(): void {
    this.interactRequested = true;
  }

  public requestPause(): void {
    this.pauseRequested = "toggle";
  }

  public sample(settings: InputSettings): InputActionState {
    const action: InputActionState = {
      move: this.move,
      look: {
        x: this.lookDelta.x * settings.touchSensitivity,
        y: this.lookDelta.y * settings.touchSensitivity,
      },
      fire: this.firePointers.size > 0,
      interact: this.interactRequested,
      pause: this.pauseRequested,
    };
    this.lookDelta = { x: 0, y: 0 };
    this.interactRequested = false;
    this.pauseRequested = "none";
    return action;
  }

  public currentMoveOffset(): Vec2 {
    return this.moveOffset;
  }

  public reset(): void {
    this.movePointer = undefined;
    this.lookPointer = undefined;
    this.move = { x: 0, y: 0 };
    this.moveOffset = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this.firePointers.clear();
    this.interactRequested = false;
    this.pauseRequested = "none";
  }
}

export function isInTouchLookRegion(
  clientX: number,
  canvasLeft: number,
  canvasWidth: number,
  leftHanded: boolean,
): boolean {
  const midpoint = canvasLeft + canvasWidth / 2;
  return leftHanded ? clientX < midpoint : clientX >= midpoint;
}
