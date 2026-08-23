import { normalize2, type Vec2 } from "../core/math";
import type { InputActionState, InputSettings, PauseIntent } from "./actions";

const MOVEMENT_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);

export class DesktopActionMapper {
  private readonly pressedKeys = new Set<string>();
  private lookDelta: Vec2 = { x: 0, y: 0 };
  private firing = false;
  private interactRequested = false;
  private pauseRequested: PauseIntent = "none";

  public keyDown(code: string, repeat = false): void {
    if (MOVEMENT_KEYS.has(code)) this.pressedKeys.add(code);
    if (code === "KeyE" && !repeat) this.interactRequested = true;
    if (code === "Escape" && !repeat) this.requestPause("toggle");
  }

  public keyUp(code: string): void {
    this.pressedKeys.delete(code);
  }

  public addLookDelta(x: number, y: number): void {
    this.lookDelta = { x: this.lookDelta.x + x, y: this.lookDelta.y + y };
  }

  public setFiring(firing: boolean): void {
    this.firing = firing;
  }

  public requestPause(intent: Exclude<PauseIntent, "none">): void {
    if (this.pauseRequested !== "force") this.pauseRequested = intent;
  }

  public sample(settings: InputSettings): InputActionState {
    const action: InputActionState = {
      move: normalize2({
        x: Number(this.pressedKeys.has("KeyD")) - Number(this.pressedKeys.has("KeyA")),
        y: Number(this.pressedKeys.has("KeyW")) - Number(this.pressedKeys.has("KeyS")),
      }),
      look: {
        x: this.lookDelta.x * settings.mouseSensitivity,
        y: this.lookDelta.y * settings.mouseSensitivity,
      },
      fire: this.firing,
      interact: this.interactRequested,
      pause: this.pauseRequested,
    };
    this.lookDelta = { x: 0, y: 0 };
    this.interactRequested = false;
    this.pauseRequested = "none";
    return action;
  }

  public reset(): void {
    this.pressedKeys.clear();
    this.lookDelta = { x: 0, y: 0 };
    this.firing = false;
    this.interactRequested = false;
    this.pauseRequested = "none";
  }
}
