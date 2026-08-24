import { describe, expect, it } from "vitest";
import { RoomGenerator } from "../src/generation/roomGenerator";
import type { GeneratedObstacle } from "../src/generation/roomGenerator";

const options = {
  width: 18,
  length: 28,
  obstacleCount: 8,
  maximumAttempts: 80,
  minimumObstacleSpacing: 1.4,
  placementAttemptsPerObstacle: 14,
  gridCellSize: 1,
  minimumCombatAreaCells: 54,
  playerRadius: 0.42,
  triggerInset: 4,
  minimumObstacleHeight: 0.28,
};

describe("RoomGenerator", () => {
  it("produces exactly the same layout for the same seed", () => {
    const generator = new RoomGenerator(options);
    const first = generator.generate("test-seed");
    const second = generator.generate("test-seed");

    expect(first).toEqual(second);
    expect(first.occupancy.blocked).toHaveLength(first.occupancy.columns * first.occupancy.rows);
    expect(first.enemySpawnPoints).toHaveLength(4);
  });

  it("stores a traversable, unblocked route between the entrance and exit", () => {
    const generator = new RoomGenerator(options);
    const layout = generator.generate("path-seed");

    expect(generator.hasPath(layout.obstacles, layout.structuralBlocks)).toBe(true);
    expect(layout.path.length).toBeGreaterThan(0);
    for (const cell of layout.path) {
      expect(layout.occupancy.blocked[cell.row * layout.occupancy.columns + cell.column]).toBe(
        false,
      );
    }
    expect(layout.combatAreaCells).toBeGreaterThanOrEqual(options.minimumCombatAreaCells);
  });

  it("keeps doors, triggers, player start, and enemy spawn zones clear", () => {
    const generator = new RoomGenerator(options);

    for (const seed of ["protected-a", "protected-b", "protected-c"]) {
      const layout = generator.generate(seed);
      expect(generator.protectedZonesAreClear(layout)).toBe(true);
      expect(new Set(layout.protectedZones.map((zone) => zone.kind))).toEqual(
        new Set(["entrance", "exit", "player_start", "trigger", "enemy_spawn"]),
      );
      expect(
        layout.obstacles.every((obstacle) => obstacle.size.y > options.minimumObstacleHeight),
      ).toBe(true);
      for (const obstacle of layout.obstacles) {
        const bounds = obstacleBounds(obstacle);
        expect(Math.abs(obstacle.position.x) + bounds.halfWidth).toBeLessThan(layout.width / 2);
        expect(Math.abs(obstacle.position.z) + bounds.halfLength).toBeLessThan(layout.length / 2);
        for (const block of layout.structuralBlocks) {
          expect(
            rectanglesOverlap(bounds, {
              x: block.position.x,
              z: block.position.z,
              halfWidth: block.size.x / 2,
              halfLength: block.size.z / 2,
            }),
          ).toBe(false);
        }
      }
      for (let left = 0; left < layout.obstacles.length; left += 1) {
        for (let right = left + 1; right < layout.obstacles.length; right += 1) {
          const first = obstacleBounds(layout.obstacles[left]!);
          const second = obstacleBounds(layout.obstacles[right]!);
          const horizontalGap = Math.abs(first.x - second.x) - first.halfWidth - second.halfWidth;
          const verticalGap = Math.abs(first.z - second.z) - first.halfLength - second.halfLength;
          expect(Math.max(horizontalGap, verticalGap)).toBeGreaterThanOrEqual(
            options.minimumObstacleSpacing - Number.EPSILON,
          );
        }
      }
    }
  });

  it("selects room shapes deterministically from the template set", () => {
    const generator = new RoomGenerator(options);
    const templates = new Set(
      Array.from({ length: 24 }, (_, index) => generator.generate(`template-${index}`).template),
    );

    expect(templates.size).toBeGreaterThan(1);
    expect(
      [...templates].every((template) =>
        ["open_arena", "central_gate", "offset_bays"].includes(template),
      ),
    ).toBe(true);
  });

  it("uses a safe fallback when the attempt limit is exhausted", () => {
    const generator = new RoomGenerator({ ...options, maximumAttempts: 0 });
    const layout = generator.generate("fallback-seed");

    expect(layout.usedFallback).toBe(true);
    expect(layout.generationAttempts).toBe(0);
    expect(generator.hasPath(layout.obstacles, layout.structuralBlocks)).toBe(true);
  });

  it("terminates after the configured number of failed attempts", () => {
    const generator = new RoomGenerator({
      ...options,
      obstacleCount: 100,
      maximumAttempts: 3,
      placementAttemptsPerObstacle: 1,
    });
    const layout = generator.generate("bounded-attempts");

    expect(layout.usedFallback).toBe(true);
    expect(layout.generationAttempts).toBe(3);
  });
});

interface Bounds {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfLength: number;
}

function obstacleBounds(obstacle: GeneratedObstacle): Bounds {
  const rotated = Math.abs(Math.sin(obstacle.rotationY)) > 0.5;
  return {
    x: obstacle.position.x,
    z: obstacle.position.z,
    halfWidth: (rotated ? obstacle.size.z : obstacle.size.x) / 2,
    halfLength: (rotated ? obstacle.size.x : obstacle.size.z) / 2,
  };
}

function rectanglesOverlap(left: Bounds, right: Bounds): boolean {
  return (
    Math.abs(left.x - right.x) < left.halfWidth + right.halfWidth &&
    Math.abs(left.z - right.z) < left.halfLength + right.halfLength
  );
}
