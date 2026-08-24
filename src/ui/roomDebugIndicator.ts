import { requireElement } from "../input/dom";
import type { LoadedRoom } from "../rooms/roomController";

export class RoomDebugIndicator {
  private readonly element = requireElement<HTMLOutputElement>("room-debug");

  public constructor(visible: boolean) {
    this.element.hidden = !visible;
  }

  public update(current: LoadedRoom, loaded: readonly LoadedRoom[]): void {
    if (this.element.hidden) return;
    const loadedStates = loaded.map((room) => `#${room.index}:${room.state}`).join(" · ");
    const generation = `${current.layout.template} · attempts:${current.layout.generationAttempts} · combat:${current.layout.combatAreaCells}${current.layout.usedFallback ? " · FALLBACK" : ""}`;
    this.element.textContent = `ROOM DEBUG · ${current.id} · ${current.state} · ${current.seed} · ${generation} · [${loadedStates}]`;
  }
}
