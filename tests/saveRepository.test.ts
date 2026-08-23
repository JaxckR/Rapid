import { describe, expect, it } from "vitest";
import { SaveRepository, type StorageAdapter } from "../src/persistence/saveRepository";

class MemoryStorage implements StorageAdapter {
  private value: string | null = null;

  public getItem(): string | null {
    return this.value;
  }

  public setItem(_key: string, value: string): void {
    this.value = value;
  }
}

describe("SaveRepository", () => {
  it("round-trips a versioned local save", () => {
    const repository = new SaveRepository(new MemoryStorage());
    const save = {
      version: 1 as const,
      seed: "saved-seed",
      progression: {
        level: 3,
        ordinaryRoomsCleared: 4,
        completedRoomIds: ["room-1"],
        pendingUpgradeChoices: [],
      },
      leftHandedControls: true,
    };

    repository.save(save);

    expect(repository.load()).toEqual(save);
  });
});
