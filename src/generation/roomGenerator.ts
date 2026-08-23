import type { Vec3 } from "../core/math";
import { SeededRandom } from "./seededRandom";

export type ObstacleKind = "crate" | "barrier" | "wire_barrier";

export interface GeneratedObstacle {
  readonly id: string;
  readonly kind: ObstacleKind;
  readonly position: Vec3;
  readonly size: Vec3;
}

export interface RoomLayout {
  readonly seed: string;
  readonly width: number;
  readonly length: number;
  readonly entrance: Vec3;
  readonly exit: Vec3;
  readonly obstacles: readonly GeneratedObstacle[];
  readonly enemySpawnPoints: readonly Vec3[];
  readonly usedFallback: boolean;
}

export interface RoomGeneratorOptions {
  readonly width: number;
  readonly length: number;
  readonly obstacleCount: number;
  readonly maximumAttempts: number;
  readonly minimumObstacleSpacing: number;
}

interface Rect {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfLength: number;
}

const OBSTACLE_SIZES: Readonly<Record<ObstacleKind, Vec3>> = {
  crate: { x: 1.8, y: 2.2, z: 1.8 },
  barrier: { x: 3.2, y: 2.4, z: 0.8 },
  wire_barrier: { x: 2.6, y: 2.2, z: 1.1 },
};
const KINDS: readonly ObstacleKind[] = ["crate", "barrier", "wire_barrier"];

export class RoomGenerator {
  public constructor(private readonly options: RoomGeneratorOptions) {}

  public generate(seed: string): RoomLayout {
    const random = new SeededRandom(seed);
    const obstacles: GeneratedObstacle[] = [];
    let attempts = 0;
    while (
      obstacles.length < this.options.obstacleCount &&
      attempts < this.options.maximumAttempts
    ) {
      attempts += 1;
      const kind = KINDS[random.integer(0, KINDS.length)];
      if (kind === undefined) continue;
      const size = OBSTACLE_SIZES[kind];
      const candidate: GeneratedObstacle = {
        id: `obstacle-${obstacles.length}`,
        kind,
        size,
        position: {
          x: random.range(-this.options.width / 2 + 2, this.options.width / 2 - 2),
          y: size.y / 2,
          z: random.range(-this.options.length / 2 + 5, this.options.length / 2 - 5),
        },
      };
      if (!this.isValidCandidate(candidate, obstacles)) continue;
      obstacles.push(candidate);
    }

    if (obstacles.length !== this.options.obstacleCount || !this.hasPath(obstacles)) {
      return this.fallback(seed);
    }
    const layout = this.createLayout(seed, obstacles, false);
    return layout.enemySpawnPoints.length === 4 ? layout : this.fallback(seed);
  }

  public hasPath(obstacles: readonly GeneratedObstacle[]): boolean {
    const cellSize = 1;
    const columns = Math.floor(this.options.width / cellSize);
    const rows = Math.floor(this.options.length / cellSize);
    const start = { column: Math.floor(columns / 2), row: 1 };
    const goal = { column: Math.floor(columns / 2), row: rows - 2 };
    const key = (column: number, row: number): string => `${column}:${row}`;
    const blocked = new Set<string>();
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const x = -this.options.width / 2 + column * cellSize + cellSize / 2;
        const z = -this.options.length / 2 + row * cellSize + cellSize / 2;
        if (obstacles.some((obstacle) => this.pointInsideObstacle(x, z, obstacle, 0.55))) {
          blocked.add(key(column, row));
        }
      }
    }
    const queue = [start];
    const visited = new Set([key(start.column, start.row)]);
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      if (cell === undefined) break;
      if (cell.column === goal.column && cell.row === goal.row) return true;
      const neighbours = [
        { column: cell.column + 1, row: cell.row },
        { column: cell.column - 1, row: cell.row },
        { column: cell.column, row: cell.row + 1 },
        { column: cell.column, row: cell.row - 1 },
      ];
      for (const neighbour of neighbours) {
        const neighbourKey = key(neighbour.column, neighbour.row);
        if (
          neighbour.column < 1 ||
          neighbour.column >= columns - 1 ||
          neighbour.row < 1 ||
          neighbour.row >= rows - 1 ||
          blocked.has(neighbourKey) ||
          visited.has(neighbourKey)
        ) {
          continue;
        }
        visited.add(neighbourKey);
        queue.push(neighbour);
      }
    }
    return false;
  }

  private isValidCandidate(
    candidate: GeneratedObstacle,
    obstacles: readonly GeneratedObstacle[],
  ): boolean {
    const rect = this.toRect(candidate, this.options.minimumObstacleSpacing);
    const entranceSafe: Rect = {
      x: 0,
      z: -this.options.length / 2 + 3,
      halfWidth: 3.2,
      halfLength: 3.6,
    };
    const exitSafe: Rect = {
      x: 0,
      z: this.options.length / 2 - 2,
      halfWidth: 2.8,
      halfLength: 3.2,
    };
    return (
      !this.intersects(rect, entranceSafe) &&
      !this.intersects(rect, exitSafe) &&
      obstacles.every(
        (obstacle) =>
          !this.intersects(rect, this.toRect(obstacle, this.options.minimumObstacleSpacing)),
      )
    );
  }

  private createLayout(
    seed: string,
    obstacles: readonly GeneratedObstacle[],
    usedFallback: boolean,
  ): RoomLayout {
    const spawnCandidates: readonly Vec3[] = [
      { x: -5, y: 0, z: 3 },
      { x: 5, y: 0, z: 3 },
      { x: -4, y: 0, z: 8 },
      { x: 4, y: 0, z: 8 },
      { x: 0, y: 0, z: 6 },
      { x: -6, y: 0, z: 10 },
      { x: 6, y: 0, z: 10 },
      { x: -2, y: 0, z: 10 },
      { x: 2, y: 0, z: 10 },
      { x: 0, y: 0, z: -2 },
    ];
    const enemySpawnPoints = spawnCandidates
      .filter(
        (point) =>
          !obstacles.some((obstacle) => this.pointInsideObstacle(point.x, point.z, obstacle, 1)),
      )
      .slice(0, 4);
    return {
      seed,
      width: this.options.width,
      length: this.options.length,
      entrance: { x: 0, y: 0, z: -this.options.length / 2 },
      exit: { x: 0, y: 0, z: this.options.length / 2 },
      obstacles,
      enemySpawnPoints,
      usedFallback,
    };
  }

  private fallback(seed: string): RoomLayout {
    const size = OBSTACLE_SIZES.crate;
    return this.createLayout(
      seed,
      [
        { id: "fallback-left", kind: "crate", position: { x: -5, y: size.y / 2, z: 2 }, size },
        { id: "fallback-right", kind: "crate", position: { x: 5, y: size.y / 2, z: 2 }, size },
      ],
      true,
    );
  }

  private pointInsideObstacle(
    x: number,
    z: number,
    obstacle: GeneratedObstacle,
    padding: number,
  ): boolean {
    return (
      Math.abs(x - obstacle.position.x) <= obstacle.size.x / 2 + padding &&
      Math.abs(z - obstacle.position.z) <= obstacle.size.z / 2 + padding
    );
  }

  private toRect(obstacle: GeneratedObstacle, padding: number): Rect {
    return {
      x: obstacle.position.x,
      z: obstacle.position.z,
      halfWidth: obstacle.size.x / 2 + padding,
      halfLength: obstacle.size.z / 2 + padding,
    };
  }

  private intersects(left: Rect, right: Rect): boolean {
    return (
      Math.abs(left.x - right.x) < left.halfWidth + right.halfWidth &&
      Math.abs(left.z - right.z) < left.halfLength + right.halfLength
    );
  }
}
