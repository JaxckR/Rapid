import { normalize2 } from "../core/math";
import type { InputActions, InputSource } from "./actions";

export class InputSystem implements InputSource {
  public constructor(private readonly sources: readonly InputSource[]) {}

  public sample(): InputActions {
    const samples = this.sources.map((source) => source.sample());
    return {
      move: normalize2({
        x: samples.reduce((sum, sample) => sum + sample.move.x, 0),
        y: samples.reduce((sum, sample) => sum + sample.move.y, 0),
      }),
      look: {
        x: samples.reduce((sum, sample) => sum + sample.look.x, 0),
        y: samples.reduce((sum, sample) => sum + sample.look.y, 0),
      },
      fire: samples.some((sample) => sample.fire),
      interact: samples.some((sample) => sample.interact),
      pause: samples.some((sample) => sample.pause),
    };
  }

  public dispose(): void {
    for (const source of this.sources) source.dispose();
  }
}
