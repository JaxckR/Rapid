import { clamp, type Vec3 } from "../core/math";
import type { InputActions } from "../input/actions";

export interface PlayerSnapshot {
  readonly position: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly health: number;
  readonly maximumHealth: number;
}

export class PlayerController {
  private position: Vec3 = { x: 0, y: 0, z: -11 };
  private yaw = 0;
  private pitch = 0;
  private health: number;

  public constructor(
    private maximumHealth: number,
    private movementSpeed: number,
    private readonly lookSensitivity: number,
  ) {
    this.health = maximumHealth;
  }

  public update(
    actions: InputActions,
    deltaSeconds: number,
    isWalkable: (position: Vec3) => boolean = () => true,
  ): void {
    this.yaw += actions.look.x * this.lookSensitivity;
    this.pitch = clamp(this.pitch + actions.look.y * this.lookSensitivity, -1.25, 1.25);

    const forwardX = Math.sin(this.yaw);
    const forwardZ = Math.cos(this.yaw);
    const rightX = Math.cos(this.yaw);
    const rightZ = -Math.sin(this.yaw);
    const distance = this.movementSpeed * deltaSeconds;
    const proposed = {
      x: clamp(
        this.position.x + (rightX * actions.move.x + forwardX * actions.move.y) * distance,
        -7.8,
        7.8,
      ),
      y: 0,
      z: clamp(
        this.position.z + (rightZ * actions.move.x + forwardZ * actions.move.y) * distance,
        -12.5,
        12.5,
      ),
    };
    if (isWalkable(proposed)) {
      this.position = proposed;
      return;
    }
    const slideX = { ...this.position, x: proposed.x };
    const slideZ = { ...this.position, z: proposed.z };
    if (isWalkable(slideX)) this.position = slideX;
    else if (isWalkable(slideZ)) this.position = slideZ;
  }

  public applyDamage(amount: number): void {
    this.health = clamp(this.health - Math.max(0, amount), 0, this.maximumHealth);
  }

  public increaseMaximumHealth(amount: number): void {
    this.maximumHealth += Math.max(0, amount);
    this.health = this.maximumHealth;
  }

  public setMovementSpeed(speed: number): void {
    this.movementSpeed = Math.max(0, speed);
  }

  public snapshot(): PlayerSnapshot {
    return {
      position: { ...this.position },
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      maximumHealth: this.maximumHealth,
    };
  }
}
