export interface WeaponStats {
  readonly damage: number;
  readonly roundsPerSecond: number;
  readonly range: number;
}

export class WeaponSystem {
  private cooldownSeconds = 0;

  public constructor(private stats: WeaponStats) {}

  public update(deltaSeconds: number): void {
    this.cooldownSeconds = Math.max(0, this.cooldownSeconds - deltaSeconds);
  }

  public tryFire(triggerHeld: boolean): WeaponStats | undefined {
    if (!triggerHeld || this.cooldownSeconds > 0) return undefined;
    this.cooldownSeconds = 1 / this.stats.roundsPerSecond;
    return this.stats;
  }

  public applyDamageMultiplier(multiplier: number): void {
    this.stats = { ...this.stats, damage: this.stats.damage * Math.max(0, multiplier) };
  }

  public applyFireRateMultiplier(multiplier: number): void {
    this.stats = {
      ...this.stats,
      roundsPerSecond: this.stats.roundsPerSecond * Math.max(0, multiplier),
    };
  }
}
