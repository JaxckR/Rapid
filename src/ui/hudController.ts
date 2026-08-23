import type { PlayerSnapshot } from "../player/playerController";
import type { ProgressionSnapshot } from "../progression/progressionSystem";
import type { RoomState } from "../rooms/roomStateMachine";
import { requireElement } from "../input/dom";

export class HudController {
  private readonly health = requireElement<HTMLDivElement>("health");
  private readonly roomStatus = requireElement<HTMLDivElement>("room-status");
  private readonly pausePanel = requireElement<HTMLElement>("pause-panel");

  public update(
    player: PlayerSnapshot,
    roomState: RoomState,
    remainingEnemies: number,
    progression: ProgressionSnapshot,
  ): void {
    this.health.textContent = `HEALTH ${Math.ceil(player.health)}`;
    this.roomStatus.textContent =
      roomState === "Combat"
        ? `COMBAT · ${remainingEnemies} TARGETS`
        : `LEVEL ${progression.level} · ${roomState.toUpperCase()}`;
  }

  public setPaused(paused: boolean): void {
    this.pausePanel.hidden = !paused;
  }
}
