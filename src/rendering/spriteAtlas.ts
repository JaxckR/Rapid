import type { EnemyAnimationState } from "../enemies/enemySystem";

export type EnemyViewDirection =
  "front" | "front_left" | "left" | "back_left" | "back" | "back_right" | "right" | "front_right";

export interface AtlasAnimation {
  readonly startRow: number;
  readonly frames: number;
  readonly framesPerSecond: number;
  readonly loop: boolean;
}

export interface SpriteAtlasDefinition {
  readonly columns: 8;
  readonly rows: number;
  readonly animations: Readonly<Record<EnemyAnimationState, AtlasAnimation>>;
}

export interface AtlasFrame {
  readonly column: number;
  readonly row: number;
  readonly direction: EnemyViewDirection;
  readonly u0: number;
  readonly v0: number;
  readonly u1: number;
  readonly v1: number;
}

export const ENEMY_ATLAS: SpriteAtlasDefinition = Object.freeze({
  columns: 8,
  rows: 26,
  animations: {
    idle: { startRow: 0, frames: 4, framesPerSecond: 4, loop: true },
    move: { startRow: 4, frames: 6, framesPerSecond: 8, loop: true },
    attack: { startRow: 10, frames: 6, framesPerSecond: 10, loop: false },
    hurt: { startRow: 16, frames: 2, framesPerSecond: 12, loop: false },
    death: { startRow: 18, frames: 8, framesPerSecond: 10, loop: false },
  },
});

const DIRECTIONS: readonly EnemyViewDirection[] = [
  "front",
  "front_left",
  "left",
  "back_left",
  "back",
  "back_right",
  "right",
  "front_right",
];

const TAU = Math.PI * 2;
const DIRECTION_STEP = TAU / 8;

export function normalizeAngle(angle: number): number {
  return ((angle % TAU) + TAU) % TAU;
}

export function selectViewDirection(
  enemyFacingYaw: number,
  enemyX: number,
  enemyZ: number,
  cameraX: number,
  cameraZ: number,
): { readonly index: number; readonly name: EnemyViewDirection } {
  const angleToCamera = Math.atan2(cameraX - enemyX, cameraZ - enemyZ);
  const index = Math.round(normalizeAngle(angleToCamera - enemyFacingYaw) / DIRECTION_STEP) % 8;
  return { index, name: DIRECTIONS[index] ?? "front" };
}

export function selectAtlasFrame(
  atlas: SpriteAtlasDefinition,
  state: EnemyAnimationState,
  elapsedSeconds: number,
  directionIndex: number,
): AtlasFrame {
  const animation = atlas.animations[state];
  const elapsedFrame = Math.max(0, Math.floor(elapsedSeconds * animation.framesPerSecond));
  const frame = animation.loop
    ? elapsedFrame % animation.frames
    : Math.min(elapsedFrame, animation.frames - 1);
  const column = Math.min(7, Math.max(0, Math.round(directionIndex)));
  const row = animation.startRow + frame;
  const cellWidth = 1 / atlas.columns;
  const cellHeight = 1 / atlas.rows;
  const u0 = column * cellWidth;
  const u1 = u0 + cellWidth;
  const v1 = Math.min(1, Math.max(0, 1 - row * cellHeight));
  const v0 = Math.min(1, Math.max(0, v1 - cellHeight));
  return { column, row, direction: DIRECTIONS[column] ?? "front", u0, v0, u1, v1 };
}

export function atlasFrameUvs(frame: AtlasFrame): number[] {
  return [frame.u0, frame.v0, frame.u1, frame.v0, frame.u1, frame.v1, frame.u0, frame.v1];
}
