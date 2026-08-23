export type RoomState =
  "Generated" | "Waiting" | "PlayerEntered" | "Locked" | "Combat" | "Cleared" | "Opened";

const TRANSITIONS: Readonly<Record<RoomState, readonly RoomState[]>> = {
  Generated: ["Waiting"],
  Waiting: ["PlayerEntered"],
  PlayerEntered: ["Locked"],
  Locked: ["Combat"],
  Combat: ["Cleared"],
  Cleared: ["Opened"],
  Opened: [],
};

export class RoomStateMachine {
  private currentState: RoomState = "Generated";

  public static restore(state: RoomState): RoomStateMachine {
    const machine = new RoomStateMachine();
    const orderedStates: readonly RoomState[] = [
      "Generated",
      "Waiting",
      "PlayerEntered",
      "Locked",
      "Combat",
      "Cleared",
      "Opened",
    ];
    for (const next of orderedStates.slice(1, orderedStates.indexOf(state) + 1)) {
      if (!machine.transition(next)) throw new Error(`Cannot restore room state ${state}.`);
    }
    return machine;
  }

  public get state(): RoomState {
    return this.currentState;
  }

  public transition(next: RoomState): boolean {
    if (!TRANSITIONS[this.currentState].includes(next)) return false;
    this.currentState = next;
    return true;
  }

  public handlePlayerEntry(): boolean {
    if (this.currentState !== "Waiting") return false;
    return this.transition("PlayerEntered");
  }

  public beginCombat(): boolean {
    return this.transition("Locked") && this.transition("Combat");
  }

  public clearAndOpen(): boolean {
    return this.transition("Cleared") && this.transition("Opened");
  }
}
