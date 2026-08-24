import type { RoomLayout } from "./roomGenerator";

export function createPhysicsTestRoom(width: number, length: number): RoomLayout {
  const cellSize = 1;
  const columns = Math.floor(width / cellSize);
  const rows = Math.floor(length / cellSize);
  return {
    seed: "physics-test-room",
    template: "open_arena",
    width,
    length,
    entrance: { x: 0, y: 0, z: -length / 2 },
    exit: { x: 0, y: 0, z: length / 2 },
    structuralBlocks: [],
    protectedZones: [
      {
        id: "physics-start-zone",
        kind: "player_start",
        center: { x: 0, z: -length / 2 + 3 },
        size: { x: 6, z: 4 },
      },
    ],
    obstacles: [
      {
        id: "test-low-step",
        kind: "crate",
        position: { x: -4.5, y: 0.1, z: -3 },
        size: { x: 2.4, y: 0.2, z: 2.4 },
        rotationY: 0,
      },
      {
        id: "test-tall-crate",
        kind: "crate",
        position: { x: 3.8, y: 1.1, z: -1 },
        size: { x: 2.2, y: 2.2, z: 2.2 },
        rotationY: 0,
      },
      {
        id: "test-barrier",
        kind: "barrier",
        position: { x: -2.8, y: 1.2, z: 5 },
        size: { x: 4.2, y: 2.4, z: 0.8 },
        rotationY: 0,
      },
      {
        id: "test-wire-barrier",
        kind: "wire_barrier",
        position: { x: 4.5, y: 1.1, z: 8 },
        size: { x: 3, y: 2.2, z: 1.1 },
        rotationY: 0,
      },
    ],
    enemySpawnPoints: [
      { x: -5.5, y: 0, z: 2 },
      { x: 5.5, y: 0, z: 3 },
      { x: -4.5, y: 0, z: 10 },
      { x: 2, y: 0, z: 10 },
    ],
    occupancy: {
      cellSize,
      columns,
      rows,
      blocked: Array.from({ length: columns * rows }, () => false),
    },
    path: Array.from({ length: rows - 4 }, (_, index) => ({
      column: Math.floor(columns / 2),
      row: index + 2,
    })),
    combatAreaCells: columns * Math.floor(rows / 2),
    generationAttempts: 1,
    usedFallback: false,
  };
}
