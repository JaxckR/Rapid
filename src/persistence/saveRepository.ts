import type { ProgressionSnapshot } from "../progression/progressionSystem";

export interface GameSave {
  readonly version: 1;
  readonly seed: string;
  readonly progression: ProgressionSnapshot;
  readonly leftHandedControls: boolean;
}

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const SAVE_KEY = "rapid.save.v1";

export class SaveRepository {
  public constructor(private readonly storage: StorageAdapter) {}

  public load(): GameSave | undefined {
    const serialized = this.storage.getItem(SAVE_KEY);
    if (serialized === null) return undefined;
    try {
      const candidate: unknown = JSON.parse(serialized);
      return this.isGameSave(candidate) ? candidate : undefined;
    } catch {
      return undefined;
    }
  }

  public save(save: GameSave): void {
    this.storage.setItem(SAVE_KEY, JSON.stringify(save));
  }

  private isGameSave(candidate: unknown): candidate is GameSave {
    if (typeof candidate !== "object" || candidate === null) return false;
    const record = candidate as Record<string, unknown>;
    return (
      record.version === 1 &&
      typeof record.seed === "string" &&
      typeof record.progression === "object" &&
      record.progression !== null &&
      typeof record.leftHandedControls === "boolean"
    );
  }
}
