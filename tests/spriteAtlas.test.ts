import { describe, expect, it } from "vitest";
import {
  ENEMY_ATLAS,
  atlasFrameUvs,
  selectAtlasFrame,
  selectViewDirection,
} from "../src/rendering/spriteAtlas";

describe("eight-direction enemy sprite selection", () => {
  it("selects front, side and back views relative to enemy facing", () => {
    expect(selectViewDirection(0, 0, 0, 0, 4).name).toBe("front");
    expect(selectViewDirection(0, 0, 0, 4, 0).name).toBe("left");
    expect(selectViewDirection(0, 0, 0, 0, -4).name).toBe("back");
    expect(selectViewDirection(0, 0, 0, -4, 0).name).toBe("right");
  });

  it("wraps correctly across the negative/positive angle boundary", () => {
    const almostFullTurn = Math.PI * 2 - 0.01;
    expect(selectViewDirection(almostFullTurn, 0, 0, 0, 4).name).toBe("front");
  });
});

describe("sprite atlas animation", () => {
  it("loops moving frames but holds the last death frame", () => {
    expect(selectAtlasFrame(ENEMY_ATLAS, "move", 0.75, 3).row).toBe(4);
    expect(selectAtlasFrame(ENEMY_ATLAS, "death", 20, 3).row).toBe(25);
  });

  it("keeps transparent mobile-sized sprite UVs inside the atlas", () => {
    for (const state of ["idle", "move", "attack", "hurt", "death"] as const) {
      for (let direction = 0; direction < 8; direction += 1) {
        const uvs = atlasFrameUvs(selectAtlasFrame(ENEMY_ATLAS, state, 999, direction));
        expect(uvs).toHaveLength(8);
        for (const value of uvs) {
          expect(value).toBeGreaterThanOrEqual(0);
          expect(value).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});
