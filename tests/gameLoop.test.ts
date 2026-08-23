import { describe, expect, it, vi } from "vitest";
import { FixedStepGameLoop } from "../src/core/gameLoop";

describe("FixedStepGameLoop", () => {
  it("runs deterministic fixed updates for a variable frame", () => {
    const update = vi.fn();
    const render = vi.fn();
    const loop = new FixedStepGameLoop(1 / 60, 0.1, 6, { update, render });

    const steps = loop.advance(1 / 30);

    expect(steps).toBe(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenNthCalledWith(1, 1 / 60);
    expect(render).toHaveBeenCalledOnce();
  });

  it("caps long frames and prevents a spiral of death", () => {
    const update = vi.fn();
    const loop = new FixedStepGameLoop(1 / 60, 0.1, 3, { update, render: vi.fn() });

    expect(loop.advance(2)).toBe(3);
    expect(update).toHaveBeenCalledTimes(3);
  });
});
