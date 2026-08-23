import HavokPhysics from "@babylonjs/havok";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera.js";
import { Ray } from "@babylonjs/core/Culling/ray.js";
import type { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { RecastJSPlugin } from "@babylonjs/core/Navigation/Plugins/recastJSPlugin.js";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin.js";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate.js";
import "@babylonjs/core/Physics/physicsEngineComponent.js";
import { Scene } from "@babylonjs/core/scene.js";
import type { AssetId } from "../assets/assetManifest";
import type { AssetResolver } from "../assets/assetResolver";
import type { GameConfig } from "../core/config";
import type { Vec3 } from "../core/math";
import type { EnemyArchetype, EnemySnapshot } from "../enemies/enemySystem";
import type { RoomLayout } from "../generation/roomGenerator";
import type { PlayerPhysicsState, PlayerSnapshot } from "../player/playerController";
import type { RoomState } from "../rooms/roomStateMachine";
import { HavokPlayerBody } from "./havokPlayerBody";
import { loadRecast } from "./recastLoader";

const ENEMY_COLORS: Readonly<Record<EnemyArchetype, Color3>> = {
  flying: Color3.FromHexString("#d95ce5"),
  toxic: Color3.FromHexString("#79d653"),
  jumper: Color3.FromHexString("#f49a43"),
  shooter: Color3.FromHexString("#e65a4d"),
};

const ENEMY_ASSETS: Readonly<Partial<Record<EnemyArchetype, AssetId>>> = {
  flying: "sprite.enemy.flying.idle",
  toxic: "sprite.enemy.toxic.attack",
  jumper: "sprite.enemy.jumper.jump",
  shooter: "sprite.enemy.shooter.attack",
};

export class SceneRenderer {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly enemyMeshes = new Map<string, Mesh>();
  private readonly aggregates: PhysicsAggregate[] = [];
  private playerBody: HavokPlayerBody | undefined;
  private physicsViewer: PhysicsViewer | undefined;
  private playerColliderDebug: Mesh | undefined;
  private entranceDoor: Mesh | undefined;
  private exitDoor: Mesh | undefined;
  private entranceDoorAggregate: PhysicsAggregate | undefined;
  private exitDoorAggregate: PhysicsAggregate | undefined;
  private previousRoomState: RoomState | undefined;
  private disposed = false;

  private constructor(
    canvas: HTMLCanvasElement,
    private readonly assets: AssetResolver,
    private readonly config: GameConfig,
  ) {
    this.engine = new Engine(canvas, true, { adaptToDeviceRatio: true, antialias: true });
    if (this.shouldUseLowPowerMode()) {
      this.engine.setHardwareScalingLevel(this.config.rendering.lowPowerHardwareScaling);
    }
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.025, 0.03, 0.055, 1);
    this.scene.collisionsEnabled = true;
    this.camera = new UniversalCamera("player-camera", new Vector3(0, 1.65, -11), this.scene);
    this.camera.minZ = 0.05;
    this.camera.maxZ = 80;
    this.camera.fov = 1.05;
    this.camera.inputs.clear();
    this.scene.activeCamera = this.camera;
  }

  public static async create(
    canvas: HTMLCanvasElement,
    assets: AssetResolver,
    config: GameConfig,
    layout: RoomLayout,
  ): Promise<SceneRenderer> {
    const renderer = new SceneRenderer(canvas, assets, config);
    await renderer.initialize(layout);
    return renderer;
  }

  public render(
    player: PlayerSnapshot,
    enemies: readonly EnemySnapshot[],
    roomState: RoomState,
  ): void {
    this.camera.position.set(
      player.position.x,
      player.position.y + this.config.player.eyeHeight,
      player.position.z,
    );
    this.camera.rotation.set(player.pitch, player.yaw, 0);
    const colliderPosition = this.playerBody?.centerPosition();
    if (colliderPosition !== undefined && this.playerColliderDebug !== undefined) {
      this.playerColliderDebug.position.set(
        colliderPosition.x,
        colliderPosition.y,
        colliderPosition.z,
      );
    }
    this.syncEnemies(enemies);
    this.syncDoors(roomState);
    this.scene.render();
  }

  public stepPlayer(velocity: Vec3, deltaSeconds: number): PlayerPhysicsState {
    if (this.playerBody === undefined) {
      return { position: { x: 0, y: 0, z: -11 }, velocity: { x: 0, y: 0, z: 0 }, grounded: true };
    }
    return this.playerBody.step(velocity, deltaSeconds);
  }

  public isOccluded(from: Vec3, to: Vec3): boolean {
    const origin = new Vector3(from.x, from.y + this.config.player.eyeHeight, from.z);
    const target = new Vector3(to.x, to.y + 0.9, to.z);
    const direction = target.subtract(origin);
    const distance = direction.length();
    const hit = this.scene.pickWithRay(
      new Ray(origin, direction.normalize(), distance),
      (mesh) => mesh.metadata?.blocksShots === true,
    );
    return hit?.hit === true && (hit.distance ?? distance) < distance - 0.05;
  }

  public resize(): void {
    this.engine.resize();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.playerBody?.dispose();
    this.entranceDoorAggregate?.dispose();
    this.exitDoorAggregate?.dispose();
    for (const aggregate of this.aggregates) aggregate.dispose();
    this.physicsViewer?.dispose();
    this.enemyMeshes.clear();
    this.scene.dispose();
    this.engine.dispose();
  }

  private async initialize(layout: RoomLayout): Promise<void> {
    const havok = await HavokPhysics();
    this.scene.enablePhysics(
      new Vector3(0, -this.config.player.gravity, 0),
      new HavokPlugin(true, havok),
    );
    const physicsEngine = this.scene.getPhysicsEngine();
    physicsEngine?.setTimeStep(this.config.simulation.fixedStepSeconds);
    physicsEngine?.setSubTimeStep(this.config.simulation.fixedStepSeconds);
    if (this.physicsDebugEnabled()) {
      const { PhysicsViewer } = await import("@babylonjs/core/Debug/physicsViewer.js");
      this.physicsViewer = new PhysicsViewer(this.scene);
    }
    new HemisphericLight("ambient-light", new Vector3(0, 1, 0), this.scene).intensity = 0.62;
    const keyLight = new DirectionalLight("key-light", new Vector3(-0.3, -1, 0.5), this.scene);
    keyLight.diffuse = Color3.FromHexString("#f3b36e");
    keyLight.intensity = 1.1;
    const navigationMeshes = await this.createEnvironment(layout);
    this.playerBody = new HavokPlayerBody(this.scene, this.config.player, {
      x: 0,
      y: 0,
      z: -11,
    });
    if (this.physicsViewer !== undefined) this.createPlayerColliderDebug();
    await this.initializeNavigation(navigationMeshes);
  }

  private async createEnvironment(layout: RoomLayout): Promise<Mesh[]> {
    const navigationMeshes: Mesh[] = [];
    const floor = MeshBuilder.CreateBox(
      "floor",
      { width: layout.width, height: 0.2, depth: layout.length },
      this.scene,
    );
    floor.position.y = -0.1;
    floor.metadata = { blocksShots: false };
    const floorMaterial = new StandardMaterial("floor-material", this.scene);
    floorMaterial.diffuseColor = Color3.FromHexString("#282d35");
    const floorAsset = await this.assets.resolve("texture.environment.floor");
    if (floorAsset.available && floorAsset.url !== undefined) {
      floorMaterial.diffuseTexture = new Texture(floorAsset.url, this.scene);
    }
    floor.material = floorMaterial;
    navigationMeshes.push(floor);
    this.addStaticPhysics(floor, PhysicsShapeType.BOX);

    const wallMaterial = new StandardMaterial("wall-material", this.scene);
    wallMaterial.diffuseColor = Color3.FromHexString("#434957");
    const wallAsset = await this.assets.resolve("texture.environment.wall");
    if (wallAsset.available && wallAsset.url !== undefined) {
      wallMaterial.diffuseTexture = new Texture(wallAsset.url, this.scene);
    }
    const sideWallWidth = 0.5;
    const doorwayWidth = 3.6;
    const endWallSegmentWidth = (layout.width - doorwayWidth) / 2;
    const endWallCenterX = doorwayWidth / 2 + endWallSegmentWidth / 2;
    const wallDefinitions = [
      { name: "wall-left", x: -layout.width / 2, z: 0, width: sideWallWidth, depth: layout.length },
      { name: "wall-right", x: layout.width / 2, z: 0, width: sideWallWidth, depth: layout.length },
      {
        name: "wall-entry-left",
        x: -endWallCenterX,
        z: -layout.length / 2,
        width: endWallSegmentWidth,
        depth: 0.5,
      },
      {
        name: "wall-entry-right",
        x: endWallCenterX,
        z: -layout.length / 2,
        width: endWallSegmentWidth,
        depth: 0.5,
      },
      {
        name: "wall-exit-left",
        x: -endWallCenterX,
        z: layout.length / 2,
        width: endWallSegmentWidth,
        depth: 0.5,
      },
      {
        name: "wall-exit-right",
        x: endWallCenterX,
        z: layout.length / 2,
        width: endWallSegmentWidth,
        depth: 0.5,
      },
    ];
    for (const definition of wallDefinitions) {
      const wall = MeshBuilder.CreateBox(
        definition.name,
        {
          width: definition.width,
          height: this.config.room.wallHeight,
          depth: definition.depth,
        },
        this.scene,
      );
      wall.position.set(definition.x, this.config.room.wallHeight / 2, definition.z);
      wall.material = wallMaterial;
      wall.metadata = { blocksShots: true };
      navigationMeshes.push(wall);
      this.addStaticPhysics(wall, PhysicsShapeType.BOX);
    }

    for (const obstacle of layout.obstacles) {
      const mesh = MeshBuilder.CreateBox(
        obstacle.id,
        { width: obstacle.size.x, height: obstacle.size.y, depth: obstacle.size.z },
        this.scene,
      );
      mesh.position.set(obstacle.position.x, obstacle.position.y, obstacle.position.z);
      const material = new StandardMaterial(`${obstacle.id}-material`, this.scene);
      material.diffuseColor =
        obstacle.kind === "crate"
          ? Color3.FromHexString("#745237")
          : Color3.FromHexString("#626873");
      mesh.material = material;
      mesh.metadata = { blocksShots: true };
      navigationMeshes.push(mesh);
      this.addStaticPhysics(mesh, PhysicsShapeType.BOX);
      const modelId: AssetId =
        obstacle.kind === "crate"
          ? "model.obstacle.crate"
          : obstacle.kind === "barrier"
            ? "model.obstacle.barrier"
            : "model.obstacle.wire_barrier";
      void this.applyModel(mesh, modelId);
    }

    this.entranceDoor = this.createDoor("entrance-door", -layout.length / 2);
    this.exitDoor = this.createDoor("exit-door", layout.length / 2);
    this.setDoorCollision("entrance", false);
    this.setDoorCollision("exit", true);
    return navigationMeshes;
  }

  private createDoor(name: string, z: number): Mesh {
    const door = MeshBuilder.CreateBox(name, { width: 3.6, height: 3.2, depth: 0.35 }, this.scene);
    door.position.set(0, 1.6, z);
    const material = new StandardMaterial(`${name}-material`, this.scene);
    material.diffuseColor = Color3.FromHexString("#9e4b39");
    material.emissiveColor = Color3.FromHexString("#35110c");
    door.material = material;
    door.metadata = { blocksShots: true };
    void this.applyModel(door, "model.environment.door");
    return door;
  }

  private async initializeNavigation(meshes: Mesh[]): Promise<void> {
    const recast = await loadRecast();
    const navigation = new RecastJSPlugin(recast);
    navigation.setTimeStep(this.config.simulation.fixedStepSeconds);
    navigation.setMaximumSubStepCount(this.config.simulation.maximumSubSteps);
    navigation.createNavMesh(meshes, {
      cs: 0.3,
      ch: 0.2,
      walkableSlopeAngle: 35,
      walkableHeight: 10,
      walkableClimb: 2,
      walkableRadius: 2,
      maxEdgeLen: 12,
      maxSimplificationError: 1.3,
      minRegionArea: 8,
      mergeRegionArea: 20,
      maxVertsPerPoly: 6,
      detailSampleDist: 6,
      detailSampleMaxError: 1,
    });
  }

  private syncEnemies(enemies: readonly EnemySnapshot[]): void {
    const activeIds = new Set(enemies.map((enemy) => enemy.id));
    for (const [id, mesh] of this.enemyMeshes) {
      if (activeIds.has(id)) continue;
      mesh.dispose(false, true);
      this.enemyMeshes.delete(id);
    }
    for (const enemy of enemies) {
      let mesh = this.enemyMeshes.get(enemy.id);
      if (mesh === undefined) {
        mesh = this.createEnemyMesh(enemy);
        this.enemyMeshes.set(enemy.id, mesh);
      }
      mesh.position.set(enemy.position.x, enemy.position.y + 0.9, enemy.position.z);
      const material = mesh.material;
      if (material instanceof StandardMaterial) {
        material.emissiveColor =
          enemy.attackPhase === "telegraph"
            ? Color3.Yellow()
            : ENEMY_COLORS[enemy.archetype].scale(0.25);
      }
    }
  }

  private createEnemyMesh(enemy: EnemySnapshot): Mesh {
    const mesh = MeshBuilder.CreatePlane(
      enemy.id,
      { size: this.config.rendering.enemySpriteSize },
      this.scene,
    );
    mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
    mesh.isPickable = false;
    const material = new StandardMaterial(`${enemy.id}-material`, this.scene);
    material.diffuseColor = ENEMY_COLORS[enemy.archetype];
    material.emissiveColor = ENEMY_COLORS[enemy.archetype].scale(0.25);
    material.backFaceCulling = false;
    mesh.material = material;
    const assetId = ENEMY_ASSETS[enemy.archetype];
    if (assetId !== undefined) void this.applyEnemyTexture(material, assetId);
    return mesh;
  }

  private async applyEnemyTexture(material: StandardMaterial, assetId: AssetId): Promise<void> {
    const asset = await this.assets.resolve(assetId);
    if (!asset.available || asset.url === undefined || this.disposed) return;
    const texture = new Texture(asset.url, this.scene);
    texture.hasAlpha = true;
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    material.diffuseColor = Color3.White();
  }

  private async applyModel(fallback: Mesh, assetId: AssetId): Promise<void> {
    const asset = await this.assets.resolve(assetId);
    if (!asset.available || asset.url === undefined || this.disposed) return;
    try {
      await import("@babylonjs/loaders/glTF");
      const { ImportMeshAsync } = await import("@babylonjs/core/Loading/sceneLoader.js");
      const result = await ImportMeshAsync(asset.url, this.scene);
      for (const mesh of result.meshes) {
        if (mesh.parent !== null) continue;
        mesh.parent = fallback;
        mesh.position.set(0, 0, 0);
      }
      fallback.visibility = 0;
    } catch (error: unknown) {
      console.warn(`Could not load replacement model ${assetId}; using fallback.`, error);
    }
  }

  private syncDoors(roomState: RoomState): void {
    if (roomState === this.previousRoomState) return;
    this.previousRoomState = roomState;
    this.setDoorCollision("entrance", roomState === "Locked" || roomState === "Combat");
    this.setDoorCollision("exit", roomState !== "Opened");
  }

  private addStaticPhysics(mesh: AbstractMesh, shape: PhysicsShapeType): PhysicsAggregate {
    const aggregate = new PhysicsAggregate(
      mesh,
      shape,
      { mass: 0, friction: 0, restitution: 0 },
      this.scene,
    );
    this.aggregates.push(aggregate);
    this.physicsViewer?.showBody(aggregate.body);
    return aggregate;
  }

  private setDoorCollision(door: "entrance" | "exit", enabled: boolean): void {
    const mesh = door === "entrance" ? this.entranceDoor : this.exitDoor;
    if (mesh === undefined) return;
    let aggregate = door === "entrance" ? this.entranceDoorAggregate : this.exitDoorAggregate;
    mesh.setEnabled(enabled);
    if (enabled && aggregate === undefined) {
      aggregate = new PhysicsAggregate(
        mesh,
        PhysicsShapeType.BOX,
        { mass: 0, friction: 0, restitution: 0 },
        this.scene,
      );
      this.physicsViewer?.showBody(aggregate.body);
    } else if (!enabled && aggregate !== undefined) {
      this.physicsViewer?.hideBody(aggregate.body);
      aggregate.dispose();
      aggregate = undefined;
    }
    if (door === "entrance") this.entranceDoorAggregate = aggregate;
    else this.exitDoorAggregate = aggregate;
  }

  private createPlayerColliderDebug(): void {
    const mesh = MeshBuilder.CreateCapsule(
      "player-collider-debug",
      {
        height: this.config.player.colliderHeight,
        radius: this.config.player.colliderRadius,
        tessellation: 12,
      },
      this.scene,
    );
    const material = new StandardMaterial("player-collider-debug-material", this.scene);
    material.diffuseColor = Color3.FromHexString("#55e6ff");
    material.emissiveColor = Color3.FromHexString("#134954");
    material.alpha = 0.45;
    material.wireframe = true;
    mesh.material = material;
    mesh.isPickable = false;
    this.playerColliderDebug = mesh;
  }

  private physicsDebugEnabled(): boolean {
    return (
      this.config.debug.showPhysicsColliders ||
      new URLSearchParams(window.location.search).get("debugPhysics") === "1"
    );
  }

  private shouldUseLowPowerMode(): boolean {
    const navigatorWithMemory = navigator as Navigator & { readonly deviceMemory?: number };
    return navigator.hardwareConcurrency <= 4 || (navigatorWithMemory.deviceMemory ?? 8) <= 4;
  }
}
