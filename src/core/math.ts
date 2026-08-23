export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export const ZERO_VEC2: Vec2 = Object.freeze({ x: 0, y: 0 });

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function length2(vector: Vec2): number {
  return Math.hypot(vector.x, vector.y);
}

export function normalize2(vector: Vec2): Vec2 {
  const length = length2(vector);
  if (length <= Number.EPSILON) return ZERO_VEC2;
  return { x: vector.x / length, y: vector.y / length };
}

export function distanceSquared3(left: Vec3, right: Vec3): number {
  const x = left.x - right.x;
  const y = left.y - right.y;
  const z = left.z - right.z;
  return x * x + y * y + z * z;
}
