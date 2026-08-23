import type { RoomLayout } from "./roomGenerator";

export function createPhysicsTestRoom(width: number, length: number): RoomLayout {
  return {
    seed: "physics-test-room",
    width,
    length,
    entrance: { x: 0, y: 0, z: -length / 2 },
    exit: { x: 0, y: 0, z: length / 2 },
    obstacles: [
      {
        id: "test-low-step",
        kind: "crate",
        position: { x: -4.5, y: 0.1, z: -3 },
        size: { x: 2.4, y: 0.2, z: 2.4 },
      },
      {
        id: "test-tall-crate",
        kind: "crate",
        position: { x: 3.8, y: 1.1, z: -1 },
        size: { x: 2.2, y: 2.2, z: 2.2 },
      },
      {
        id: "test-barrier",
        kind: "barrier",
        position: { x: -2.8, y: 1.2, z: 5 },
        size: { x: 4.2, y: 2.4, z: 0.8 },
      },
      {
        id: "test-wire-barrier",
        kind: "wire_barrier",
        position: { x: 4.5, y: 1.1, z: 8 },
        size: { x: 3, y: 2.2, z: 1.1 },
      },
    ],
    enemySpawnPoints: [
      { x: -5.5, y: 0, z: 2 },
      { x: 5.5, y: 0, z: 3 },
      { x: -4.5, y: 0, z: 10 },
      { x: 2, y: 0, z: 10 },
    ],
    usedFallback: false,
  };
}
