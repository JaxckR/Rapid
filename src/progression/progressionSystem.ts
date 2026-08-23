export type UpgradeId =
  "maximum_health" | "weapon_damage" | "fire_rate" | "movement_speed" | "toxic_resistance";

export interface ProgressionSnapshot {
  readonly level: number;
  readonly ordinaryRoomsCleared: number;
  readonly completedRoomIds: readonly string[];
  readonly pendingUpgradeChoices: readonly UpgradeId[];
}

export interface RoomCompletion {
  readonly accepted: boolean;
  readonly leveledUp: boolean;
}

const UPGRADE_ROTATION: readonly UpgradeId[] = [
  "maximum_health",
  "weapon_damage",
  "fire_rate",
  "movement_speed",
  "toxic_resistance",
];

export class ProgressionSystem {
  private level: number;
  private ordinaryRoomsCleared: number;
  private readonly completedRoomIds: Set<string>;
  private pendingUpgradeChoices: UpgradeId[];

  public constructor(
    private readonly ordinaryRoomsPerLevel: number,
    initial?: ProgressionSnapshot,
  ) {
    this.level = initial?.level ?? 1;
    this.ordinaryRoomsCleared = initial?.ordinaryRoomsCleared ?? 0;
    this.completedRoomIds = new Set(initial?.completedRoomIds ?? []);
    this.pendingUpgradeChoices = [...(initial?.pendingUpgradeChoices ?? [])];
  }

  public get nextRoomIsLevelRoom(): boolean {
    return this.ordinaryRoomsCleared >= this.ordinaryRoomsPerLevel;
  }

  public completeRoom(roomId: string, isLevelRoom: boolean): RoomCompletion {
    if (this.completedRoomIds.has(roomId)) return { accepted: false, leveledUp: false };
    if (isLevelRoom && !this.nextRoomIsLevelRoom) {
      return { accepted: false, leveledUp: false };
    }
    this.completedRoomIds.add(roomId);
    if (!isLevelRoom) {
      this.ordinaryRoomsCleared += 1;
      return { accepted: true, leveledUp: false };
    }
    this.level += 1;
    this.ordinaryRoomsCleared = 0;
    this.pendingUpgradeChoices = this.createUpgradeChoices();
    return { accepted: true, leveledUp: true };
  }

  public selectUpgrade(upgrade: UpgradeId): boolean {
    if (!this.pendingUpgradeChoices.includes(upgrade)) return false;
    this.pendingUpgradeChoices = [];
    return true;
  }

  public snapshot(): ProgressionSnapshot {
    return {
      level: this.level,
      ordinaryRoomsCleared: this.ordinaryRoomsCleared,
      completedRoomIds: [...this.completedRoomIds],
      pendingUpgradeChoices: [...this.pendingUpgradeChoices],
    };
  }

  private createUpgradeChoices(): UpgradeId[] {
    const offset = this.level % UPGRADE_ROTATION.length;
    return Array.from({ length: 3 }, (_, index) => {
      const upgrade = UPGRADE_ROTATION[(offset + index) % UPGRADE_ROTATION.length];
      if (upgrade === undefined) throw new Error("Upgrade rotation is empty.");
      return upgrade;
    });
  }
}
