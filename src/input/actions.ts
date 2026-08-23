import type { Vec2 } from "../core/math";

export interface InputActions {
  readonly move: Vec2;
  readonly look: Vec2;
  readonly fire: boolean;
  readonly interact: boolean;
  readonly pause: boolean;
}

export interface InputSource {
  sample(): InputActions;
  dispose(): void;
}

export const EMPTY_ACTIONS: InputActions = Object.freeze({
  move: { x: 0, y: 0 },
  look: { x: 0, y: 0 },
  fire: false,
  interact: false,
  pause: false,
});
