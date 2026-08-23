import { clamp } from "../core/math";
import type {
  InputActionState,
  InputMode,
  InputSettings,
  InputSource,
  PauseIntent,
} from "./actions";
import { CanvasInputGuard } from "./canvasInputGuard";
import { DesktopInput } from "./desktopInput";
import { requireElement } from "./dom";
import { InputModeManager } from "./inputModeManager";
import { TouchInput } from "./touchInput";

export interface InputSystemOptions {
  readonly settings: InputSettings;
  readonly joystickRadiusPixels: number;
  readonly maximumLookDeltaPixels: number;
}

export class InputSystem {
  private settingsValue: InputSettings;
  private readonly modeManager: InputModeManager;
  private readonly desktop: DesktopInput;
  private readonly touch: TouchInput;
  private readonly sources: Readonly<Record<InputMode, InputSource>>;
  private readonly guard: CanvasInputGuard;
  private readonly unsubscribeModeChange: () => void;
  private pausePending: PauseIntent = "none";

  public constructor(canvas: HTMLCanvasElement, options: InputSystemOptions) {
    this.settingsValue = this.sanitizeSettings(options.settings);
    this.modeManager = new InputModeManager(
      document.body,
      requireElement<HTMLElement>("touch-controls"),
    );
    this.desktop = new DesktopInput(canvas, options.maximumLookDeltaPixels);
    this.touch = new TouchInput(canvas, options.joystickRadiusPixels, () => this.settingsValue);
    this.sources = { desktop: this.desktop, touch: this.touch };
    this.guard = new CanvasInputGuard(canvas);
    this.unsubscribeModeChange = this.modeManager.onChange(() => this.resetSources());
    this.applySettings();
    window.addEventListener("blur", this.onFocusLost);
    document.addEventListener("visibilitychange", this.onVisibilityChanged);
  }

  public sample(): InputActionState {
    const action = this.sources[this.modeManager.mode].sample(this.settingsValue);
    if (this.pausePending === "none") return action;
    const pause = this.pausePending === "force" ? "force" : action.pause;
    this.pausePending = "none";
    return {
      ...action,
      fire: pause === "force" ? false : action.fire,
      pause: pause === "none" ? "toggle" : pause,
    };
  }

  public get settings(): InputSettings {
    return { ...this.settingsValue };
  }

  public get mode(): InputMode {
    return this.modeManager.mode;
  }

  public updateSettings(settings: InputSettings): void {
    this.settingsValue = this.sanitizeSettings(settings);
    this.applySettings();
    this.resetSources();
  }

  public requestPauseToggle(): void {
    if (this.pausePending !== "force") this.pausePending = "toggle";
  }

  public dispose(): void {
    window.removeEventListener("blur", this.onFocusLost);
    document.removeEventListener("visibilitychange", this.onVisibilityChanged);
    this.unsubscribeModeChange();
    this.guard.dispose();
    this.desktop.dispose();
    this.touch.dispose();
    this.modeManager.dispose();
  }

  private resetSources(): void {
    for (const source of Object.values(this.sources)) source.reset();
  }

  private forcePause(): void {
    this.pausePending = "force";
    this.resetSources();
    this.desktop.releasePointerLock();
  }

  private sanitizeSettings(settings: InputSettings): InputSettings {
    return {
      mouseSensitivity: clamp(settings.mouseSensitivity, 0.25, 3),
      touchSensitivity: clamp(settings.touchSensitivity, 0.25, 3),
      leftHanded: settings.leftHanded,
    };
  }

  private applySettings(): void {
    document.body.classList.toggle("left-handed", this.settingsValue.leftHanded);
  }

  private readonly onFocusLost = (): void => this.forcePause();

  private readonly onVisibilityChanged = (): void => {
    if (document.visibilityState === "hidden") this.forcePause();
  };
}
