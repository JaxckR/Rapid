import { length2, normalize2, type Vec2 } from "../core/math";

export interface HorizontalMovementConfig {
  readonly maximumSpeed: number;
  readonly acceleration: number;
  readonly deceleration: number;
}

export function updateHorizontalVelocity(
  current: Vec2,
  move: Vec2,
  yaw: number,
  deltaSeconds: number,
  config: HorizontalMovementConfig,
): Vec2 {
  const normalizedMove = normalize2(move);
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const rightX = Math.cos(yaw);
  const rightZ = -Math.sin(yaw);
  const target = {
    x: (rightX * normalizedMove.x + forwardX * normalizedMove.y) * config.maximumSpeed,
    y: (rightZ * normalizedMove.x + forwardZ * normalizedMove.y) * config.maximumSpeed,
  };
  const rate = length2(normalizedMove) > 0 ? config.acceleration : config.deceleration;
  return moveTowards(current, target, Math.max(0, rate) * Math.max(0, deltaSeconds));
}

function moveTowards(current: Vec2, target: Vec2, maximumDelta: number): Vec2 {
  const delta = { x: target.x - current.x, y: target.y - current.y };
  const distance = length2(delta);
  if (distance <= maximumDelta || distance <= Number.EPSILON) return target;
  const scale = maximumDelta / distance;
  return { x: current.x + delta.x * scale, y: current.y + delta.y * scale };
}
