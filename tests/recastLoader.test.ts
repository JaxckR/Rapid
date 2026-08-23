import { describe, expect, it } from "vitest";
import { invokeFactoryWithContext } from "../src/rendering/recastLoader";

describe("Recast loader", () => {
  it("provides the object receiver required by the browser factory", async () => {
    const module = { ready: true };
    function browserFactory(this: { Recast?: typeof module }): Promise<typeof module> {
      this.Recast = module;
      return Promise.resolve(module);
    }

    await expect(invokeFactoryWithContext(browserFactory)).resolves.toBe(module);
  });
});
