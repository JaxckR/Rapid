import type { RoomState } from "../rooms/roomStateMachine";

export interface GameEvents extends Record<string, unknown> {
  readonly "combat:fired": { readonly damage: number };
  readonly "enemy:defeated": { readonly enemyId: string };
  readonly "room:changed": { readonly state: RoomState };
  readonly "game:pause-changed": { readonly paused: boolean };
}
