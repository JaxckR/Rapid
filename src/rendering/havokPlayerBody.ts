import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import {
  CharacterSupportedState,
  PhysicsCharacterController,
} from "@babylonjs/core/Physics/v2/characterController.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { GameConfig } from "../core/config";
import type { Vec3 } from "../core/math";
import type { PlayerPhysicsState } from "../player/playerController";

export class HavokPlayerBody {
  private readonly controller: PhysicsCharacterController;
  private readonly gravity: Vector3;
  private readonly down = new Vector3(0, -1, 0);
  private readonly requestedVelocity = Vector3.Zero();

  public constructor(
    scene: Scene,
    private readonly config: GameConfig["player"],
    initialFootPosition: Vec3,
  ) {
    this.controller = new PhysicsCharacterController(
      new Vector3(
        initialFootPosition.x,
        initialFootPosition.y + config.colliderHeight / 2,
        initialFootPosition.z,
      ),
      {
        capsuleHeight: config.colliderHeight,
        capsuleRadius: config.colliderRadius,
      },
      scene,
    );
    this.controller.maxStepHeight = config.stepHeight;
    this.controller.maxSlopeCosine = Math.cos((Math.PI * config.maximumSlopeDegrees) / 180);
    this.controller.maxCharacterSpeedForSolver = config.maximumSpeed * 1.5;
    this.controller.maxCastIterations = 16;
    this.controller.keepDistance = 0.025;
    this.controller.keepContactTolerance = 0.06;
    this.controller.penetrationRecoverySpeed = 2;
    this.controller.staticFriction = 0;
    this.controller.dynamicFriction = 0;
    this.controller.characterMass = 80;
    this.gravity = new Vector3(0, -config.gravity, 0);
  }

  public step(horizontalVelocity: Vec3, deltaSeconds: number): PlayerPhysicsState {
    const support = this.controller.checkSupport(deltaSeconds, this.down);
    const grounded = support.supportedState === CharacterSupportedState.SUPPORTED;
    const currentVelocity = this.controller.getVelocity();
    this.requestedVelocity.set(
      horizontalVelocity.x,
      grounded ? 0 : Math.min(0, currentVelocity.y),
      horizontalVelocity.z,
    );
    this.controller.setVelocity(this.requestedVelocity);
    this.controller.integrate(deltaSeconds, support, this.gravity);

    const center = this.controller.getPosition();
    const velocity = this.controller.getVelocity();
    return {
      position: {
        x: center.x,
        y: center.y - this.config.colliderHeight / 2,
        z: center.z,
      },
      velocity: { x: velocity.x, y: velocity.y, z: velocity.z },
      grounded,
    };
  }

  public centerPosition(): Vec3 {
    const center = this.controller.getPosition();
    return { x: center.x, y: center.y, z: center.z };
  }

  public dispose(): void {
    this.controller.dispose();
  }
}
