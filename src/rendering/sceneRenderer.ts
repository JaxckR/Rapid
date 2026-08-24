import HavokPhysics from "@babylonjs/havok";
import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera.js";
import { Ray } from "@babylonjs/core/Culling/ray.js";
import type { PhysicsViewer } from "@babylonjs/core/Debug/physicsViewer.js";
import { Engine } from "@babylonjs/core/Engines/engine.js";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight.js";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight.js";
import { PointLight } from "@babylonjs/core/Lights/pointLight.js";
import { ShadowGenerator } from "@babylonjs/core/Lights/Shadows/shadowGenerator.js";
import { Material } from "@babylonjs/core/Materials/material.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture.js";
import { Texture } from "@babylonjs/core/Materials/Textures/texture.js";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer.js";
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
import type { ObstacleKind, RoomLayout } from "../generation/roomGenerator";
import type { PlayerPhysicsState, PlayerSnapshot } from "../player/playerController";
import type { LoadedRoom } from "../rooms/roomController";
import type { RoomState } from "../rooms/roomStateMachine";
import { HavokPlayerBody } from "./havokPlayerBody";
import { loadRecast } from "./recastLoader";
import { CombatEffects } from "./combatEffects";
import type { GraphicsQuality } from "./quality";
import { QUALITY_PROFILES, hardwareScalingFor } from "./quality";
import { ENEMY_ATLAS, atlasFrameUvs, selectAtlasFrame, selectViewDirection } from "./spriteAtlas";

const ENEMY_COLORS: Readonly<Record<EnemyArchetype, Color3>> = {
  flying: Color3.FromHexString("#d95ce5"),
  toxic: Color3.FromHexString("#79d653"),
  jumper: Color3.FromHexString("#f49a43"),
  shooter: Color3.FromHexString("#e65a4d"),
};

const ENEMY_HEX_COLORS: Readonly<Record<EnemyArchetype, string>> = {
  flying: "#d95ce5",
  toxic: "#79d653",
  jumper: "#f49a43",
  shooter: "#e65a4d",
};

const ENEMY_ASSETS: Readonly<Record<EnemyArchetype, AssetId>> = {
  flying: "sprite.enemy.flying.atlas",
  toxic: "sprite.enemy.toxic.atlas",
  jumper: "sprite.enemy.jumper.atlas",
  shooter: "sprite.enemy.shooter.atlas",
};

interface EnemyVisual {
  readonly mesh: Mesh;
  readonly material: StandardMaterial;
  readonly archetype: EnemyArchetype;
  animationState: EnemySnapshot["animationState"];
  animationClock: number;
}

interface RenderedRoom {
  readonly id: string;
  readonly meshes: Set<AbstractMesh>;
  readonly materials: Set<StandardMaterial>;
  readonly aggregates: Set<PhysicsAggregate>;
  readonly navigationMeshes: Mesh[];
  entranceDoor: Mesh | undefined;
  exitDoor: Mesh | undefined;
  entranceDoorAggregate: PhysicsAggregate | undefined;
  exitDoorAggregate: PhysicsAggregate | undefined;
  state: RoomState | undefined;
}

export class SceneRenderer {
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly enemyVisuals = new Map<string, EnemyVisual>();
  private readonly atlasTextures = new Map<EnemyArchetype, Texture>();
  private readonly loadingAtlases = new Set<EnemyArchetype>();
  private readonly renderedRooms = new Map<string, RenderedRoom>();
  private readonly loadingRooms = new Set<string>();
  private readonly combatEffects: CombatEffects;
  private readonly muzzleLight: PointLight;
  private playerBody: HavokPlayerBody | undefined;
  private physicsViewer: PhysicsViewer | undefined;
  private playerColliderDebug: Mesh | undefined;
  private shadowGenerator: ShadowGenerator | undefined;
  private navigation: RecastJSPlugin | undefined;
  private quality: GraphicsQuality;
  private muzzleLightTime = 0;
  private disposed = false;

  private constructor(
    canvas: HTMLCanvasElement,
    private readonly assets: AssetResolver,
    private readonly config: GameConfig,
    quality: GraphicsQuality,
    initialPlayerPosition: Vec3,
  ) {
    this.quality = quality;
    this.engine = new Engine(canvas, true, { adaptToDeviceRatio: false, antialias: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.025, 0.03, 0.055, 1);
    this.scene.collisionsEnabled = true;
    this.camera = new UniversalCamera(
      "player-camera",
      new Vector3(
        initialPlayerPosition.x,
        initialPlayerPosition.y + config.player.eyeHeight,
        initialPlayerPosition.z,
      ),
      this.scene,
    );
    this.camera.minZ = 0.05;
    this.camera.maxZ = 80;
    this.camera.fov = 1.05;
    this.camera.inputs.clear();
    this.scene.activeCamera = this.camera;
    this.muzzleLight = new PointLight("muzzle-light", this.camera.position.clone(), this.scene);
    this.muzzleLight.diffuse = Color3.FromHexString("#ffb34f");
    this.muzzleLight.range = 8;
    this.muzzleLight.intensity = 0;
    this.combatEffects = new CombatEffects(this.scene, quality);
    this.setQuality(quality);
  }

  public static async create(
    canvas: HTMLCanvasElement,
    assets: AssetResolver,
    config: GameConfig,
    rooms: readonly LoadedRoom[],
    quality: GraphicsQuality,
    initialPlayerPosition: Vec3,
  ): Promise<SceneRenderer> {
    const renderer = new SceneRenderer(canvas, assets, config, quality, initialPlayerPosition);
    await renderer.initialize(rooms, initialPlayerPosition);
    return renderer;
  }

  public render(
    player: PlayerSnapshot,
    enemies: readonly EnemySnapshot[],
    rooms: readonly LoadedRoom[],
  ): void {
    const visualDeltaSeconds = Math.min(this.engine.getDeltaTime() / 1000, 0.1);
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
    this.syncEnemies(enemies, visualDeltaSeconds);
    this.updateRooms(rooms);
    this.combatEffects.update(visualDeltaSeconds);
    this.updateMuzzleLight(visualDeltaSeconds);
    this.scene.render();
  }

  public setQuality(quality: GraphicsQuality): void {
    this.quality = quality;
    const devicePixelRatio = window.devicePixelRatio || 1;
    this.engine.setHardwareScalingLevel(hardwareScalingFor(devicePixelRatio, quality));
    this.scene.shadowsEnabled = QUALITY_PROFILES[quality].shadows;
    this.combatEffects.setQuality(quality);
    if (!QUALITY_PROFILES[quality].dynamicMuzzleLight) this.muzzleLight.intensity = 0;
    this.resize();
  }

  public playWeaponFire(): void {
    if (!QUALITY_PROFILES[this.quality].dynamicMuzzleLight) return;
    this.muzzleLightTime = 0.055;
    this.muzzleLight.intensity = 2.2;
  }

  public playHitEffect(enemyId: string): void {
    const visual = this.enemyVisuals.get(enemyId);
    if (visual === undefined) return;
    this.combatEffects.emitImpact(visual.mesh.position.clone());
  }

  public updateRooms(rooms: readonly LoadedRoom[]): void {
    this.syncRooms(rooms);
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
    for (const room of this.renderedRooms.values()) this.disposeRenderedRoom(room);
    this.renderedRooms.clear();
    this.physicsViewer?.dispose();
    this.navigation?.dispose();
    this.enemyVisuals.clear();
    this.atlasTextures.clear();
    this.scene.dispose();
    this.engine.dispose();
  }

  private async initialize(
    rooms: readonly LoadedRoom[],
    initialPlayerPosition: Vec3,
  ): Promise<void> {
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
    this.shadowGenerator = new ShadowGenerator(1024, keyLight);
    this.shadowGenerator.usePercentageCloserFiltering = true;
    for (const room of rooms) await this.createEnvironment(room);
    this.playerBody = new HavokPlayerBody(this.scene, this.config.player, {
      ...initialPlayerPosition,
    });
    if (this.physicsViewer !== undefined) this.createPlayerColliderDebug();
    await this.initializeNavigation();
  }

  private async createEnvironment(room: LoadedRoom): Promise<void> {
    const layout = room.layout;
    const rendered: RenderedRoom = {
      id: room.id,
      meshes: new Set(),
      materials: new Set(),
      aggregates: new Set(),
      navigationMeshes: [],
      entranceDoor: undefined,
      exitDoor: undefined,
      entranceDoorAggregate: undefined,
      exitDoorAggregate: undefined,
      state: undefined,
    };
    this.renderedRooms.set(room.id, rendered);
    const floor = MeshBuilder.CreateBox(
      `${room.id}:floor`,
      { width: layout.width, height: 0.2, depth: layout.length },
      this.scene,
    );
    floor.position.set(0, -0.1, room.worldOffsetZ);
    floor.metadata = { blocksShots: false };
    floor.receiveShadows = true;
    const floorMaterial = new StandardMaterial(`${room.id}:floor-material`, this.scene);
    floorMaterial.diffuseColor = Color3.FromHexString("#282d35");
    const floorAsset = await this.assets.resolve("texture.environment.floor");
    if (this.disposed || this.renderedRooms.get(room.id) !== rendered) {
      floor.dispose(false, false);
      floorMaterial.dispose(true, true);
      return;
    }
    if (floorAsset.available && floorAsset.url !== undefined) {
      floorMaterial.diffuseTexture = new Texture(floorAsset.url, this.scene);
    }
    floor.material = floorMaterial;
    rendered.meshes.add(floor);
    rendered.materials.add(floorMaterial);
    rendered.navigationMeshes.push(floor);
    this.addStaticPhysics(rendered, floor, PhysicsShapeType.BOX);

    const wallMaterial = new StandardMaterial(`${room.id}:wall-material`, this.scene);
    wallMaterial.diffuseColor = Color3.FromHexString("#434957");
    const wallAsset = await this.assets.resolve("texture.environment.wall");
    if (this.disposed || this.renderedRooms.get(room.id) !== rendered) {
      wallMaterial.dispose(true, true);
      return;
    }
    if (wallAsset.available && wallAsset.url !== undefined) {
      wallMaterial.diffuseTexture = new Texture(wallAsset.url, this.scene);
    }
    rendered.materials.add(wallMaterial);
    const sideWallWidth = 0.5;
    const doorwayWidth = this.config.room.doorwayWidth;
    const endWallSegmentWidth = (layout.width - doorwayWidth) / 2;
    const endWallCenterX = doorwayWidth / 2 + endWallSegmentWidth / 2;
    const wallDefinitions = [
      {
        name: "wall-left",
        x: -layout.width / 2,
        z: room.worldOffsetZ,
        width: sideWallWidth,
        depth: layout.length,
      },
      {
        name: "wall-right",
        x: layout.width / 2,
        z: room.worldOffsetZ,
        width: sideWallWidth,
        depth: layout.length,
      },
      {
        name: "wall-entry-left",
        x: -endWallCenterX,
        z: room.entranceZ + 0.125,
        width: endWallSegmentWidth,
        depth: 0.25,
      },
      {
        name: "wall-entry-right",
        x: endWallCenterX,
        z: room.entranceZ + 0.125,
        width: endWallSegmentWidth,
        depth: 0.25,
      },
      {
        name: "wall-exit-left",
        x: -endWallCenterX,
        z: room.exitZ - 0.125,
        width: endWallSegmentWidth,
        depth: 0.25,
      },
      {
        name: "wall-exit-right",
        x: endWallCenterX,
        z: room.exitZ - 0.125,
        width: endWallSegmentWidth,
        depth: 0.25,
      },
    ];
    for (const definition of wallDefinitions) {
      const wall = MeshBuilder.CreateBox(
        `${room.id}:${definition.name}`,
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
      wall.receiveShadows = true;
      this.shadowGenerator?.addShadowCaster(wall);
      rendered.meshes.add(wall);
      rendered.navigationMeshes.push(wall);
      this.addStaticPhysics(rendered, wall, PhysicsShapeType.BOX);
    }

    for (const block of layout.structuralBlocks) {
      const mesh = MeshBuilder.CreateBox(
        `${room.id}:${block.id}`,
        { width: block.size.x, height: block.size.y, depth: block.size.z },
        this.scene,
      );
      mesh.position.set(block.position.x, block.position.y, block.position.z + room.worldOffsetZ);
      mesh.material = wallMaterial;
      mesh.metadata = { blocksShots: true };
      mesh.receiveShadows = true;
      this.shadowGenerator?.addShadowCaster(mesh);
      rendered.meshes.add(mesh);
      rendered.navigationMeshes.push(mesh);
      this.addStaticPhysics(rendered, mesh, PhysicsShapeType.BOX);
    }

    const obstacleSources = new Map<ObstacleKind, Mesh>();
    const obstacleMaterials = new Map<ObstacleKind, StandardMaterial>();
    for (const obstacle of layout.obstacles) {
      let material = obstacleMaterials.get(obstacle.kind);
      if (material === undefined) {
        material = new StandardMaterial(`${room.id}:${obstacle.kind}-material`, this.scene);
        material.diffuseColor =
          obstacle.kind === "crate"
            ? Color3.FromHexString("#745237")
            : obstacle.kind === "barrier"
              ? Color3.FromHexString("#626873")
              : Color3.FromHexString("#58605f");
        obstacleMaterials.set(obstacle.kind, material);
        rendered.materials.add(material);
      }
      let source = obstacleSources.get(obstacle.kind);
      let mesh: AbstractMesh;
      if (source === undefined) {
        source = MeshBuilder.CreateBox(
          `${room.id}:${obstacle.kind}-source`,
          { size: 1 },
          this.scene,
        );
        mesh = source;
        obstacleSources.set(obstacle.kind, source);
        const modelId: AssetId =
          obstacle.kind === "crate"
            ? "model.obstacle.crate"
            : obstacle.kind === "barrier"
              ? "model.obstacle.barrier"
              : "model.obstacle.wire_barrier";
        void this.applyModel(source, modelId);
      } else {
        mesh = source.createInstance(`${room.id}:${obstacle.id}`);
      }
      mesh.position.set(
        obstacle.position.x,
        obstacle.position.y,
        obstacle.position.z + room.worldOffsetZ,
      );
      mesh.scaling.set(obstacle.size.x, obstacle.size.y, obstacle.size.z);
      mesh.rotation.y = obstacle.rotationY;
      mesh.material = material;
      mesh.metadata = { blocksShots: true };
      mesh.receiveShadows = true;
      this.shadowGenerator?.addShadowCaster(mesh);
      rendered.meshes.add(mesh);

      const collider = MeshBuilder.CreateBox(
        `${room.id}:${obstacle.id}:collider`,
        { width: obstacle.size.x, height: obstacle.size.y, depth: obstacle.size.z },
        this.scene,
      );
      collider.position.copyFrom(mesh.position);
      collider.rotation.y = obstacle.rotationY;
      collider.visibility = 0;
      collider.isPickable = false;
      rendered.meshes.add(collider);
      rendered.navigationMeshes.push(collider);
      this.addStaticPhysics(rendered, collider, PhysicsShapeType.BOX);
    }

    if (this.generationDebugEnabled())
      this.createGenerationDebug(rendered, layout, room.worldOffsetZ);

    rendered.entranceDoor = this.createDoor(rendered, `${room.id}:entrance-door`, room.entranceZ);
    rendered.exitDoor = this.createDoor(rendered, `${room.id}:exit-door`, room.exitZ);
    this.syncDoors(rendered, room.state);
  }

  private createDoor(rendered: RenderedRoom, name: string, z: number): Mesh {
    const door = MeshBuilder.CreateBox(
      name,
      {
        width: this.config.room.doorwayWidth,
        height: 3.2,
        depth: this.config.room.doorDepth,
      },
      this.scene,
    );
    door.position.set(0, 1.6, z);
    const material = new StandardMaterial(`${name}-material`, this.scene);
    material.diffuseColor = Color3.FromHexString("#9e4b39");
    material.emissiveColor = Color3.FromHexString("#35110c");
    door.material = material;
    door.metadata = { blocksShots: true };
    door.receiveShadows = true;
    this.shadowGenerator?.addShadowCaster(door);
    rendered.meshes.add(door);
    rendered.materials.add(material);
    void this.applyModel(door, "model.environment.door");
    return door;
  }

  private async initializeNavigation(): Promise<void> {
    const recast = await loadRecast();
    this.navigation = new RecastJSPlugin(recast);
    this.navigation.setTimeStep(this.config.simulation.fixedStepSeconds);
    this.navigation.setMaximumSubStepCount(this.config.simulation.maximumSubSteps);
    this.rebuildNavigation();
  }

  private rebuildNavigation(): void {
    const meshes = [...this.renderedRooms.values()].flatMap((room) => room.navigationMeshes);
    if (this.navigation === undefined || meshes.length === 0) return;
    this.navigation.createNavMesh(meshes, {
      cs: 0.3,
      ch: 0.2,
      walkableSlopeAngle: 35,
      walkableHeight: this.config.player.colliderHeight,
      walkableClimb: this.config.player.stepHeight,
      walkableRadius: this.config.player.colliderRadius,
      maxEdgeLen: 12,
      maxSimplificationError: 1.3,
      minRegionArea: 8,
      mergeRegionArea: 20,
      maxVertsPerPoly: 6,
      detailSampleDist: 6,
      detailSampleMaxError: 1,
    });
  }

  private syncEnemies(enemies: readonly EnemySnapshot[], deltaSeconds: number): void {
    const activeIds = new Set(enemies.map((enemy) => enemy.id));
    for (const [id, visual] of this.enemyVisuals) {
      if (activeIds.has(id)) continue;
      visual.material.dispose(false, false);
      visual.mesh.dispose(false, false);
      this.enemyVisuals.delete(id);
    }
    for (const enemy of enemies) {
      let visual = this.enemyVisuals.get(enemy.id);
      if (visual === undefined) {
        visual = this.createEnemyVisual(enemy);
        this.enemyVisuals.set(enemy.id, visual);
      }
      visual.mesh.position.set(enemy.position.x, enemy.position.y + 0.9, enemy.position.z);
      if (visual.animationState !== enemy.animationState) {
        visual.animationState = enemy.animationState;
        visual.animationClock = 0;
      } else {
        visual.animationClock += deltaSeconds;
      }
      visual.material.emissiveColor =
        enemy.attackPhase === "telegraph"
          ? Color3.Yellow()
          : ENEMY_COLORS[enemy.archetype].scale(0.25);
      const direction = selectViewDirection(
        enemy.facingYaw,
        enemy.position.x,
        enemy.position.z,
        this.camera.position.x,
        this.camera.position.z,
      );
      const frame = selectAtlasFrame(
        ENEMY_ATLAS,
        enemy.animationState,
        visual.animationClock,
        direction.index,
      );
      visual.mesh.updateVerticesData(VertexBuffer.UVKind, atlasFrameUvs(frame));
    }
  }

  private createEnemyVisual(enemy: EnemySnapshot): EnemyVisual {
    const mesh = MeshBuilder.CreatePlane(
      enemy.id,
      { size: this.config.rendering.enemySpriteSize, updatable: true },
      this.scene,
    );
    mesh.billboardMode = Mesh.BILLBOARDMODE_Y;
    mesh.isPickable = false;
    const material = new StandardMaterial(`${enemy.id}-material`, this.scene);
    material.diffuseColor = Color3.White();
    material.emissiveColor = ENEMY_COLORS[enemy.archetype].scale(0.25);
    material.backFaceCulling = false;
    material.disableLighting = false;
    material.useAlphaFromDiffuseTexture = true;
    material.alphaCutOff = 0.12;
    material.transparencyMode = Material.MATERIAL_ALPHATESTANDBLEND;
    material.needDepthPrePass = true;
    material.forceDepthWrite = true;
    mesh.material = material;
    const texture = this.enemyAtlasTexture(enemy.archetype);
    material.diffuseTexture = texture;
    material.opacityTexture = texture;
    const visual: EnemyVisual = {
      mesh,
      material,
      archetype: enemy.archetype,
      animationState: enemy.animationState,
      animationClock: 0,
    };
    void this.loadEnemyAtlas(enemy.archetype);
    return visual;
  }

  private enemyAtlasTexture(archetype: EnemyArchetype): Texture {
    const existing = this.atlasTextures.get(archetype);
    if (existing !== undefined) return existing;
    const texture = this.createPlaceholderAtlas(archetype);
    this.atlasTextures.set(archetype, texture);
    return texture;
  }

  private createPlaceholderAtlas(archetype: EnemyArchetype): DynamicTexture {
    const cellSize = 32;
    const texture = new DynamicTexture(
      `${archetype}-procedural-atlas`,
      { width: ENEMY_ATLAS.columns * cellSize, height: ENEMY_ATLAS.rows * cellSize },
      this.scene,
      false,
      Texture.NEAREST_SAMPLINGMODE,
    );
    texture.hasAlpha = true;
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    const context = texture.getContext();
    context.clearRect(0, 0, texture.getSize().width, texture.getSize().height);
    for (let row = 0; row < ENEMY_ATLAS.rows; row += 1) {
      for (let column = 0; column < ENEMY_ATLAS.columns; column += 1) {
        const centerX = column * cellSize + cellSize / 2;
        const centerY = row * cellSize + cellSize / 2;
        const pulse = (row % 3) * 0.8;
        context.fillStyle = "rgba(0,0,0,0.42)";
        context.fillRect(centerX - 10, centerY + 9, 20, 4);
        context.fillStyle = ENEMY_HEX_COLORS[archetype];
        context.fillRect(centerX - 9, centerY - 11 - pulse, 18, 23 + pulse);
        const facingOffset = Math.sin((column / 8) * Math.PI * 2) * 5;
        context.fillStyle = row >= 18 ? "#351b1b" : "#fff1a8";
        context.fillRect(centerX - 5 + facingOffset, centerY - 5, 3, 3);
        context.fillRect(centerX + 2 + facingOffset, centerY - 5, 3, 3);
      }
    }
    texture.update(false);
    return texture;
  }

  private async loadEnemyAtlas(archetype: EnemyArchetype): Promise<void> {
    if (this.loadingAtlases.has(archetype)) return;
    this.loadingAtlases.add(archetype);
    const asset = await this.assets.resolve(ENEMY_ASSETS[archetype]);
    if (!asset.available || asset.url === undefined || this.disposed) return;
    const texture = new Texture(asset.url, this.scene, false, false, Texture.NEAREST_SAMPLINGMODE);
    texture.hasAlpha = true;
    texture.wrapU = Texture.CLAMP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.anisotropicFilteringLevel = 1;
    const previous = this.atlasTextures.get(archetype);
    this.atlasTextures.set(archetype, texture);
    for (const visual of this.enemyVisuals.values()) {
      if (visual.archetype !== archetype) continue;
      visual.material.diffuseTexture = texture;
      visual.material.opacityTexture = texture;
      visual.material.diffuseColor = Color3.White();
    }
    previous?.dispose();
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

  private syncRooms(rooms: readonly LoadedRoom[]): void {
    const activeIds = new Set(rooms.map((room) => room.id));
    let navigationChanged = false;
    for (const [id, rendered] of this.renderedRooms) {
      if (activeIds.has(id)) continue;
      this.disposeRenderedRoom(rendered);
      this.renderedRooms.delete(id);
      navigationChanged = true;
    }
    for (const room of rooms) {
      const rendered = this.renderedRooms.get(room.id);
      if (rendered !== undefined) {
        this.syncDoors(rendered, room.state);
        continue;
      }
      if (this.loadingRooms.has(room.id)) continue;
      this.loadingRooms.add(room.id);
      void this.createEnvironment(room)
        .then(() => {
          if (!this.disposed) this.rebuildNavigation();
        })
        .catch((error: unknown) => {
          console.warn(`Could not create ${room.id}.`, error);
        })
        .finally(() => this.loadingRooms.delete(room.id));
    }
    if (navigationChanged) this.rebuildNavigation();
  }

  private syncDoors(rendered: RenderedRoom, state: RoomState): void {
    rendered.state = state;
    const entranceClosed = state === "Locked" || state === "Combat" || state === "Cleared";
    this.setDoorCollision(rendered, "entrance", entranceClosed);
    this.setDoorCollision(rendered, "exit", state !== "Opened");
  }

  private addStaticPhysics(
    rendered: RenderedRoom,
    mesh: AbstractMesh,
    shape: PhysicsShapeType,
  ): PhysicsAggregate {
    const aggregate = new PhysicsAggregate(
      mesh,
      shape,
      { mass: 0, friction: 0, restitution: 0 },
      this.scene,
    );
    rendered.aggregates.add(aggregate);
    this.physicsViewer?.showBody(aggregate.body);
    return aggregate;
  }

  private setDoorCollision(
    rendered: RenderedRoom,
    door: "entrance" | "exit",
    enabled: boolean,
  ): void {
    const mesh = door === "entrance" ? rendered.entranceDoor : rendered.exitDoor;
    if (mesh === undefined) return;
    let aggregate =
      door === "entrance" ? rendered.entranceDoorAggregate : rendered.exitDoorAggregate;
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
    if (door === "entrance") rendered.entranceDoorAggregate = aggregate;
    else rendered.exitDoorAggregate = aggregate;
  }

  private disposeRenderedRoom(rendered: RenderedRoom): void {
    if (rendered.entranceDoorAggregate !== undefined) {
      this.physicsViewer?.hideBody(rendered.entranceDoorAggregate.body);
    }
    if (rendered.exitDoorAggregate !== undefined) {
      this.physicsViewer?.hideBody(rendered.exitDoorAggregate.body);
    }
    rendered.entranceDoorAggregate?.dispose();
    rendered.exitDoorAggregate?.dispose();
    for (const aggregate of rendered.aggregates) {
      this.physicsViewer?.hideBody(aggregate.body);
      aggregate.dispose();
    }
    for (const mesh of rendered.meshes) mesh.dispose(false, false);
    for (const material of rendered.materials) material.dispose(true, true);
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

  private generationDebugEnabled(): boolean {
    return (
      this.config.debug.showGenerationGrid ||
      new URLSearchParams(window.location.search).get("debugGeneration") === "1"
    );
  }

  private createGenerationDebug(
    rendered: RenderedRoom,
    layout: RoomLayout,
    worldOffsetZ: number,
  ): void {
    const gridLines: Vector3[][] = [];
    const halfWidth = layout.width / 2;
    const halfLength = layout.length / 2;
    for (let column = 0; column <= layout.occupancy.columns; column += 1) {
      const x = -halfWidth + column * layout.occupancy.cellSize;
      gridLines.push([
        new Vector3(x, 0.018, worldOffsetZ - halfLength),
        new Vector3(x, 0.018, worldOffsetZ + halfLength),
      ]);
    }
    for (let row = 0; row <= layout.occupancy.rows; row += 1) {
      const z = worldOffsetZ - halfLength + row * layout.occupancy.cellSize;
      gridLines.push([new Vector3(-halfWidth, 0.018, z), new Vector3(halfWidth, 0.018, z)]);
    }
    const grid = MeshBuilder.CreateLineSystem(
      `${rendered.id}:generation-grid`,
      { lines: gridLines },
      this.scene,
    );
    grid.color = Color3.FromHexString("#245666");
    grid.isPickable = false;
    rendered.meshes.add(grid);

    const blockedMaterial = new StandardMaterial(
      `${rendered.id}:blocked-debug-material`,
      this.scene,
    );
    blockedMaterial.diffuseColor = Color3.FromHexString("#c53c45");
    blockedMaterial.emissiveColor = Color3.FromHexString("#4c1016");
    blockedMaterial.alpha = 0.38;
    rendered.materials.add(blockedMaterial);
    for (let row = 0; row < layout.occupancy.rows; row += 1) {
      for (let column = 0; column < layout.occupancy.columns; column += 1) {
        if (!layout.occupancy.blocked[row * layout.occupancy.columns + column]) continue;
        const cell = MeshBuilder.CreateBox(
          `${rendered.id}:blocked-${column}-${row}`,
          {
            width: layout.occupancy.cellSize * 0.88,
            height: 0.025,
            depth: layout.occupancy.cellSize * 0.88,
          },
          this.scene,
        );
        cell.position.set(
          -halfWidth + (column + 0.5) * layout.occupancy.cellSize,
          0.035,
          worldOffsetZ - halfLength + (row + 0.5) * layout.occupancy.cellSize,
        );
        cell.material = blockedMaterial;
        cell.isPickable = false;
        rendered.meshes.add(cell);
      }
    }

    const protectedMaterial = new StandardMaterial(
      `${rendered.id}:protected-debug-material`,
      this.scene,
    );
    protectedMaterial.diffuseColor = Color3.FromHexString("#43d98c");
    protectedMaterial.emissiveColor = Color3.FromHexString("#124f34");
    protectedMaterial.alpha = 0.28;
    protectedMaterial.wireframe = true;
    rendered.materials.add(protectedMaterial);
    for (const zone of layout.protectedZones) {
      const mesh = MeshBuilder.CreateBox(
        `${rendered.id}:protected:${zone.id}`,
        { width: zone.size.x, height: 0.08, depth: zone.size.z },
        this.scene,
      );
      mesh.position.set(zone.center.x, 0.08, zone.center.z + worldOffsetZ);
      mesh.material = protectedMaterial;
      mesh.isPickable = false;
      rendered.meshes.add(mesh);
    }

    const path = MeshBuilder.CreateLines(
      `${rendered.id}:generation-path`,
      {
        points: layout.path.map(
          (cell) =>
            new Vector3(
              -halfWidth + (cell.column + 0.5) * layout.occupancy.cellSize,
              0.12,
              worldOffsetZ - halfLength + (cell.row + 0.5) * layout.occupancy.cellSize,
            ),
        ),
      },
      this.scene,
    );
    path.color = Color3.FromHexString("#ffe06a");
    path.isPickable = false;
    rendered.meshes.add(path);
  }

  private updateMuzzleLight(deltaSeconds: number): void {
    this.muzzleLight.position.copyFrom(this.camera.position);
    if (this.muzzleLightTime <= 0) return;
    this.muzzleLightTime = Math.max(0, this.muzzleLightTime - deltaSeconds);
    this.muzzleLight.intensity = this.muzzleLightTime > 0 ? 2.2 : 0;
  }
}
