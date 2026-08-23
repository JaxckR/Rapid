import type { InputMode } from "./actions";

export interface InputCapabilities {
  readonly touch: boolean;
  readonly finePointer: boolean;
}

type ModeListener = (mode: InputMode) => void;

export function detectInputCapabilities(): InputCapabilities {
  return {
    touch: navigator.maxTouchPoints > 0 || matchMedia("(any-pointer: coarse)").matches,
    finePointer: matchMedia("(any-pointer: fine)").matches,
  };
}

export class InputModeManager {
  private readonly listeners = new Set<ModeListener>();
  private readonly coarsePointerQuery = matchMedia("(any-pointer: coarse)");
  private readonly finePointerQuery = matchMedia("(any-pointer: fine)");
  private active: InputMode;

  public constructor(
    private readonly root: HTMLElement,
    private readonly touchControls: HTMLElement,
  ) {
    const capabilities = detectInputCapabilities();
    this.active = capabilities.touch && !capabilities.finePointer ? "touch" : "desktop";
    window.addEventListener("pointerdown", this.onPointerActivity, true);
    window.addEventListener("pointermove", this.onPointerActivity, true);
    window.addEventListener("keydown", this.onKeyboardActivity, true);
    this.coarsePointerQuery.addEventListener("change", this.onCapabilitiesChanged);
    this.finePointerQuery.addEventListener("change", this.onCapabilitiesChanged);
    this.applyMode();
  }

  public get mode(): InputMode {
    return this.active;
  }

  public onChange(listener: ModeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  public dispose(): void {
    window.removeEventListener("pointerdown", this.onPointerActivity, true);
    window.removeEventListener("pointermove", this.onPointerActivity, true);
    window.removeEventListener("keydown", this.onKeyboardActivity, true);
    this.coarsePointerQuery.removeEventListener("change", this.onCapabilitiesChanged);
    this.finePointerQuery.removeEventListener("change", this.onCapabilitiesChanged);
    this.listeners.clear();
  }

  private setMode(mode: InputMode): void {
    if (mode === this.active) return;
    this.active = mode;
    this.applyMode();
    for (const listener of this.listeners) listener(mode);
  }

  private applyMode(): void {
    this.root.dataset.inputMode = this.active;
    const touchActive = this.active === "touch";
    this.touchControls.hidden = !touchActive;
    this.touchControls.setAttribute("aria-hidden", String(!touchActive));
  }

  private readonly onPointerActivity = (event: PointerEvent): void => {
    if (event.pointerType === "touch" || event.pointerType === "pen") this.setMode("touch");
    else if (event.pointerType === "mouse") this.setMode("desktop");
  };

  private readonly onKeyboardActivity = (): void => this.setMode("desktop");

  private readonly onCapabilitiesChanged = (): void => {
    const capabilities = detectInputCapabilities();
    if (!capabilities.touch && this.active === "touch") this.setMode("desktop");
    else if (!capabilities.finePointer && capabilities.touch) this.setMode("touch");
  };
}
