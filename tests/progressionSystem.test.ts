import { describe, expect, it } from "vitest";
import { ProgressionSystem } from "../src/progression/progressionSystem";

describe("ProgressionSystem", () => {
  it("rejects a level room before the ordinary-room requirement is met", () => {
    const progression = new ProgressionSystem(10);

    expect(progression.completeRoom("early-level-room", true)).toEqual({
      accepted: false,
      leveledUp: false,
    });
    expect(progression.snapshot().completedRoomIds).not.toContain("early-level-room");
  });

  it("requires ten ordinary rooms before a level room grants a level", () => {
    const progression = new ProgressionSystem(10);
    for (let index = 0; index < 10; index += 1) {
      expect(progression.completeRoom(`room-${index}`, false).accepted).toBe(true);
    }

    expect(progression.nextRoomIsLevelRoom).toBe(true);
    expect(progression.completeRoom("level-room-1", true)).toEqual({
      accepted: true,
      leveledUp: true,
    });
    expect(progression.snapshot().level).toBe(2);
    expect(progression.snapshot().ordinaryRoomsCleared).toBe(0);
    expect(progression.snapshot().pendingUpgradeChoices).toHaveLength(3);
  });

  it("cannot award the same room twice after loading", () => {
    const firstSession = new ProgressionSystem(1);
    firstSession.completeRoom("ordinary-1", false);
    firstSession.completeRoom("level-1", true);

    const loaded = new ProgressionSystem(1, firstSession.snapshot());
    expect(loaded.completeRoom("level-1", true)).toEqual({
      accepted: false,
      leveledUp: false,
    });
    expect(loaded.snapshot().level).toBe(2);
  });
});
