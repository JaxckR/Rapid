import type { GameConfig } from "../core/config";
import { clamp, type Vec3 } from "../core/math";
import type { InputActionState } from "../input/actions";
import { updateHorizontalVelocity } from "./playerMovement";

export interface PlayerSnapshot {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly yaw: number;
  readonly pitch: number;
  readonly health: number;
  readonly maximumHealth: number;
}

export interface PlayerPhysicsState {
  readonly position: Vec3;
  readonly velocity: Vec3;
  readonly grounded: boolean;
}

export class PlayerController {
  private position: Vec3 = { x: 0, y: 0, z: -11 };
  private previousPosition: Vec3 = this.position;
  private velocity: Vec3 = { x: 0, y: 0, z: 0 };
  private yaw = 0;
  private pitch = 0;
  private health: number;
  private maximumSpeed: number;

  public constructor(
    private maximumHealth: number,
    private readonly config: GameConfig["player"],
  ) {
    this.health = maximumHealth;
    this.maximumSpeed = config.maximumSpeed;
  }

  public update(actions: InputActionState, deltaSeconds: number): void {
    this.yaw += actions.look.x * this.config.lookSensitivity;
    this.pitch = clamp(
      this.pitch + actions.look.y * this.config.lookSensitivity,
      this.config.minimumPitch,
      this.config.maximumPitch,
    );
    const horizontal = updateHorizontalVelocity(
      { x: this.velocity.x, y: this.velocity.z },
      actions.move,
      this.yaw,
      deltaSeconds,
      {
        maximumSpeed: this.maximumSpeed,
        acceleration: this.config.acceleration,
        deceleration: this.config.deceleration,
      },
    );
    this.velocity = { ...this.velocity, x: horizontal.x, z: horizontal.y };
  }

  public applyPhysicsState(state: PlayerPhysicsState): void {
    this.previousPosition = this.position;
    this.position = { ...state.position };
    this.velocity = { ...state.velocity };
  }

  public desiredVelocity(): Vec3 {
    return { ...this.velocity };
  }

  public applyDamage(amount: number): void {
    this.health = clamp(this.health - Math.max(0, amount), 0, this.maximumHealth);
  }

  public increaseMaximumHealth(amount: number): void {
    this.maximumHealth += Math.max(0, amount);
    this.health = this.maximumHealth;
  }

  public setMovementSpeed(speed: number): void {
    this.maximumSpeed = Math.max(0, speed);
  }

  public snapshot(): PlayerSnapshot {
    return this.createSnapshot(this.position);
  }

  public renderSnapshot(interpolation: number): PlayerSnapshot {
    const alpha = clamp(interpolation, 0, 1);
    return this.createSnapshot({
      x: this.previousPosition.x + (this.position.x - this.previousPosition.x) * alpha,
      y: this.previousPosition.y + (this.position.y - this.previousPosition.y) * alpha,
      z: this.previousPosition.z + (this.position.z - this.previousPosition.z) * alpha,
    });
  }

  private createSnapshot(position: Vec3): PlayerSnapshot {
    return {
      position: { ...position },
      velocity: { ...this.velocity },
      yaw: this.yaw,
      pitch: this.pitch,
      health: this.health,
      maximumHealth: this.maximumHealth,
    };
  }
}
