import { distanceSquared3, type Vec3 } from "../core/math";

export type EnemyArchetype = "flying" | "toxic" | "jumper" | "shooter";
export type EnemyAttackPhase = "idle" | "telegraph" | "attack" | "recover";
export type EnemyAnimationState = "idle" | "move" | "attack" | "hurt" | "death";

export interface EnemySnapshot {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  readonly position: Vec3;
  readonly health: number;
  readonly attackPhase: EnemyAttackPhase;
  readonly animationState: EnemyAnimationState;
  readonly facingYaw: number;
}

interface MutableEnemy {
  readonly id: string;
  readonly archetype: EnemyArchetype;
  position: Vec3;
  health: number;
  attackClock: number;
  attackPhase: EnemyAttackPhase;
  facingYaw: number;
  moving: boolean;
  hurtClock: number;
  deathClock: number;
  alive: boolean;
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
        facingYaw: 0,
        moving: false,
        hurtClock: 0,
        deathClock: 0,
        alive: true,
      });
    }
  }

  public update(playerPosition: Vec3, deltaSeconds: number): void {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      if (enemy === undefined) continue;
      if (!enemy.alive) {
        enemy.deathClock += deltaSeconds;
        if (enemy.deathClock >= 0.8) this.enemies.splice(index, 1);
        continue;
      }
      enemy.hurtClock = Math.max(0, enemy.hurtClock - deltaSeconds);
      const distance = Math.sqrt(distanceSquared3(enemy.position, playerPosition));
      const desiredDistance =
        enemy.archetype === "shooter" ? 8 : enemy.archetype === "flying" ? 7 : 3;
      enemy.facingYaw = Math.atan2(
        playerPosition.x - enemy.position.x,
        playerPosition.z - enemy.position.z,
      );
      enemy.moving = distance > desiredDistance && distance > Number.EPSILON;
      if (enemy.moving) {
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
      if (!enemy.alive) continue;
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
    target.health = Math.max(0, target.health - damage);
    target.hurtClock = 0.18;
    const result: ShotResult = { hitEnemyId: target.id };
    if (target.health > 0) return result;
    target.alive = false;
    target.deathClock = 0;
    target.moving = false;
    return { ...result, defeatedEnemyId: target.id };
  }

  public snapshots(): readonly EnemySnapshot[] {
    return this.enemies.map((enemy) => ({
      id: enemy.id,
      archetype: enemy.archetype,
      position: { ...enemy.position },
      health: enemy.health,
      attackPhase: enemy.attackPhase,
      facingYaw: enemy.facingYaw,
      animationState: this.animationState(enemy),
    }));
  }

  public get remainingRequiredEnemies(): number {
    return this.enemies.filter((enemy) => enemy.alive).length;
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

  private animationState(enemy: MutableEnemy): EnemyAnimationState {
    if (!enemy.alive) return "death";
    if (enemy.hurtClock > 0) return "hurt";
    if (enemy.attackPhase === "telegraph" || enemy.attackPhase === "attack") return "attack";
    return enemy.moving ? "move" : "idle";
  }
}
