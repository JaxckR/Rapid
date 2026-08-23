type EventMap = Record<string, unknown>;
type Listener<T> = (payload: T) => void;

export class EventBus<TEvents extends EventMap> {
  private readonly listeners = new Map<keyof TEvents, Set<Listener<unknown>>>();

  public on<TKey extends keyof TEvents>(
    event: TKey,
    listener: Listener<TEvents[TKey]>,
  ): () => void {
    const existing = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    existing.add(listener as Listener<unknown>);
    this.listeners.set(event, existing);
    return () => existing.delete(listener as Listener<unknown>);
  }

  public emit<TKey extends keyof TEvents>(event: TKey, payload: TEvents[TKey]): void {
    for (const listener of this.listeners.get(event) ?? []) listener(payload);
  }

  public clear(): void {
    this.listeners.clear();
  }
}
