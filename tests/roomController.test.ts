import { describe, expect, it } from "vitest";
import { RoomController, type RoomControllerOptions } from "../src/rooms/roomController";

const OPTIONS: RoomControllerOptions = {
  baseSeed: "sequence-seed",
  generator: {
    width: 18,
    length: 28,
    obstacleCount: 0,
    maximumAttempts: 1,
    minimumObstacleSpacing: 1,
  },
  triggerInset: 4,
  doorwayWidth: 3.6,
  doorDepth: 0.35,
  doorSafetyMargin: 0.12,
  retainedPreviousRooms: 1,
};

function crossTrigger(controller: RoomController, index: number): void {
  const triggerZ = controller.loadedRooms.find((room) => room.index === index)?.triggerZ;
  if (triggerZ === undefined) throw new Error("Expected loaded trigger");
  controller.updatePlayer(
    { x: 0, y: 0, z: triggerZ - 0.1 },
    { x: 0, y: 0, z: triggerZ + 0.1 },
    0.42,
  );
}

function completeCurrentRoom(controller: RoomController): void {
  const room = controller.currentRoom;
  controller.updatePlayer(
    { x: 0, y: 0, z: room.triggerZ + 0.1 },
    { x: 0, y: 0, z: room.triggerZ + 0.2 },
    0.42,
  );
  controller.beginCombat(room.id);
  controller.reportRequiredEnemies(room.id, 0);
  controller.updatePlayer(
    { x: 0, y: 0, z: room.triggerZ + 1 },
    { x: 0, y: 0, z: room.triggerZ + 1 },
    0.42,
  );
}

describe("RoomController", () => {
  it("owns the complete combat-room lifecycle", () => {
    const rooms = new RoomController(OPTIONS);
    crossTrigger(rooms, 0);
    expect(rooms.currentRoom.state).toBe("PlayerEntered");

    rooms.updatePlayer({ x: 0, y: 0, z: -9.9 }, { x: 0, y: 0, z: -9.8 }, 0.42);
    expect(rooms.currentRoom.state).toBe("Locked");
    expect(rooms.beginCombat("room-0")?.state).toBe("Combat");
    expect(rooms.reportRequiredEnemies("room-0", 1)).toBeUndefined();
    expect(rooms.reportRequiredEnemies("room-0", 0)?.state).toBe("Cleared");
    rooms.updatePlayer({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 0.42);
    expect(rooms.currentRoom.state).toBe("Opened");
  });

  it("does not activate from the exterior side or restart after crossing", () => {
    const rooms = new RoomController(OPTIONS);
    const trigger = rooms.currentRoom.triggerZ;
    rooms.updatePlayer({ x: 0, y: 0, z: trigger + 0.1 }, { x: 0, y: 0, z: trigger - 0.1 }, 0.42);
    expect(rooms.currentRoom.state).toBe("Waiting");
    crossTrigger(rooms, 0);
    const secondCrossing = rooms.updatePlayer(
      { x: 0, y: 0, z: trigger - 0.1 },
      { x: 0, y: 0, z: trigger + 0.1 },
      0.42,
    );
    expect(secondCrossing.every((change) => change.state !== "PlayerEntered")).toBe(true);
  });

  it("cannot skip the current room or trigger outside the doorway", () => {
    const rooms = new RoomController(OPTIONS);
    const nextTrigger = rooms.loadedRooms[1]?.triggerZ;
    if (nextTrigger === undefined) throw new Error("Expected next room");
    rooms.updatePlayer(
      { x: 0, y: 0, z: nextTrigger - 0.1 },
      { x: 0, y: 0, z: nextTrigger + 0.1 },
      0.42,
    );
    expect(rooms.currentRoom.index).toBe(0);

    const currentTrigger = rooms.currentRoom.triggerZ;
    rooms.updatePlayer(
      { x: 4, y: 0, z: currentTrigger - 0.1 },
      { x: 4, y: 0, z: currentTrigger + 0.1 },
      0.42,
    );
    expect(rooms.currentRoom.state).toBe("Waiting");
  });

  it("waits until the capsule is clear before locking the entrance", () => {
    const rooms = new RoomController({ ...OPTIONS, triggerInset: 0.4 });
    crossTrigger(rooms, 0);
    const position = { x: 0, y: 0, z: rooms.currentRoom.entranceZ + 0.45 };
    rooms.updatePlayer(position, position, 0.42);
    expect(rooms.currentRoom.state).toBe("PlayerEntered");
  });

  it("derives deterministic room seeds and unloads distant completed rooms", () => {
    const first = new RoomController(OPTIONS);
    const second = new RoomController(OPTIONS);
    expect(first.loadedRooms.map((room) => room.seed)).toEqual(
      second.loadedRooms.map((room) => room.seed),
    );
    expect(first.loadedRooms.map((room) => room.layout)).toEqual(
      second.loadedRooms.map((room) => room.layout),
    );

    crossTrigger(first, 0);
    completeCurrentRoom(first);
    crossTrigger(first, 1);
    completeCurrentRoom(first);
    crossTrigger(first, 2);
    expect(first.loadedRooms.map((room) => room.index)).toEqual([1, 2, 3]);
    expect(first.drainUnloadedRoomIds()).toContain("room-0");
  });

  it("restores current and next room from a save snapshot", () => {
    const restored = new RoomController(OPTIONS, {
      version: 1,
      currentRoomIndex: 3,
      rooms: [
        { index: 3, state: "Combat" },
        { index: 4, state: "Waiting" },
      ],
    });
    expect(restored.currentRoom.id).toBe("room-3");
    expect(restored.currentRoom.state).toBe("Combat");
    expect(restored.loadedRooms.map((room) => room.index)).toEqual([3, 4]);
    expect(restored.playerSpawnPosition.z).toBeGreaterThan(restored.currentRoom.entranceZ);
  });
});
