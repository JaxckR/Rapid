import type { Vec2 } from "../core/math";

export const INPUT_ACTIONS = ["move", "look", "fire", "interact", "pause"] as const;

export type InputAction = (typeof INPUT_ACTIONS)[number];
export type PauseIntent = "none" | "toggle" | "force";

export interface InputActionState {
  readonly move: Vec2;
  readonly look: Vec2;
  readonly fire: boolean;
  readonly interact: boolean;
  readonly pause: PauseIntent;
}

export interface InputSource {
  readonly mode: InputMode;
  sample(settings: InputSettings): InputActionState;
  reset(): void;
  dispose(): void;
}

export type InputMode = "desktop" | "touch";

export interface InputSettings {
  readonly mouseSensitivity: number;
  readonly touchSensitivity: number;
  readonly leftHanded: boolean;
}

export const EMPTY_INPUT_ACTION_STATE: InputActionState = Object.freeze({
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  fire: false,
  interact: false,
  pause: "none",
});
