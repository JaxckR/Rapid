import { describe, expect, it } from "vitest";
import { RoomGenerator } from "../src/generation/roomGenerator";

const options = {
  width: 18,
  length: 28,
  obstacleCount: 8,
  maximumAttempts: 80,
  minimumObstacleSpacing: 1.4,
};

describe("RoomGenerator", () => {
  it("is deterministic for a given seed and preserves a path", () => {
    const generator = new RoomGenerator(options);
    const first = generator.generate("test-seed");
    const second = generator.generate("test-seed");

    expect(first).toEqual(second);
    expect(generator.hasPath(first.obstacles)).toBe(true);
    expect(first.enemySpawnPoints).toHaveLength(4);
  });

  it("uses a safe fallback when the attempt limit is exhausted", () => {
    const generator = new RoomGenerator({ ...options, maximumAttempts: 0 });
    const layout = generator.generate("fallback-seed");

    expect(layout.usedFallback).toBe(true);
    expect(generator.hasPath(layout.obstacles)).toBe(true);
  });
});
