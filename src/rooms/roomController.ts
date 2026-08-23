import type { Vec3 } from "../core/math";
import {
  RoomGenerator,
  type RoomGeneratorOptions,
  type RoomLayout,
} from "../generation/roomGenerator";
import { RoomStateMachine, type RoomState } from "./roomStateMachine";

export interface RoomSequenceSnapshot {
  readonly version: 1;
  readonly currentRoomIndex: number;
  readonly rooms: readonly {
    readonly index: number;
    readonly state: RoomState;
  }[];
}

export interface LoadedRoom {
  readonly id: string;
  readonly index: number;
  readonly seed: string;
  readonly state: RoomState;
  readonly layout: RoomLayout;
  readonly worldOffsetZ: number;
  readonly entranceZ: number;
  readonly exitZ: number;
  readonly triggerZ: number;
}

export interface RoomControllerOptions {
  readonly baseSeed: string;
  readonly generator: RoomGeneratorOptions;
  readonly triggerInset: number;
  readonly doorwayWidth: number;
  readonly doorDepth: number;
  readonly doorSafetyMargin: number;
  readonly retainedPreviousRooms: number;
  readonly layoutFactory?: ((seed: string, index: number) => RoomLayout) | undefined;
}

export interface RoomStateChange {
  readonly roomId: string;
  readonly index: number;
  readonly previous: RoomState;
  readonly state: RoomState;
}

interface RoomRecord {
  readonly id: string;
  readonly index: number;
  readonly seed: string;
  readonly layout: RoomLayout;
  readonly worldOffsetZ: number;
  readonly machine: RoomStateMachine;
}

export class RoomController {
  private readonly rooms = new Map<number, RoomRecord>();
  private readonly generator: RoomGenerator;
  private readonly unloadedRoomIds: string[] = [];
  private currentIndex: number;

  public constructor(
    private readonly options: RoomControllerOptions,
    restored?: RoomSequenceSnapshot,
  ) {
    this.generator = new RoomGenerator(options.generator);
    this.currentIndex = Math.max(0, Math.floor(restored?.currentRoomIndex ?? 0));
    const restoredStates = new Map(restored?.rooms.map((room) => [room.index, room.state]) ?? []);
    this.ensureRoom(this.currentIndex, restoredStates.get(this.currentIndex));
    this.ensureRoom(this.currentIndex + 1, restoredStates.get(this.currentIndex + 1));
  }

  public get currentRoom(): LoadedRoom {
    const room = this.rooms.get(this.currentIndex);
    if (room === undefined) throw new Error("Current room is not loaded.");
    return this.toLoadedRoom(room);
  }

  public get loadedRooms(): readonly LoadedRoom[] {
    return [...this.rooms.values()]
      .sort((left, right) => left.index - right.index)
      .map((room) => this.toLoadedRoom(room));
  }

  public get playerSpawnPosition(): Vec3 {
    const room = this.currentRoom;
    return { x: 0, y: 0, z: room.entranceZ + Math.max(1, this.options.triggerInset - 1) };
  }

  public updatePlayer(
    previousPosition: Vec3,
    position: Vec3,
    playerRadius: number,
  ): readonly RoomStateChange[] {
    const changes: RoomStateChange[] = [];
    for (const room of this.rooms.values()) {
      if (room.machine.state === "Cleared") {
        this.transition(room, "Opened", changes);
      }
    }

    for (const room of this.rooms.values()) {
      if (
        room.machine.state === "PlayerEntered" &&
        this.isPlayerClearOfEntrance(room, position, playerRadius)
      ) {
        this.transition(room, "Locked", changes);
      }
    }

    const waitingRooms = [...this.rooms.values()].sort((left, right) => left.index - right.index);
    for (const room of waitingRooms) {
      if (room.machine.state !== "Waiting") continue;
      const currentRoom = this.rooms.get(this.currentIndex);
      const mayEnter =
        room.index === this.currentIndex ||
        (room.index === this.currentIndex + 1 && currentRoom?.machine.state === "Opened");
      if (!mayEnter) continue;
      const triggerZ = this.triggerZ(room);
      const insideDoorway =
        Math.abs(position.x) <= Math.max(0, this.options.doorwayWidth / 2 - playerRadius);
      const crossedInward =
        previousPosition.z <= triggerZ && position.z > triggerZ && position.z > previousPosition.z;
      if (!insideDoorway || !crossedInward) continue;
      this.transition(room, "PlayerEntered", changes);
      this.currentIndex = room.index;
      this.ensureRoom(room.index + 1);
      this.unloadDistantRooms();
      break;
    }
    return changes;
  }

  public beginCombat(roomId: string): RoomStateChange | undefined {
    const room = this.findRoom(roomId);
    if (room?.machine.state !== "Locked") return undefined;
    return this.transition(room, "Combat");
  }

  public reportRequiredEnemies(roomId: string, remaining: number): RoomStateChange | undefined {
    const room = this.findRoom(roomId);
    if (room?.machine.state !== "Combat" || remaining > 0) return undefined;
    return this.transition(room, "Cleared");
  }

  public snapshot(): RoomSequenceSnapshot {
    return {
      version: 1,
      currentRoomIndex: this.currentIndex,
      rooms: this.loadedRooms.map((room) => ({ index: room.index, state: room.state })),
    };
  }

  public drainUnloadedRoomIds(): readonly string[] {
    return this.unloadedRoomIds.splice(0);
  }

  private ensureRoom(index: number, restoredState?: RoomState): RoomRecord {
    const existing = this.rooms.get(index);
    if (existing !== undefined) return existing;
    const seed = `${this.options.baseSeed}:room:${index}`;
    const machine = RoomStateMachine.restore(restoredState ?? "Waiting");
    const room: RoomRecord = {
      id: `room-${index}`,
      index,
      seed,
      layout: this.options.layoutFactory?.(seed, index) ?? this.generator.generate(seed),
      worldOffsetZ: index * this.options.generator.length,
      machine,
    };
    this.rooms.set(index, room);
    return room;
  }

  private unloadDistantRooms(): void {
    const minimumIndex = this.currentIndex - this.options.retainedPreviousRooms;
    for (const [index, room] of this.rooms) {
      if (index >= minimumIndex) continue;
      this.rooms.delete(index);
      this.unloadedRoomIds.push(room.id);
    }
  }

  private transition(
    room: RoomRecord,
    state: RoomState,
    changes?: RoomStateChange[],
  ): RoomStateChange {
    const previous = room.machine.state;
    if (!room.machine.transition(state)) {
      throw new Error(`Invalid room transition ${previous} -> ${state} for ${room.id}.`);
    }
    const change = { roomId: room.id, index: room.index, previous, state };
    changes?.push(change);
    return change;
  }

  private isPlayerClearOfEntrance(room: RoomRecord, position: Vec3, playerRadius: number): boolean {
    const minimumDistance =
      playerRadius + this.options.doorDepth / 2 + this.options.doorSafetyMargin;
    return position.z - this.entranceZ(room) > minimumDistance;
  }

  private findRoom(roomId: string): RoomRecord | undefined {
    return [...this.rooms.values()].find((room) => room.id === roomId);
  }

  private entranceZ(room: RoomRecord): number {
    return room.worldOffsetZ - room.layout.length / 2;
  }

  private triggerZ(room: RoomRecord): number {
    return this.entranceZ(room) + this.options.triggerInset;
  }

  private toLoadedRoom(room: RoomRecord): LoadedRoom {
    return {
      id: room.id,
      index: room.index,
      seed: room.seed,
      state: room.machine.state,
      layout: room.layout,
      worldOffsetZ: room.worldOffsetZ,
      entranceZ: this.entranceZ(room),
      exitZ: room.worldOffsetZ + room.layout.length / 2,
      triggerZ: this.triggerZ(room),
    };
  }
}
