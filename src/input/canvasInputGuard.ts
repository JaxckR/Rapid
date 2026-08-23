export class CanvasInputGuard {
  private readonly guardedEvents = [
    "contextmenu",
    "dblclick",
    "dragstart",
    "gesturestart",
    "gesturechange",
    "gestureend",
    "selectstart",
    "touchmove",
    "wheel",
  ] as const;

  public constructor(private readonly canvas: HTMLCanvasElement) {
    this.canvas.style.touchAction = "none";
    this.canvas.style.userSelect = "none";
    this.canvas.style.webkitUserSelect = "none";
    for (const eventName of this.guardedEvents) {
      this.canvas.addEventListener(eventName, this.preventDefault, { passive: false });
    }
  }

  public dispose(): void {
    for (const eventName of this.guardedEvents) {
      this.canvas.removeEventListener(eventName, this.preventDefault);
    }
  }

  private readonly preventDefault = (event: Event): void => event.preventDefault();
}
