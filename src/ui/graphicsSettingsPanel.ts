import { requireElement } from "../input/dom";
import type { GraphicsQuality } from "../rendering/quality";

export class GraphicsSettingsPanel {
  private readonly select = requireElement<HTMLSelectElement>("graphics-quality");

  public constructor(
    quality: GraphicsQuality,
    private readonly onQualityChanged: (quality: GraphicsQuality) => void,
  ) {
    this.select.value = quality;
    this.select.addEventListener("change", this.onChange);
  }

  public dispose(): void {
    this.select.removeEventListener("change", this.onChange);
  }

  private readonly onChange = (): void => {
    if (
      this.select.value === "low" ||
      this.select.value === "medium" ||
      this.select.value === "high"
    ) {
      this.onQualityChanged(this.select.value);
    }
  };
}
