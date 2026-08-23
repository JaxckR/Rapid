import { describe, expect, it } from "vitest";
import { QUALITY_PROFILES, hardwareScalingFor, recommendedQuality } from "../src/rendering/quality";

describe("graphics quality", () => {
  it("caps effective device pixel ratio for each quality", () => {
    expect(3 / hardwareScalingFor(3, "low")).toBe(QUALITY_PROFILES.low.devicePixelRatioCap);
    expect(3 / hardwareScalingFor(3, "medium")).toBe(QUALITY_PROFILES.medium.devicePixelRatioCap);
    expect(3 / hardwareScalingFor(3, "high")).toBe(QUALITY_PROFILES.high.devicePixelRatioCap);
  });

  it("selects low quality for constrained devices", () => {
    expect(recommendedQuality(4, 8)).toBe("low");
    expect(recommendedQuality(12, 16)).toBe("high");
  });
});
