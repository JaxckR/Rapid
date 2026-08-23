import { distanceSquared3, type Vec3 } from "../core/math";

export type EnemyArchetype = "flying" | "toxic" | "jumper" | "shooter";
export type EnemyAttackPhase = "idle" | "telegraph" | "attack" | "recover";

export interface EnemySnapshot {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  readonly position: Vec3;
  readonly health: number;
  readonly attackPhase: EnemyAttackPhase;
}

interface MutableEnemy {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  position: Vec3;
  health: number;
  attackClock: number;
  attackPhase: EnemyAttackPhase;
}

export interface ShotResult {
  readonly hitEnemyId?: string;
  readonly defeatedEnemyId?: string;
}

export class EnemySystem {
  private readonly enemies: MutableEnemy[] = [];

  public spawnDefaultWave(spawnPoints: readonly Vec3[]): void {
    if (this.enemies.length > 0) return;
    const archetypes: readonly EnemyArchetype[] = ["flying", "toxic", "jumper", "shooter"];
    for (const [index, archetype] of archetypes.entries()) {
      const spawnPoint = spawnPoints[index];
      if (spawnPoint === undefined)
        throw new Error("The default wave requires four safe spawn points.");
      this.enemies.push({
        id: `${archetype}-${index}`,
        archetype,
        position: {
          x: spawnPoint.x,
          y: archetype === "flying" ? 1.4 : 0,
          z: spawnPoint.z,
        },
        health: 100,
        attackClock: index * 0.3,
        attackPhase: "idle",
      });
    }
  }

  public update(playerPosition: Vec3, deltaSeconds: number): void {
    for (const enemy of this.enemies) {
      const distance = Math.sqrt(distanceSquared3(enemy.position, playerPosition));
      const desiredDistance =
        enemy.archetype === "shooter" ? 8 : enemy.archetype === "flying" ? 7 : 3;
      if (distance > desiredDistance && distance > Number.EPSILON) {
        const speed = enemy.archetype === "jumper" ? 0.6 : 1.1;
        enemy.position = {
          x:
            enemy.position.x +
            ((playerPosition.x - enemy.position.x) / distance) * speed * deltaSeconds,
          y: enemy.position.y,
          z:
            enemy.position.z +
            ((playerPosition.z - enemy.position.z) / distance) * speed * deltaSeconds,
        };
      }

      enemy.attackClock = (enemy.attackClock + deltaSeconds) % 4;
      enemy.attackPhase = this.phaseForClock(enemy.attackClock);
    }
  }

  public applyShot(
    origin: Vec3,
    yaw: number,
    range: number,
    damage: number,
    isOccluded: (from: Vec3, to: Vec3) => boolean,
  ): ShotResult {
    let target: MutableEnemy | undefined;
    let targetDistance = range;
    for (const enemy of this.enemies) {
      const dx = enemy.position.x - origin.x;
      const dz = enemy.position.z - origin.z;
      const distance = Math.hypot(dx, dz);
      const angle = Math.abs(
        Math.atan2(Math.sin(Math.atan2(dx, dz) - yaw), Math.cos(Math.atan2(dx, dz) - yaw)),
      );
      if (distance < targetDistance && angle < 0.16 && !isOccluded(origin, enemy.position)) {
        target = enemy;
        targetDistance = distance;
      }
    }
    if (target === undefined) return {};
    target.health -= damage;
    const result: ShotResult = { hitEnemyId: target.id };
    if (target.health > 0) return result;
    this.enemies.splice(this.enemies.indexOf(target), 1);
    return { ...result, defeatedEnemyId: target.id };
  }

  public snapshots(): readonly EnemySnapshot[] {
    return this.enemies.map((enemy) => ({ ...enemy, position: { ...enemy.position } }));
  }

  public get remainingRequiredEnemies(): number {
    return this.enemies.length;
  }

  public dispose(): void {
    this.enemies.length = 0;
  }

  private phaseForClock(clock: number): EnemyAttackPhase {
    if (clock < 1.8) return "idle";
    if (clock < 2.7) return "telegraph";
    if (clock < 2.9) return "attack";
    return "recover";
  }
}
