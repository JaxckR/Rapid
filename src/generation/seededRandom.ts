export class SeededRandom {
  private state: number;

  public constructor(seed: string | number) {
    this.state = typeof seed === "number" ? seed >>> 0 : SeededRandom.hash(seed);
    if (this.state === 0) this.state = 0x6d2b79f5;
  }

  public next(): number {
    let value = (this.state += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  }

  public range(minimum: number, maximum: number): number {
    return minimum + this.next() * (maximum - minimum);
  }

  public integer(minimum: number, maximumExclusive: number): number {
    return Math.floor(this.range(minimum, maximumExclusive));
  }

  private static hash(seed: string): number {
    let hash = 2_166_136_261;
    for (const character of seed) {
      hash ^= character.codePointAt(0) ?? 0;
      hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
  }
}
