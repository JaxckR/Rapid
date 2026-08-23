import type { InputSettings } from "../input/actions";
import { requireElement } from "../input/dom";

type SettingsListener = (settings: InputSettings) => void;

export class InputSettingsPanel {
  private readonly mouseSensitivity = requireElement<HTMLInputElement>("mouse-sensitivity");
  private readonly touchSensitivity = requireElement<HTMLInputElement>("touch-sensitivity");
  private readonly leftHanded = requireElement<HTMLInputElement>("left-handed-controls");
  private readonly mouseValue = requireElement<HTMLOutputElement>("mouse-sensitivity-value");
  private readonly touchValue = requireElement<HTMLOutputElement>("touch-sensitivity-value");
  private readonly resumeButton = requireElement<HTMLButtonElement>("resume-button");

  public constructor(
    settings: InputSettings,
    private readonly onSettingsChanged: SettingsListener,
    private readonly onResume: () => void,
  ) {
    this.mouseSensitivity.value = String(settings.mouseSensitivity);
    this.touchSensitivity.value = String(settings.touchSensitivity);
    this.leftHanded.checked = settings.leftHanded;
    this.refreshLabels();
    this.mouseSensitivity.addEventListener("input", this.onInput);
    this.touchSensitivity.addEventListener("input", this.onInput);
    this.leftHanded.addEventListener("change", this.onInput);
    this.resumeButton.addEventListener("click", this.onResumeClicked);
  }

  public dispose(): void {
    this.mouseSensitivity.removeEventListener("input", this.onInput);
    this.touchSensitivity.removeEventListener("input", this.onInput);
    this.leftHanded.removeEventListener("change", this.onInput);
    this.resumeButton.removeEventListener("click", this.onResumeClicked);
  }

  private readonly onInput = (): void => {
    this.refreshLabels();
    this.onSettingsChanged({
      mouseSensitivity: this.mouseSensitivity.valueAsNumber,
      touchSensitivity: this.touchSensitivity.valueAsNumber,
      leftHanded: this.leftHanded.checked,
    });
  };

  private readonly onResumeClicked = (): void => this.onResume();

  private refreshLabels(): void {
    this.mouseValue.value = this.mouseSensitivity.valueAsNumber.toFixed(2);
    this.touchValue.value = this.touchSensitivity.valueAsNumber.toFixed(2);
  }
}
