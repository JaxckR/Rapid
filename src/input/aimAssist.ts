import { clamp, type Vec2, type Vec3 } from "../core/math";

export interface AimAssistContext {
  readonly deltaSeconds: number;
  readonly origin: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly targets: readonly Vec3[];
  readonly fire: boolean;
}

export interface AimAssistOptions {
  readonly maximumAngle: number;
  readonly turnRate: number;
  readonly lookSensitivity: number;
}

export function applyAimAssist(
  look: Vec2,
  context: AimAssistContext,
  options: AimAssistOptions,
): Vec2 {
  if ((!context.fire && look.x === 0 && look.y === 0) || context.targets.length === 0) {
    return look;
  }
  const correction = findBestCorrection(context, options.maximumAngle);
  if (correction === undefined) return look;

  const maximumCorrection = Math.max(0, options.turnRate) * Math.max(0, context.deltaSeconds);
  const sensitivity = Math.max(Number.EPSILON, options.lookSensitivity);
  return {
    x: look.x + clamp(correction.x, -maximumCorrection, maximumCorrection) / sensitivity,
    y: look.y + clamp(correction.y, -maximumCorrection, maximumCorrection) / sensitivity,
  };
}

function findBestCorrection(context: AimAssistContext, maximumAngle: number): Vec2 | undefined {
  let best: Vec2 | undefined;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const target of context.targets) {
    const x = target.x - context.origin.x;
    const y = target.y - context.origin.y;
    const z = target.z - context.origin.z;
    const horizontalDistance = Math.hypot(x, z);
    if (horizontalDistance <= Number.EPSILON) continue;
    const yawDelta = normalizeAngle(Math.atan2(x, z) - context.yaw);
    const pitchDelta = -Math.atan2(y, horizontalDistance) - context.pitch;
    const angularDistance = Math.hypot(yawDelta, pitchDelta);
    if (angularDistance > maximumAngle) continue;
    const distanceScore = Math.min((x * x + y * y + z * z) / 10_000, 0.05);
    const score = angularDistance + distanceScore;
    if (score >= bestScore) continue;
    bestScore = score;
    best = { x: yawDelta, y: pitchDelta };
  }
  return best;
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}
