import { describe, expect, it } from "vitest";
import type { InputSettings } from "../src/input/actions";
import { DesktopActionMapper } from "../src/input/desktopActionMapper";

const SETTINGS: InputSettings = {
  mouseSensitivity: 1.5,
  touchSensitivity: 1,
  leftHanded: false,
  aimAssist: false,
};

describe("Desktop input actions", () => {
  it("maps WASD, mouse, fire, and interaction into device-independent actions", () => {
    const mapper = new DesktopActionMapper();
    mapper.keyDown("KeyW");
    mapper.keyDown("KeyD");
    mapper.keyDown("KeyE");
    mapper.addLookDelta(12, -4);
    mapper.setFiring(true);

    const action = mapper.sample(SETTINGS);

    expect(action.move.x).toBeCloseTo(Math.SQRT1_2);
    expect(action.move.y).toBeCloseTo(Math.SQRT1_2);
    expect(action.look).toEqual({ x: 18, y: -6 });
    expect(action.fire).toBe(true);
    expect(action.interact).toBe(true);
    expect(action.pause).toBe("none");
    expect(mapper.sample(SETTINGS).interact).toBe(false);
  });

  it("emits pause as an edge and gives forced pause priority", () => {
    const mapper = new DesktopActionMapper();
    mapper.keyDown("Escape");
    expect(mapper.sample(SETTINGS).pause).toBe("toggle");
    expect(mapper.sample(SETTINGS).pause).toBe("none");

    mapper.requestPause("force");
    mapper.keyDown("Escape");
    expect(mapper.sample(SETTINGS).pause).toBe("force");
  });
});
