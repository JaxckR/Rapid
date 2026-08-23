import HavokPhysics from "@babylonjs/havok";
import { readFileSync } from "node:fs";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import { PhysicsShapeType } from "@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js";
import { HavokPlugin } from "@babylonjs/core/Physics/v2/Plugins/havokPlugin.js";
import { PhysicsAggregate } from "@babylonjs/core/Physics/v2/physicsAggregate.js";
import "@babylonjs/core/Physics/physicsEngineComponent.js";
import { Scene } from "@babylonjs/core/scene.js";
import { describe, expect, it } from "vitest";
import { GAME_CONFIG } from "../src/core/config";
import { HavokPlayerBody } from "../src/rendering/havokPlayerBody";

describe("Havok player capsule", () => {
  it("shape-casts against a wall even with a large simulation delta", async () => {
    const engine = new NullEngine();
    const scene = new Scene(engine);
    const wasmBinary = Uint8Array.from(
      readFileSync(
        new URL("../node_modules/@babylonjs/havok/lib/esm/HavokPhysics.wasm", import.meta.url),
      ),
    ).buffer;
    const havok = await HavokPhysics({ wasmBinary });
    scene.enablePhysics(
      new Vector3(0, -GAME_CONFIG.player.gravity, 0),
      new HavokPlugin(true, havok),
    );
    const floor = MeshBuilder.CreateBox("floor", { width: 10, height: 0.2, depth: 10 }, scene);
    floor.position.y = -0.1;
    const wall = MeshBuilder.CreateBox("wall", { width: 6, height: 0.5, depth: 0.5 }, scene);
    wall.position.y = 0.25;
    const floorBody = new PhysicsAggregate(floor, PhysicsShapeType.BOX, { mass: 0 }, scene);
    const wallBody = new PhysicsAggregate(wall, PhysicsShapeType.BOX, { mass: 0 }, scene);
    const player = new HavokPlayerBody(scene, GAME_CONFIG.player, { x: 0, y: 0, z: -1 });

    const state = player.step({ x: 0, y: 0, z: GAME_CONFIG.player.maximumSpeed }, 0.1);

    expect(state.position.z).toBeLessThan(-0.55);
    expect(state.position.y).toBeGreaterThan(-0.05);

    player.dispose();
    wallBody.dispose();
    floorBody.dispose();
    scene.dispose();
    engine.dispose();
  });
});
