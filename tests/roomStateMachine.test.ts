import { describe, expect, it } from "vitest";
import { RoomStateMachine } from "../src/rooms/roomStateMachine";

describe("RoomStateMachine", () => {
  it("follows the complete room lifecycle", () => {
    const room = new RoomStateMachine();
    expect(room.transition("Waiting")).toBe(true);
    expect(room.handlePlayerEntry()).toBe(true);
    expect(room.beginCombat()).toBe(true);
    expect(room.state).toBe("Combat");
    expect(room.clearAndOpen()).toBe(true);
    expect(room.state).toBe("Opened");
  });

  it("does not restart after a repeated trigger crossing", () => {
    const room = new RoomStateMachine();
    room.transition("Waiting");
    expect(room.handlePlayerEntry()).toBe(true);
    expect(room.handlePlayerEntry()).toBe(false);
    room.beginCombat();
    room.clearAndOpen();
    expect(room.handlePlayerEntry()).toBe(false);
    expect(room.state).toBe("Opened");
  });

  it("restores every valid lifecycle state without skipping transitions", () => {
    for (const state of [
      "Generated",
      "Waiting",
      "PlayerEntered",
      "Locked",
      "Combat",
      "Cleared",
      "Opened",
    ] as const) {
      expect(RoomStateMachine.restore(state).state).toBe(state);
    }
  });
});
