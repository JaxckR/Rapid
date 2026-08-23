# Rapid

Rapid is the technical foundation for a single-player browser FPS with a full 3D world and
camera-facing enemy sprites. The project uses Babylon.js, Havok Physics, Recast Navigation,
strict TypeScript, Vite, and Vitest without a UI framework.

The current milestone provides a deterministic sequence of combat rooms with a complete baseline
2.5D presentation layer. It is intentionally a foundation rather than a complete game: complete
enemy attacks, upgrade selection, and production art/audio will be implemented incrementally.

## Requirements

- Node.js 22.13 or newer
- npm 10 or newer
- A current desktop or mobile browser with WebAssembly and WebGL 2 support

## Setup and commands

```bash
npm install
npm run dev
```

Vite prints the local development URL. Use a LAN-accessible HTTPS development proxy when testing
mobile browser features that require a secure context.

| Command                | Purpose                                           |
| ---------------------- | ------------------------------------------------- |
| `npm run dev`          | Start the Vite development server                 |
| `npm run build`        | Type-check and create a production build          |
| `npm run preview`      | Serve the production build locally                |
| `npm run typecheck`    | Run strict TypeScript checks                      |
| `npm run test`         | Run Vitest once                                   |
| `npm run test:watch`   | Run Vitest in watch mode                          |
| `npm run lint`         | Run ESLint                                        |
| `npm run format:check` | Verify Prettier formatting                        |
| `npm run check`        | Run formatting, lint, typecheck, tests, and build |

## Controls

Desktop:

- WASD: move
- Mouse: look (click the game view to acquire Pointer Lock)
- Left mouse button: fire
- E: interact
- Escape: pause and release Pointer Lock

Touch devices:

- Left virtual stick: move
- Swipe on the free right half of the game view: look
- FIRE, USE, and pause buttons: actions
- Movement, camera rotation, and firing work simultaneously through independent pointers

Input is exposed to gameplay only as the device-independent `move`, `look`, `fire`, `interact`, and
`pause` actions. The active layout is selected from input capabilities and the most recently used
pointer type, so hybrid devices can switch between mouse and touch without reloading. Losing focus
or hiding the tab pauses the game automatically.

The pause panel contains independent mouse and touch sensitivity controls, a left-handed mode, and
an optional weak mobile aim assist. The left-handed option swaps the movement/look sides and action
buttons. These settings are saved locally. Touch camera input uses light low-latency smoothing. The
touch layout accounts for safe-area insets, suppresses browser gestures over the game canvas, and
recommends landscape orientation.

## Architecture

| Module            | Responsibility                                                              |
| ----------------- | --------------------------------------------------------------------------- |
| `src/core`        | Composition root, fixed-step loop, typed events, math, and `GAME_CONFIG`    |
| `src/rendering`   | Babylon.js scene, Havok static bodies, Recast navmesh, billboard rendering  |
| `src/input`       | Device-independent actions backed by desktop and multitouch adapters        |
| `src/player`      | Frame-rate-independent player state and movement                            |
| `src/combat`      | Weapon timing and balance data                                              |
| `src/enemies`     | Render-independent enemy archetypes and readable attack phases              |
| `src/rooms`       | Central lifecycle controller, deterministic sequence, and restore snapshots |
| `src/generation`  | Seeded room generation, safety constraints, path check, and fallback layout |
| `src/progression` | Idempotent room credit, levels, and upgrade choices                         |
| `src/ui`          | Adaptive DOM HUD and pause overlay                                          |
| `src/persistence` | Versioned local browser saves                                               |
| `src/assets`      | Central asset manifest and zero-byte-aware resolver                         |

Game rules use plain TypeScript data and do not import Babylon.js. Rendering consumes snapshots of
that state. The top-level `GameApp` owns all mutable services, so there is no mutable global game
state.

## Simulation and performance

Simulation runs at a fixed 60 Hz. Long browser frames are clamped and have a maximum substep count
to prevent a spiral of death. Rendering remains variable-rate. Low-core or low-memory devices start
with the low graphics profile. The pause panel can switch between low, medium, and high without a
restart: effective device pixel ratio is capped at 1, 1.5, and 2 respectively. Low quality disables
shadow processing and the dynamic muzzle light and uses a smaller impact-particle budget.

Procedural layouts use a seeded PRNG, bounded placement attempts, reserved entrance and exit zones,
overlap rejection, a grid path check, and a known-safe fallback.

## Sequential combat rooms

`RoomController` is the only service allowed to advance the lifecycle:
`Generated → Waiting → PlayerEntered → Locked → Combat → Cleared → Opened`. Every layout uses the
stable seed `<base-seed>:room:<index>`, and world-space room offsets are derived from the index.

The entrance trigger is a directional plane inside the doorway. It only accepts an inward crossing
within the clear opening, so touching it from outside, walking backwards, approaching beside the
door, or crossing it again cannot restart combat. `PlayerEntered` remains active until the capsule
is safely beyond the entrance door; only then is the Havok collider enabled and combat begins.

Required enemies are counted per room. Optional enemies and props do not keep the exit locked.
Clearing the required set advances through `Cleared`, then opens the exit on the following fixed
simulation step. The current, previous, and next rooms may coexist in one Babylon scene. Once the
player advances far enough, old room physics bodies, materials, meshes, enemies, and navmesh input
are disposed and the Recast navigation data is rebuilt from the remaining rooms.

The local save contains the current index and states of loaded rooms. Loading regenerates the same
layouts from their seeds, restores door state, places the player safely near the current entrance,
and re-creates the active combat wave when necessary.

## 2.5D rendering

Rooms, doors, and blocking obstacles are Babylon.js 3D meshes with Havok colliders. Enemies are
Y-axis billboards, while animation state and facing direction come from render-independent enemy
snapshots. The renderer supports `idle`, `move`, `attack`, `hurt`, and `death` animation bands and
selects one of eight views from the camera/enemy angle.

Enemy atlases use eight direction columns in this order: front, front-left, left, back-left, back,
back-right, right, and front-right. The 26 animation rows are split into 4 idle, 6 move, 6 attack,
2 hurt, and 8 death frames. Nearest atlas sampling, clamped UVs, alpha-test-and-blend transparency,
and a depth pre-pass avoid sprite edge bleeding, incorrect alpha sorting, and z-fighting.

The first-person weapon is a separate responsive HUD layer with a six-frame replacement sheet,
procedural fallback, recoil, and muzzle flash. Hits emit pooled Babylon mesh particles; rendering
effects consume combat results but never decide damage, attack timing, or enemy lifetime.

Player motion uses Babylon's Havok-backed capsule character controller. Acceleration and
deceleration are calculated in device-independent game logic, then applied through fixed-step
capsule shape casts. Walls, obstacles, and room doors have static Havok bodies. The strict step
height prevents the rounded capsule from climbing tall obstacles, and jumping is intentionally
disabled. Render interpolation keeps camera motion smooth when display FPS differs from the 60 Hz
simulation rate.

## Physics test and debug mode

Open the development URL with the following query parameters:

```text
/?physicsTestRoom=1&debugPhysics=1&debugRooms=1
```

`physicsTestRoom=1` selects a deterministic room with a centered doorway, a low step, a tall crate,
and two barriers. `debugPhysics=1` overlays the player capsule and all active Havok bodies, including
door colliders. `debugRooms=1` shows the current room ID, state, seed, and all loaded room states.
The room indicator is enabled by default for this development milestone. All flags can also be
configured through `GAME_CONFIG.debug`.

## Assets

See [ASSETS.md](./ASSETS.md). Media files committed in this milestone are deliberately zero bytes.
`AssetResolver` checks their size before Babylon receives them; code-generated primitives,
materials, enemy atlases, weapon art, and effects remain active until valid replacement files are
supplied at the same paths.
