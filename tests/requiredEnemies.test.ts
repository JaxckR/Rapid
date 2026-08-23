import { describe, expect, it } from "vitest";
import { EnemySystem } from "../src/enemies/enemySystem";

describe("required room enemies", () => {
  it("ignores optional objects when deciding whether combat is complete", () => {
    const enemies = new EnemySystem();
    enemies.spawnEnemy("room-7", "shooter", { x: 0, y: 0, z: 5 }, true);
    enemies.spawnEnemy("room-7", "toxic", { x: 8, y: 0, z: 5 }, false);
    expect(enemies.remainingRequiredEnemiesForRoom("room-7")).toBe(1);

    enemies.applyShot({ x: 0, y: 0, z: 0 }, 0, 30, 100, () => false, "room-7");

    expect(enemies.remainingRequiredEnemiesForRoom("room-7")).toBe(0);
    expect(enemies.snapshots().some((enemy) => !enemy.required && enemy.health > 0)).toBe(true);
  });
});
