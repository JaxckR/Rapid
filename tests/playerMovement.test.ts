import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../src/core/config";
import { EMPTY_INPUT_ACTION_STATE } from "../src/input/actions";
import { PlayerController } from "../src/player/playerController";
import { updateHorizontalVelocity } from "../src/player/playerMovement";

const CONFIG = {
  maximumSpeed: 5.4,
  acceleration: 22,
  deceleration: 28,
};

function simulate(deltaSeconds: number): { readonly distance: number; readonly speed: number } {
  let velocity = { x: 0, y: 0 };
  let distance = 0;
  const steps = Math.round(2 / deltaSeconds);
  for (let index = 0; index < steps; index += 1) {
    velocity = updateHorizontalVelocity(velocity, { x: 0, y: 1 }, 0, deltaSeconds, CONFIG);
    distance += velocity.y * deltaSeconds;
  }
  return { distance, speed: Math.hypot(velocity.x, velocity.y) };
}

describe("Player movement", () => {
  it("keeps acceleration and travel consistent at 30, 60, and 120 Hz", () => {
    const results = [1 / 30, 1 / 60, 1 / 120].map(simulate);
    for (const result of results) expect(result.speed).toBeCloseTo(CONFIG.maximumSpeed, 6);
    const distances = results.map((result) => result.distance);
    expect(Math.max(...distances) - Math.min(...distances)).toBeLessThan(0.08);
  });

  it("moves relative to camera yaw and decelerates without input", () => {
    const moving = updateHorizontalVelocity({ x: 0, y: 0 }, { x: 0, y: 1 }, Math.PI / 2, 1, CONFIG);
    expect(moving.x).toBeCloseTo(CONFIG.maximumSpeed);
    expect(moving.y).toBeCloseTo(0);

    const stopped = updateHorizontalVelocity(moving, { x: 0, y: 0 }, 0, 1, CONFIG);
    expect(stopped).toEqual({ x: 0, y: 0 });
  });

  it("clamps vertical camera rotation and never creates jump velocity", () => {
    const controller = new PlayerController(100, GAME_CONFIG.player);
    controller.update({ ...EMPTY_INPUT_ACTION_STATE, look: { x: 0, y: 10_000 } }, 1 / 60);
    expect(controller.snapshot().pitch).toBe(GAME_CONFIG.player.maximumPitch);
    expect(controller.desiredVelocity().y).toBe(0);

    controller.update({ ...EMPTY_INPUT_ACTION_STATE, look: { x: 0, y: -20_000 } }, 1 / 60);
    expect(controller.snapshot().pitch).toBe(GAME_CONFIG.player.minimumPitch);
  });
});
