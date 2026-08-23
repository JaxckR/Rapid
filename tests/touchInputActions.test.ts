import { describe, expect, it } from "vitest";
import type { InputSettings } from "../src/input/actions";
import { isInTouchLookRegion, TouchActionMapper } from "../src/input/touchActionMapper";

const SETTINGS: InputSettings = {
  mouseSensitivity: 1,
  touchSensitivity: 2,
  leftHanded: false,
  aimAssist: false,
};

describe("Touch input actions", () => {
  it("supports movement, look, and fire from simultaneous pointers", () => {
    const mapper = new TouchActionMapper();
    expect(mapper.beginMove(1, { x: 80, y: 200 })).toBe(true);
    expect(mapper.beginLook(2, { x: 500, y: 120 })).toBe(true);
    mapper.beginFire(3);
    mapper.updatePointer(1, { x: 128, y: 152 }, 48);
    mapper.updatePointer(2, { x: 530, y: 110 }, 48);
    mapper.requestInteract();

    const action = mapper.sample(SETTINGS);

    expect(action.move.x).toBeCloseTo(Math.SQRT1_2);
    expect(action.move.y).toBeCloseTo(Math.SQRT1_2);
    expect(action.look).toEqual({ x: 60, y: -20 });
    expect(action.fire).toBe(true);
    expect(action.interact).toBe(true);
    expect(action.pause).toBe("none");

    mapper.endPointer(1);
    mapper.endPointer(2);
    mapper.endPointer(3);
    const released = mapper.sample(SETTINGS);
    expect(released.move).toEqual({ x: 0, y: 0 });
    expect(released.look).toEqual({ x: 0, y: 0 });
    expect(released.fire).toBe(false);
  });

  it("moves the look region to the opposite half for left-handed layout", () => {
    expect(isInTouchLookRegion(750, 0, 1000, false)).toBe(true);
    expect(isInTouchLookRegion(250, 0, 1000, false)).toBe(false);
    expect(isInTouchLookRegion(250, 0, 1000, true)).toBe(true);
    expect(isInTouchLookRegion(750, 0, 1000, true)).toBe(false);
  });

  it("smooths consecutive look samples without continuing after touch stops", () => {
    const mapper = new TouchActionMapper(0.5);
    mapper.beginLook(1, { x: 400, y: 100 });
    mapper.updatePointer(1, { x: 430, y: 100 }, 48);
    expect(mapper.sample(SETTINGS).look.x).toBe(30);
    mapper.updatePointer(1, { x: 460, y: 100 }, 48);
    expect(mapper.sample(SETTINGS).look.x).toBe(45);
    expect(mapper.sample(SETTINGS).look.x).toBe(0);
  });
});
