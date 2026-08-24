import type { Vec3 } from "../core/math";
import { SeededRandom } from "./seededRandom";

export type ObstacleKind = "crate" | "barrier" | "wire_barrier";
export type RoomTemplateId = "open_arena" | "central_gate" | "offset_bays";
export type ProtectedZoneKind = "entrance" | "exit" | "player_start" | "trigger" | "enemy_spawn";

export interface GeneratedObstacle {
  readonly id: string;
  readonly kind: ObstacleKind;
  readonly position: Vec3;
  readonly size: Vec3;
  readonly rotationY: number;
}

export interface StructuralBlock {
  readonly id: string;
  readonly position: Vec3;
  readonly size: Vec3;
}

export interface ProtectedZone {
  readonly id: string;
  readonly kind: ProtectedZoneKind;
  readonly center: { readonly x: number; readonly z: number };
  readonly size: { readonly x: number; readonly z: number };
}

export interface GridCell {
  readonly column: number;
  readonly row: number;
}

export interface OccupancyGrid {
  readonly cellSize: number;
  readonly columns: number;
  readonly rows: number;
  readonly blocked: readonly boolean[];
}

export interface RoomLayout {
  readonly seed: string;
  readonly template: RoomTemplateId;
  readonly width: number;
  readonly length: number;
  readonly entrance: Vec3;
  readonly exit: Vec3;
  readonly structuralBlocks: readonly StructuralBlock[];
  readonly protectedZones: readonly ProtectedZone[];
  readonly obstacles: readonly GeneratedObstacle[];
  readonly enemySpawnPoints: readonly Vec3[];
  readonly occupancy: OccupancyGrid;
  readonly path: readonly GridCell[];
  readonly combatAreaCells: number;
  readonly generationAttempts: number;
  readonly usedFallback: boolean;
}

export interface RoomGeneratorOptions {
  readonly width: number;
  readonly length: number;
  readonly obstacleCount: number;
  readonly maximumAttempts: number;
  readonly minimumObstacleSpacing: number;
  readonly placementAttemptsPerObstacle?: number;
  readonly gridCellSize?: number;
  readonly minimumCombatAreaCells?: number;
  readonly playerRadius?: number;
  readonly triggerInset?: number;
  readonly minimumObstacleHeight?: number;
}

interface Rect {
  readonly x: number;
  readonly z: number;
  readonly halfWidth: number;
  readonly halfLength: number;
}

interface LayoutCandidate {
  readonly template: RoomTemplateId;
  readonly structuralBlocks: readonly StructuralBlock[];
  readonly protectedZones: readonly ProtectedZone[];
  readonly enemySpawnPoints: readonly Vec3[];
  readonly obstacles: readonly GeneratedObstacle[];
}

const OBSTACLE_SIZES: Readonly<Record<ObstacleKind, Vec3>> = {
  crate: { x: 1.8, y: 2.2, z: 1.8 },
  barrier: { x: 3.2, y: 2.4, z: 0.8 },
  wire_barrier: { x: 2.6, y: 2.2, z: 1.1 },
};
const KINDS: readonly ObstacleKind[] = ["crate", "barrier", "wire_barrier"];
const TEMPLATES: readonly RoomTemplateId[] = ["open_arena", "central_gate", "offset_bays"];

export class RoomGenerator {
  private readonly cellSize: number;
  private readonly playerRadius: number;
  private readonly triggerInset: number;
  private readonly minimumCombatAreaCells: number;
  private readonly placementAttemptsPerObstacle: number;
  private readonly minimumObstacleHeight: number;

  public constructor(private readonly options: RoomGeneratorOptions) {
    this.cellSize = Math.max(0.5, options.gridCellSize ?? 1);
    this.playerRadius = Math.max(0.2, options.playerRadius ?? 0.42);
    this.triggerInset = Math.max(1, options.triggerInset ?? 4);
    this.minimumCombatAreaCells = Math.max(1, options.minimumCombatAreaCells ?? 54);
    this.placementAttemptsPerObstacle = Math.max(
      1,
      Math.floor(options.placementAttemptsPerObstacle ?? 14),
    );
    this.minimumObstacleHeight = Math.max(0.3, options.minimumObstacleHeight ?? 0.5);
  }

  public generate(seed: string): RoomLayout {
    const maximumAttempts = Math.max(0, Math.floor(this.options.maximumAttempts));
    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
      const random = new SeededRandom(`${seed}:attempt:${attempt}`);
      const template = TEMPLATES[random.integer(0, TEMPLATES.length)] ?? "open_arena";
      const candidate = this.generateCandidate(template, random);
      if (candidate === undefined) continue;
      const layout = this.finalizeLayout(seed, candidate, attempt + 1, false);
      if (layout !== undefined) return layout;
    }
    return this.fallback(seed, maximumAttempts);
  }

  public hasPath(
    obstacles: readonly GeneratedObstacle[],
    structuralBlocks: readonly StructuralBlock[] = [],
  ): boolean {
    const grid = this.createOccupancyGrid(obstacles, structuralBlocks);
    return this.findPath(grid).length > 0;
  }

  public protectedZonesAreClear(layout: RoomLayout): boolean {
    return layout.obstacles.every((obstacle) =>
      layout.protectedZones.every(
        (zone) => !this.intersects(this.obstacleRect(obstacle, 0), this.zoneRect(zone)),
      ),
    );
  }

  private generateCandidate(
    template: RoomTemplateId,
    random: SeededRandom,
  ): LayoutCandidate | undefined {
    const structuralBlocks = this.structuralBlocksFor(template);
    const enemySpawnPoints = this.enemySpawnsFor(structuralBlocks);
    if (enemySpawnPoints.length < 4) return undefined;
    const protectedZones = this.createProtectedZones(enemySpawnPoints);
    const obstacles: GeneratedObstacle[] = [];
    for (let obstacleIndex = 0; obstacleIndex < this.options.obstacleCount; obstacleIndex += 1) {
      let placed = false;
      for (let placement = 0; placement < this.placementAttemptsPerObstacle; placement += 1) {
        const kind = KINDS[random.integer(0, KINDS.length)];
        if (kind === undefined) continue;
        const size = OBSTACLE_SIZES[kind];
        if (size.y <= this.minimumObstacleHeight) continue;
        const rotationY = random.integer(0, 2) === 0 ? 0 : Math.PI / 2;
        const candidate: GeneratedObstacle = {
          id: `obstacle-${obstacleIndex}`,
          kind,
          size,
          rotationY,
          position: {
            x: this.snapToGrid(
              random.range(-this.options.width / 2 + 1.5, this.options.width / 2 - 1.5),
            ),
            y: size.y / 2,
            z: this.snapToGrid(
              random.range(-this.options.length / 2 + 2, this.options.length / 2 - 2),
            ),
          },
        };
        if (!this.isValidObstacle(candidate, obstacles, structuralBlocks, protectedZones)) continue;
        obstacles.push(candidate);
        placed = true;
        break;
      }
      if (!placed) return undefined;
    }
    return { template, structuralBlocks, protectedZones, enemySpawnPoints, obstacles };
  }

  private finalizeLayout(
    seed: string,
    candidate: LayoutCandidate,
    generationAttempts: number,
    usedFallback: boolean,
  ): RoomLayout | undefined {
    const occupancy = this.createOccupancyGrid(candidate.obstacles, candidate.structuralBlocks);
    const path = this.findPath(occupancy);
    if (path.length === 0) return undefined;
    const combatAreaCells = this.countCombatAreaCells(occupancy);
    if (combatAreaCells < this.minimumCombatAreaCells) return undefined;
    const layout: RoomLayout = {
      seed,
      template: candidate.template,
      width: this.options.width,
      length: this.options.length,
      entrance: { x: 0, y: 0, z: -this.options.length / 2 },
      exit: { x: 0, y: 0, z: this.options.length / 2 },
      structuralBlocks: candidate.structuralBlocks,
      protectedZones: candidate.protectedZones,
      obstacles: candidate.obstacles,
      enemySpawnPoints: candidate.enemySpawnPoints,
      occupancy,
      path,
      combatAreaCells,
      generationAttempts,
      usedFallback,
    };
    return this.protectedZonesAreClear(layout) ? layout : undefined;
  }

  private fallback(seed: string, generationAttempts: number): RoomLayout {
    const template: RoomTemplateId = "open_arena";
    const structuralBlocks: readonly StructuralBlock[] = [];
    const enemySpawnPoints: readonly Vec3[] = [
      { x: -4, y: 0, z: 6 },
      { x: 4, y: 0, z: 6 },
      { x: -4, y: 0, z: 10 },
      { x: 4, y: 0, z: 10 },
    ];
    const protectedZones = this.createProtectedZones(enemySpawnPoints);
    const size = OBSTACLE_SIZES.crate;
    const fallbackCandidates: readonly GeneratedObstacle[] = [
      {
        id: "fallback-left",
        kind: "crate",
        position: { x: -5, y: size.y / 2, z: 0 },
        size,
        rotationY: 0,
      },
      {
        id: "fallback-right",
        kind: "crate",
        position: { x: 5, y: size.y / 2, z: 0 },
        size,
        rotationY: 0,
      },
    ];
    const fallbackObstacles = fallbackCandidates.filter((obstacle) =>
      this.isValidObstacle(obstacle, [], structuralBlocks, protectedZones),
    );
    const candidate = {
      template,
      structuralBlocks,
      protectedZones,
      enemySpawnPoints,
      obstacles: fallbackObstacles,
    };
    const layout = this.finalizeLayout(seed, candidate, generationAttempts, true);
    if (layout !== undefined) return layout;
    const emptyLayout = this.finalizeLayout(
      seed,
      { ...candidate, obstacles: [] },
      generationAttempts,
      true,
    );
    if (emptyLayout !== undefined) return emptyLayout;
    throw new Error("Room dimensions are too small for the safe fallback template.");
  }

  private structuralBlocksFor(template: RoomTemplateId): readonly StructuralBlock[] {
    if (template === "central_gate") {
      return [
        { id: "shape-gate-left", position: { x: -6, y: 2, z: 0 }, size: { x: 4, y: 4, z: 1.2 } },
        { id: "shape-gate-right", position: { x: 6, y: 2, z: 0 }, size: { x: 4, y: 4, z: 1.2 } },
      ];
    }
    if (template === "offset_bays") {
      return [
        { id: "shape-bay-left", position: { x: -7, y: 2, z: -4 }, size: { x: 3, y: 4, z: 5 } },
        { id: "shape-bay-right", position: { x: 7, y: 2, z: 5 }, size: { x: 3, y: 4, z: 5 } },
      ];
    }
    return [];
  }

  private enemySpawnsFor(structuralBlocks: readonly StructuralBlock[]): readonly Vec3[] {
    const candidates: readonly Vec3[] = [
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
    return candidates
      .filter((point) =>
        structuralBlocks.every(
          (block) => !this.pointInsideRect(point.x, point.z, this.blockRect(block, 1.2)),
        ),
      )
      .slice(0, 4);
  }

  private createProtectedZones(enemySpawnPoints: readonly Vec3[]): readonly ProtectedZone[] {
    const doorwayWidth = Math.min(4.2, this.options.width - 1);
    const zones: ProtectedZone[] = [
      {
        id: "entrance-zone",
        kind: "entrance",
        center: { x: 0, z: -this.options.length / 2 + 1 },
        size: { x: doorwayWidth, z: 2 },
      },
      {
        id: "player-start-zone",
        kind: "player_start",
        center: { x: 0, z: -this.options.length / 2 + 3 },
        size: { x: 6, z: 4 },
      },
      {
        id: "entry-trigger-zone",
        kind: "trigger",
        center: { x: 0, z: -this.options.length / 2 + this.triggerInset },
        size: { x: doorwayWidth, z: 1.25 },
      },
      {
        id: "exit-zone",
        kind: "exit",
        center: { x: 0, z: this.options.length / 2 - 1.5 },
        size: { x: 5, z: 3 },
      },
    ];
    for (const [index, point] of enemySpawnPoints.entries()) {
      zones.push({
        id: `enemy-spawn-zone-${index}`,
        kind: "enemy_spawn",
        center: { x: point.x, z: point.z },
        size: { x: 2.4, z: 2.4 },
      });
    }
    return zones;
  }

  private isValidObstacle(
    candidate: GeneratedObstacle,
    obstacles: readonly GeneratedObstacle[],
    structuralBlocks: readonly StructuralBlock[],
    protectedZones: readonly ProtectedZone[],
  ): boolean {
    const rect = this.obstacleRect(candidate, this.options.minimumObstacleSpacing);
    const wallInset = this.playerRadius + 0.3;
    if (
      Math.abs(rect.x) + rect.halfWidth > this.options.width / 2 - wallInset ||
      Math.abs(rect.z) + rect.halfLength > this.options.length / 2 - wallInset
    )
      return false;
    return (
      structuralBlocks.every((block) => !this.intersects(rect, this.blockRect(block, 0.2))) &&
      protectedZones.every((zone) => !this.intersects(rect, this.zoneRect(zone))) &&
      obstacles.every((obstacle) => !this.intersects(rect, this.obstacleRect(obstacle, 0)))
    );
  }

  private createOccupancyGrid(
    obstacles: readonly GeneratedObstacle[],
    structuralBlocks: readonly StructuralBlock[],
  ): OccupancyGrid {
    const columns = Math.max(1, Math.floor(this.options.width / this.cellSize));
    const rows = Math.max(1, Math.floor(this.options.length / this.cellSize));
    const blocked: boolean[] = [];
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        const point = this.cellCenter(column, row);
        const atWall =
          Math.abs(point.x) > this.options.width / 2 - this.playerRadius - 0.25 ||
          Math.abs(point.z) > this.options.length / 2 - this.playerRadius - 0.25;
        blocked.push(
          atWall ||
            obstacles.some((obstacle) =>
              this.pointInsideRect(
                point.x,
                point.z,
                this.obstacleRect(obstacle, this.playerRadius),
              ),
            ) ||
            structuralBlocks.some((block) =>
              this.pointInsideRect(point.x, point.z, this.blockRect(block, this.playerRadius)),
            ),
        );
      }
    }
    return { cellSize: this.cellSize, columns, rows, blocked };
  }

  private findPath(grid: OccupancyGrid): readonly GridCell[] {
    const start = this.worldToCell(0, -this.options.length / 2 + this.triggerInset + 0.5, grid);
    const goal = this.worldToCell(0, this.options.length / 2 - 1.5, grid);
    if (this.isBlocked(grid, start) || this.isBlocked(grid, goal)) return [];
    const key = (cell: GridCell): string => `${cell.column}:${cell.row}`;
    const queue: GridCell[] = [start];
    const previous = new Map<string, GridCell | undefined>([[key(start), undefined]]);
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      if (cell === undefined) break;
      if (cell.column === goal.column && cell.row === goal.row) {
        const path: GridCell[] = [];
        let cursor: GridCell | undefined = cell;
        while (cursor !== undefined) {
          path.push(cursor);
          cursor = previous.get(key(cursor));
        }
        return path.reverse();
      }
      const neighbours: readonly GridCell[] = [
        { column: cell.column + 1, row: cell.row },
        { column: cell.column - 1, row: cell.row },
        { column: cell.column, row: cell.row + 1 },
        { column: cell.column, row: cell.row - 1 },
      ];
      for (const neighbour of neighbours) {
        if (
          neighbour.column < 0 ||
          neighbour.column >= grid.columns ||
          neighbour.row < 0 ||
          neighbour.row >= grid.rows
        )
          continue;
        const neighbourKey = key(neighbour);
        if (previous.has(neighbourKey) || this.isBlocked(grid, neighbour)) continue;
        previous.set(neighbourKey, cell);
        queue.push(neighbour);
      }
    }
    return [];
  }

  private countCombatAreaCells(grid: OccupancyGrid): number {
    const start = this.worldToCell(0, -this.options.length / 2 + this.triggerInset + 0.5, grid);
    if (this.isBlocked(grid, start)) return 0;
    const reachable = this.reachableCells(grid, start);
    let count = 0;
    for (let row = 0; row < grid.rows; row += 1) {
      for (let column = 0; column < grid.columns; column += 1) {
        const cell = { column, row };
        const point = this.cellCenter(column, row);
        if (
          Math.abs(point.x) <= this.options.width / 2 - 2 &&
          point.z >= -2 &&
          point.z <= this.options.length / 2 - 3 &&
          reachable.has(`${column}:${row}`) &&
          !this.isBlocked(grid, cell)
        )
          count += 1;
      }
    }
    return count;
  }

  private reachableCells(grid: OccupancyGrid, start: GridCell): ReadonlySet<string> {
    const key = (cell: GridCell): string => `${cell.column}:${cell.row}`;
    const queue: GridCell[] = [start];
    const reached = new Set<string>([key(start)]);
    for (let index = 0; index < queue.length; index += 1) {
      const cell = queue[index];
      if (cell === undefined) break;
      const neighbours: readonly GridCell[] = [
        { column: cell.column + 1, row: cell.row },
        { column: cell.column - 1, row: cell.row },
        { column: cell.column, row: cell.row + 1 },
        { column: cell.column, row: cell.row - 1 },
      ];
      for (const neighbour of neighbours) {
        if (
          neighbour.column < 0 ||
          neighbour.column >= grid.columns ||
          neighbour.row < 0 ||
          neighbour.row >= grid.rows ||
          this.isBlocked(grid, neighbour)
        )
          continue;
        const neighbourKey = key(neighbour);
        if (reached.has(neighbourKey)) continue;
        reached.add(neighbourKey);
        queue.push(neighbour);
      }
    }
    return reached;
  }

  private isBlocked(grid: OccupancyGrid, cell: GridCell): boolean {
    return grid.blocked[cell.row * grid.columns + cell.column] ?? true;
  }

  private worldToCell(x: number, z: number, grid: OccupancyGrid): GridCell {
    return {
      column: Math.min(
        grid.columns - 1,
        Math.max(0, Math.floor((x + this.options.width / 2) / grid.cellSize)),
      ),
      row: Math.min(
        grid.rows - 1,
        Math.max(0, Math.floor((z + this.options.length / 2) / grid.cellSize)),
      ),
    };
  }

  private cellCenter(column: number, row: number): { readonly x: number; readonly z: number } {
    return {
      x: -this.options.width / 2 + column * this.cellSize + this.cellSize / 2,
      z: -this.options.length / 2 + row * this.cellSize + this.cellSize / 2,
    };
  }

  private snapToGrid(value: number): number {
    return Math.round(value / this.cellSize) * this.cellSize;
  }

  private obstacleRect(obstacle: GeneratedObstacle, padding: number): Rect {
    const rotated = Math.abs(Math.sin(obstacle.rotationY)) > 0.5;
    return {
      x: obstacle.position.x,
      z: obstacle.position.z,
      halfWidth: (rotated ? obstacle.size.z : obstacle.size.x) / 2 + padding,
      halfLength: (rotated ? obstacle.size.x : obstacle.size.z) / 2 + padding,
    };
  }

  private blockRect(block: StructuralBlock, padding: number): Rect {
    return {
      x: block.position.x,
      z: block.position.z,
      halfWidth: block.size.x / 2 + padding,
      halfLength: block.size.z / 2 + padding,
    };
  }

  private zoneRect(zone: ProtectedZone): Rect {
    return {
      x: zone.center.x,
      z: zone.center.z,
      halfWidth: zone.size.x / 2,
      halfLength: zone.size.z / 2,
    };
  }

  private pointInsideRect(x: number, z: number, rect: Rect): boolean {
    return Math.abs(x - rect.x) <= rect.halfWidth && Math.abs(z - rect.z) <= rect.halfLength;
  }

  private intersects(left: Rect, right: Rect): boolean {
    return (
      Math.abs(left.x - right.x) < left.halfWidth + right.halfWidth &&
      Math.abs(left.z - right.z) < left.halfLength + right.halfLength
    );
  }
}
