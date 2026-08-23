import { describe, expect, it } from "vitest";
import { EnemySystem } from "../src/enemies/enemySystem";

const SPAWNS = [
  { x: -3, y: 0, z: 3 },
  { x: -1, y: 0, z: 3 },
  { x: 1, y: 0, z: 3 },
  { x: 3, y: 0, z: 3 },
] as const;

describe("enemy visual state snapshots", () => {
  it("exposes movement and facing without depending on a renderer", () => {
    const enemies = new EnemySystem();
    enemies.spawnDefaultWave(SPAWNS);
    enemies.update({ x: 0, y: 0, z: -10 }, 1 / 60);
    const snapshot = enemies.snapshots()[0];
    expect(snapshot?.animationState).toBe("move");
    expect(Number.isFinite(snapshot?.facingYaw)).toBe(true);
  });

  it("keeps a defeated enemy snapshot briefly for its death animation", () => {
    const enemies = new EnemySystem();
    enemies.spawnDefaultWave(SPAWNS);
    const target = enemies.snapshots()[0];
    if (target === undefined) throw new Error("Expected an enemy");
    const yaw = Math.atan2(target.position.x, target.position.z);
    enemies.applyShot({ x: 0, y: 0, z: 0 }, yaw, 30, 100, () => false);
    expect(enemies.remainingRequiredEnemies).toBe(3);
    expect(enemies.snapshots().find((enemy) => enemy.id === target.id)?.animationState).toBe(
      "death",
    );
    enemies.update({ x: 0, y: 0, z: 0 }, 0.81);
    expect(enemies.snapshots().some((enemy) => enemy.id === target.id)).toBe(false);
  });
});
