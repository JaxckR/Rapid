import { AssetResolver } from "../assets/assetResolver";
import { WeaponSystem } from "../combat/weaponSystem";
import { EnemySystem } from "../enemies/enemySystem";
import { createPhysicsTestRoom } from "../generation/physicsTestRoom";
import type { InputSettings } from "../input/actions";
import { InputSystem } from "../input/inputSystem";
import { SaveRepository } from "../persistence/saveRepository";
import { PlayerController } from "../player/playerController";
import { ProgressionSystem } from "../progression/progressionSystem";
import type { SceneRenderer } from "../rendering/sceneRenderer";
import type { GraphicsQuality } from "../rendering/quality";
import { recommendedQuality } from "../rendering/quality";
import { RoomController, type RoomStateChange } from "../rooms/roomController";
import { HudController } from "../ui/hudController";
import { InputSettingsPanel } from "../ui/inputSettingsPanel";
import { GraphicsSettingsPanel } from "../ui/graphicsSettingsPanel";
import { WeaponHud } from "../ui/weaponHud";
import { RoomDebugIndicator } from "../ui/roomDebugIndicator";
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
  private readonly rooms: RoomController;
  private readonly progression: ProgressionSystem;
  private readonly saves = new SaveRepository(window.localStorage);
  private readonly assets = new AssetResolver();
  private readonly hud = new HudController();
  private readonly inputSettingsPanel: InputSettingsPanel;
  private readonly graphicsSettingsPanel: GraphicsSettingsPanel;
  private readonly weaponHud: WeaponHud;
  private readonly roomDebug: RoomDebugIndicator;
  private readonly loop: FixedStepGameLoop;
  private renderer: SceneRenderer | undefined;
  private paused = false;
  private readonly seed: string;
  private graphicsQuality: GraphicsQuality;

  public constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly config: GameConfig = GAME_CONFIG,
  ) {
    const save = this.saves.load();
    this.seed = save?.seed ?? "rapid-foundation-001";
    this.rooms = new RoomController(
      {
        baseSeed: this.seed,
        generator: {
          width: config.room.width,
          length: config.room.length,
          obstacleCount: config.generation.obstacleCount,
          maximumAttempts: config.generation.maximumAttempts,
          minimumObstacleSpacing: config.generation.minimumObstacleSpacing,
        },
        triggerInset: config.room.triggerInset,
        doorwayWidth: config.room.doorwayWidth,
        doorDepth: config.room.doorDepth,
        doorSafetyMargin: config.room.doorSafetyMargin,
        retainedPreviousRooms: config.room.retainedPreviousRooms,
        layoutFactory: this.usePhysicsTestRoom()
          ? (seed) => ({ ...createPhysicsTestRoom(config.room.width, config.room.length), seed })
          : undefined,
      },
      save?.roomSequence,
    );
    const navigatorWithMemory = navigator as Navigator & { readonly deviceMemory?: number };
    this.graphicsQuality =
      save?.graphicsQuality ??
      (navigator.hardwareConcurrency > 0
        ? recommendedQuality(navigator.hardwareConcurrency, navigatorWithMemory.deviceMemory ?? 8)
        : config.rendering.defaultQuality);
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
    this.graphicsSettingsPanel = new GraphicsSettingsPanel(this.graphicsQuality, (quality) => {
      this.graphicsQuality = quality;
      this.renderer?.setQuality(quality);
      this.persist();
    });
    this.weaponHud = new WeaponHud(this.assets);
    this.roomDebug = new RoomDebugIndicator(this.roomDebugEnabled());
    this.player = new PlayerController(
      config.player.maximumHealth,
      config.player,
      this.rooms.playerSpawnPosition,
    );
    this.weapon = new WeaponSystem(config.weapon);
    for (const room of this.rooms.loadedRooms) {
      if (room.state === "Combat") this.spawnRoomWave(room.id);
    }
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
      this.assets,
      this.config,
      this.rooms.loadedRooms,
      this.graphicsQuality,
      this.rooms.playerSpawnPosition,
    );
    await this.weaponHud.initialize();
    window.addEventListener("resize", this.onResize);
    this.loop.start();
  }

  public dispose(): void {
    this.loop.stop();
    this.input.dispose();
    this.inputSettingsPanel.dispose();
    this.graphicsSettingsPanel.dispose();
    this.weaponHud.dispose();
    this.events.clear();
    this.enemies.dispose();
    this.renderer?.dispose();
    window.removeEventListener("resize", this.onResize);
  }

  private update(deltaSeconds: number): void {
    const beforeInput = this.player.snapshot();
    const currentBeforeInput = this.rooms.currentRoom;
    const aimTargets = this.enemies
      .snapshots()
      .filter(
        (enemy) =>
          enemy.roomId === currentBeforeInput.id &&
          enemy.health > 0 &&
          !(this.renderer?.isOccluded(beforeInput.position, enemy.position) ?? false),
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
    const roomChanges = this.rooms.updatePlayer(
      beforeInput.position,
      player.position,
      this.config.player.colliderRadius,
    );
    this.handleRoomChanges(roomChanges);
    this.renderer?.updateRooms(this.rooms.loadedRooms);
    for (const roomId of this.rooms.drainUnloadedRoomIds()) this.enemies.disposeRoom(roomId);

    let currentRoom = this.rooms.currentRoom;
    if (currentRoom.state === "Locked") {
      this.spawnRoomWave(currentRoom.id);
      const change = this.rooms.beginCombat(currentRoom.id);
      if (change !== undefined) this.handleRoomChanges([change]);
      currentRoom = this.rooms.currentRoom;
    }

    this.enemies.update(
      player.position,
      deltaSeconds,
      currentRoom.state === "Combat" ? currentRoom.id : null,
    );
    if (currentRoom.state === "Combat") {
      const shot = this.weapon.tryFire(actions.fire);
      if (shot !== undefined) {
        this.weaponHud.playFire();
        this.renderer?.playWeaponFire();
        this.events.emit("combat:fired", { damage: shot.damage });
        const result = this.enemies.applyShot(
          player.position,
          player.yaw,
          shot.range,
          shot.damage,
          (from, to) => this.renderer?.isOccluded(from, to) ?? false,
          currentRoom.id,
        );
        if (result.hitEnemyId !== undefined) this.renderer?.playHitEffect(result.hitEnemyId);
        if (result.defeatedEnemyId !== undefined) {
          this.events.emit("enemy:defeated", { enemyId: result.defeatedEnemyId });
        }
      }
      const remaining = this.enemies.remainingRequiredEnemiesForRoom(currentRoom.id);
      const cleared = this.rooms.reportRequiredEnemies(currentRoom.id, remaining);
      if (cleared !== undefined) {
        this.handleRoomChanges([cleared]);
        this.progression.completeRoom(`${this.seed}:room:${currentRoom.index}`, false);
        this.persist();
      }
    }
  }

  private persist(): void {
    const inputSettings = this.input.settings;
    this.saves.save({
      version: 1,
      seed: this.seed,
      progression: this.progression.snapshot(),
      leftHandedControls: inputSettings.leftHanded,
      inputSettings,
      graphicsQuality: this.graphicsQuality,
      roomSequence: this.rooms.snapshot(),
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
    const currentRoom = this.rooms.currentRoom;
    const remainingEnemies = this.enemies.remainingRequiredEnemiesForRoom(currentRoom.id);
    this.hud.update(player, currentRoom.state, remainingEnemies, this.progression.snapshot());
    this.roomDebug.update(currentRoom, this.rooms.loadedRooms);
    this.renderer?.render(player, this.enemies.snapshots(), this.rooms.loadedRooms);
  }

  private spawnRoomWave(roomId: string): void {
    if (this.enemies.hasEnemiesForRoom(roomId)) return;
    const room = this.rooms.loadedRooms.find((candidate) => candidate.id === roomId);
    if (room === undefined) return;
    this.enemies.spawnWave(room.id, room.layout.enemySpawnPoints, room.worldOffsetZ);
  }

  private handleRoomChanges(changes: readonly RoomStateChange[]): void {
    for (const change of changes) {
      this.events.emit("room:changed", {
        roomId: change.roomId,
        index: change.index,
        state: change.state,
      });
      this.persist();
    }
  }

  private usePhysicsTestRoom(): boolean {
    return (
      this.config.debug.usePhysicsTestRoom ||
      new URLSearchParams(window.location.search).get("physicsTestRoom") === "1"
    );
  }

  private roomDebugEnabled(): boolean {
    return (
      this.config.debug.showRoomState ||
      new URLSearchParams(window.location.search).get("debugRooms") === "1"
    );
  }

  private readonly onResize = (): void => this.renderer?.resize();
}
