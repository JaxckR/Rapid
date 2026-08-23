import { AssetResolver } from "../assets/assetResolver";
import { WeaponSystem } from "../combat/weaponSystem";
import { EnemySystem } from "../enemies/enemySystem";
import { RoomGenerator, type RoomLayout } from "../generation/roomGenerator";
import { DesktopInput } from "../input/desktopInput";
import { InputSystem } from "../input/inputSystem";
import { TouchInput } from "../input/touchInput";
import { SaveRepository } from "../persistence/saveRepository";
import { PlayerController } from "../player/playerController";
import { ProgressionSystem } from "../progression/progressionSystem";
import type { SceneRenderer } from "../rendering/sceneRenderer";
import { RoomStateMachine } from "../rooms/roomStateMachine";
import { HudController } from "../ui/hudController";
import { GAME_CONFIG, type GameConfig } from "./config";
import { EventBus } from "./eventBus";
import type { GameEvents } from "./events";
import { FixedStepGameLoop } from "./gameLoop";
import type { Vec3 } from "./math";

export class GameApp {
  private readonly events = new EventBus<GameEvents>();
  private readonly input: InputSystem;
  private readonly player: PlayerController;
  private readonly weapon: WeaponSystem;
  private readonly enemies = new EnemySystem();
  private readonly room = new RoomStateMachine();
  private readonly progression: ProgressionSystem;
  private readonly saves = new SaveRepository(window.localStorage);
  private readonly hud = new HudController();
  private readonly loop: FixedStepGameLoop;
  private readonly layout: RoomLayout;
  private renderer: SceneRenderer | undefined;
  private paused = false;
  private completedCurrentRoom = false;
  private readonly seed: string;

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly config: GameConfig = GAME_CONFIG,
  ) {
    const save = this.saves.load();
    this.seed = save?.seed ?? "rapid-foundation-001";
    document.body.classList.toggle("left-handed", save?.leftHandedControls ?? false);
    this.progression = new ProgressionSystem(config.room.ordinaryRoomsPerLevel, save?.progression);
    this.input = new InputSystem([new DesktopInput(canvas), new TouchInput(canvas)]);
    this.player = new PlayerController(
      config.player.maximumHealth,
      config.player.movementSpeed,
      config.player.lookSensitivity,
    );
    this.weapon = new WeaponSystem(config.weapon);
    this.layout = new RoomGenerator({
      width: config.room.width,
      length: config.room.length,
      obstacleCount: config.generation.obstacleCount,
      maximumAttempts: config.generation.maximumAttempts,
      minimumObstacleSpacing: config.generation.minimumObstacleSpacing,
    }).generate(this.seed);
    this.room.transition("Waiting");
    this.loop = new FixedStepGameLoop(
      config.simulation.fixedStepSeconds,
      config.simulation.maximumFrameSeconds,
      config.simulation.maximumSubSteps,
      {
        update: (deltaSeconds) => this.update(deltaSeconds),
        render: () => this.render(),
      },
    );
  }

  public async start(): Promise<void> {
    const { SceneRenderer } = await import("../rendering/sceneRenderer");
    this.renderer = await SceneRenderer.create(
      this.canvas,
      new AssetResolver(),
      this.config,
      this.layout,
    );
    window.addEventListener("resize", this.onResize);
    this.loop.start();
  }

  public dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.events.clear();
    this.enemies.dispose();
    this.renderer?.dispose();
    window.removeEventListener("resize", this.onResize);
  }

  private update(deltaSeconds: number): void {
    const actions = this.input.sample();
    if (actions.pause) {
      this.paused = !this.paused;
      this.hud.setPaused(this.paused);
      this.events.emit("game:pause-changed", { paused: this.paused });
    }
    if (this.paused) return;

    this.player.update(actions, deltaSeconds, (position) => this.isWalkable(position));
    this.weapon.update(deltaSeconds);
    const player = this.player.snapshot();

    if (this.room.state === "Waiting" && player.position.z > -8) {
      if (this.room.handlePlayerEntry()) {
        this.events.emit("room:changed", { state: this.room.state });
        if (this.room.beginCombat()) {
          this.enemies.spawnDefaultWave(this.layout.enemySpawnPoints);
          this.events.emit("room:changed", { state: this.room.state });
        }
      }
    }

    if (this.room.state === "Combat") {
      this.enemies.update(player.position, deltaSeconds);
      const shot = this.weapon.tryFire(actions.fire);
      if (shot !== undefined) {
        this.events.emit("combat:fired", { damage: shot.damage });
        const result = this.enemies.applyShot(
          player.position,
          player.yaw,
          shot.range,
          shot.damage,
          (from, to) => this.renderer?.isOccluded(from, to) ?? false,
        );
        if (result.defeatedEnemyId !== undefined) {
          this.events.emit("enemy:defeated", { enemyId: result.defeatedEnemyId });
        }
      }
      if (this.enemies.remainingRequiredEnemies === 0) this.completeRoom();
    }
  }

  private completeRoom(): void {
    if (this.completedCurrentRoom || !this.room.clearAndOpen()) return;
    this.completedCurrentRoom = true;
    this.events.emit("room:changed", { state: this.room.state });
    this.progression.completeRoom(`${this.seed}:room-0`, false);
    this.saves.save({
      version: 1,
      seed: this.seed,
      progression: this.progression.snapshot(),
      leftHandedControls: document.body.classList.contains("left-handed"),
    });
  }

  private render(): void {
    const player = this.player.snapshot();
    this.hud.update(
      player,
      this.room.state,
      this.enemies.remainingRequiredEnemies,
      this.progression.snapshot(),
    );
    this.renderer?.render(player, this.enemies.snapshots(), this.room.state);
  }

  private isWalkable(position: Vec3): boolean {
    const radius = 0.42;
    if (
      Math.abs(position.x) > this.layout.width / 2 - radius - 0.25 ||
      position.z < -this.layout.length / 2 + radius ||
      position.z > this.layout.length / 2 - radius
    ) {
      return false;
    }
    return this.layout.obstacles.every(
      (obstacle) =>
        Math.abs(position.x - obstacle.position.x) > obstacle.size.x / 2 + radius ||
        Math.abs(position.z - obstacle.position.z) > obstacle.size.z / 2 + radius,
    );
  }

  private readonly onResize = (): void => this.renderer?.resize();
}
