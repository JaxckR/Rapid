import type { ProgressionSnapshot } from "../progression/progressionSystem";
import type { InputSettings } from "../input/actions";
import type { GraphicsQuality } from "../rendering/quality";

export interface GameSave {
  readonly version: 1;
  readonly seed: string;
  readonly progression: ProgressionSnapshot;
  readonly leftHandedControls: boolean;
  readonly inputSettings?: InputSettings;
  readonly graphicsQuality?: GraphicsQuality;
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
      typeof record.leftHandedControls === "boolean" &&
      (record.graphicsQuality === undefined ||
        record.graphicsQuality === "low" ||
        record.graphicsQuality === "medium" ||
        record.graphicsQuality === "high") &&
      (record.inputSettings === undefined || this.isInputSettings(record.inputSettings))
    );
  }

  private isInputSettings(candidate: unknown): candidate is InputSettings {
    if (typeof candidate !== "object" || candidate === null) return false;
    const record = candidate as Record<string, unknown>;
    return (
      typeof record.mouseSensitivity === "number" &&
      Number.isFinite(record.mouseSensitivity) &&
      typeof record.touchSensitivity === "number" &&
      Number.isFinite(record.touchSensitivity) &&
      typeof record.leftHanded === "boolean" &&
      (record.aimAssist === undefined || typeof record.aimAssist === "boolean")
    );
  }
}
