import { AssetResolver } from "../assets/assetResolver";
import { WeaponSystem } from "../combat/weaponSystem";
import { EnemySystem } from "../enemies/enemySystem";
import { createPhysicsTestRoom } from "../generation/physicsTestRoom";
import { RoomGenerator, type RoomLayout } from "../generation/roomGenerator";
import type { InputSettings } from "../input/actions";
import { InputSystem } from "../input/inputSystem";
import { SaveRepository } from "../persistence/saveRepository";
import { PlayerController } from "../player/playerController";
import { ProgressionSystem } from "../progression/progressionSystem";
import type { SceneRenderer } from "../rendering/sceneRenderer";
import { RoomStateMachine } from "../rooms/roomStateMachine";
import { HudController } from "../ui/hudController";
import { InputSettingsPanel } from "../ui/inputSettingsPanel";
import { GAME_CONFIG, type GameConfig } from "./config";
import { EventBus } from "./eventBus";
import type { GameEvents } from "./events";
import { FixedStepGameLoop } from "./gameLoop";

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
  private readonly inputSettingsPanel: InputSettingsPanel;
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
    this.progression = new ProgressionSystem(config.room.ordinaryRoomsPerLevel, save?.progression);
    const inputSettings: InputSettings = {
      mouseSensitivity:
        save?.inputSettings?.mouseSensitivity ?? config.input.defaultMouseSensitivity,
      touchSensitivity:
        save?.inputSettings?.touchSensitivity ?? config.input.defaultTouchSensitivity,
      leftHanded: save?.inputSettings?.leftHanded ?? save?.leftHandedControls ?? false,
      aimAssist: save?.inputSettings?.aimAssist ?? false,
    };
    this.input = new InputSystem(canvas, {
      settings: inputSettings,
      joystickRadiusPixels: config.input.joystickRadiusPixels,
      maximumLookDeltaPixels: config.input.maximumLookDeltaPixels,
      touchLookSmoothing: config.player.touchLookSmoothing,
      aimAssist: {
        maximumAngle: config.player.aimAssistMaximumAngle,
        turnRate: config.player.aimAssistTurnRate,
        lookSensitivity: config.player.lookSensitivity,
      },
    });
    this.inputSettingsPanel = new InputSettingsPanel(
      this.input.settings,
      (settings) => {
        this.input.updateSettings(settings);
        this.persist();
      },
      () => this.input.requestPauseToggle(),
    );
    this.player = new PlayerController(config.player.maximumHealth, config.player);
    this.weapon = new WeaponSystem(config.weapon);
    this.layout = this.usePhysicsTestRoom()
      ? createPhysicsTestRoom(config.room.width, config.room.length)
      : new RoomGenerator({
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
        render: (interpolation) => this.render(interpolation),
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
    this.inputSettingsPanel.dispose();
    this.events.clear();
    this.enemies.dispose();
    this.renderer?.dispose();
    window.removeEventListener("resize", this.onResize);
  }

  private update(deltaSeconds: number): void {
    const beforeInput = this.player.snapshot();
    const aimTargets = this.enemies
      .snapshots()
      .filter(
        (enemy) => !(this.renderer?.isOccluded(beforeInput.position, enemy.position) ?? false),
      )
      .map((enemy) => ({ ...enemy.position, y: enemy.position.y + 0.9 }));
    const actions = this.input.sample({
      deltaSeconds,
      origin: {
        ...beforeInput.position,
        y: beforeInput.position.y + this.config.player.eyeHeight,
      },
      yaw: beforeInput.yaw,
      pitch: beforeInput.pitch,
      targets: aimTargets,
    });
    if (actions.pause === "force") this.setPaused(true);
    else if (actions.pause === "toggle") this.setPaused(!this.paused);
    if (this.paused) return;

    this.player.update(actions, deltaSeconds);
    const physicsState = this.renderer?.stepPlayer(this.player.desiredVelocity(), deltaSeconds);
    if (physicsState !== undefined) this.player.applyPhysicsState(physicsState);
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
    this.persist();
  }

  private persist(): void {
    const inputSettings = this.input.settings;
    this.saves.save({
      version: 1,
      seed: this.seed,
      progression: this.progression.snapshot(),
      leftHandedControls: inputSettings.leftHanded,
      inputSettings,
    });
  }

  private setPaused(paused: boolean): void {
    if (paused === this.paused) return;
    this.paused = paused;
    this.hud.setPaused(paused);
    this.events.emit("game:pause-changed", { paused });
  }

  private render(interpolation: number): void {
    const player = this.player.renderSnapshot(interpolation);
    this.hud.update(
      player,
      this.room.state,
      this.enemies.remainingRequiredEnemies,
      this.progression.snapshot(),
    );
    this.renderer?.render(player, this.enemies.snapshots(), this.room.state);
  }

  private usePhysicsTestRoom(): boolean {
    return (
      this.config.debug.usePhysicsTestRoom ||
      new URLSearchParams(window.location.search).get("physicsTestRoom") === "1"
    );
  }

  private readonly onResize = (): void => this.renderer?.resize();
}
