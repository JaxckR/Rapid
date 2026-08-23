import { describe, expect, it } from "vitest";
import { applyAimAssist } from "../src/input/aimAssist";

const OPTIONS = {
  maximumAngle: 0.12,
  turnRate: 0.6,
  lookSensitivity: 0.01,
};

describe("Mobile aim assist", () => {
  it("adds a small bounded correction toward a target inside the assist cone", () => {
    const look = applyAimAssist(
      { x: 0, y: 0 },
      {
        deltaSeconds: 1 / 60,
        origin: { x: 0, y: 1.6, z: 0 },
        yaw: 0,
        pitch: 0,
        targets: [{ x: 0.5, y: 1.6, z: 10 }],
        fire: true,
      },
      OPTIONS,
    );

    expect(look.x).toBeGreaterThan(0);
    expect(look.x * OPTIONS.lookSensitivity).toBeLessThanOrEqual(OPTIONS.turnRate / 60);
    expect(look.y).toBeCloseTo(0);
  });

  it("does not steer passively or toward targets outside the cone", () => {
    const context = {
      deltaSeconds: 1 / 60,
      origin: { x: 0, y: 1.6, z: 0 },
      yaw: 0,
      pitch: 0,
      targets: [{ x: 10, y: 1.6, z: 1 }],
      fire: false,
    };
    expect(applyAimAssist({ x: 0, y: 0 }, context, OPTIONS)).toEqual({ x: 0, y: 0 });
    expect(applyAimAssist({ x: 1, y: 0 }, context, OPTIONS)).toEqual({ x: 1, y: 0 });
  });
});
