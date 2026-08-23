# Rapid

Rapid is the technical foundation for a single-player browser FPS with a full 3D world and
camera-facing enemy sprites. The project uses Babylon.js, Havok Physics, Recast Navigation,
strict TypeScript, Vite, and Vitest without a UI framework.

The current milestone provides one deterministic combat-room sandbox. It is intentionally a
foundation rather than a complete game: procedural room sequencing, complete enemy attacks,
upgrade selection, and production art/audio will be implemented incrementally.

## Requirements

- Node.js 22.12 or newer
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
- Escape: pause

Touch devices:

- Left virtual stick: move
- Swipe on the game view: look
- FIRE, USE, and pause buttons: actions
- Multiple simultaneous pointers are supported

The interface accounts for safe-area insets and recommends landscape orientation. Add the
`left-handed` class to `document.body` to swap the primary movement and fire controls; this setting
is already represented in the save schema for a future options screen.

## Architecture

| Module            | Responsibility                                                              |
| ----------------- | --------------------------------------------------------------------------- |
| `src/core`        | Composition root, fixed-step loop, typed events, math, and `GAME_CONFIG`    |
| `src/rendering`   | Babylon.js scene, Havok static bodies, Recast navmesh, billboard rendering  |
| `src/input`       | Device-independent actions backed by desktop and multitouch adapters        |
| `src/player`      | Frame-rate-independent player state and movement                            |
| `src/combat`      | Weapon timing and balance data                                              |
| `src/enemies`     | Render-independent enemy archetypes and readable attack phases              |
| `src/rooms`       | Strict one-way room lifecycle state machine                                 |
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
to prevent a spiral of death. Rendering remains variable-rate. Low-core or low-memory devices use
a higher Babylon hardware scaling level to reduce the internal render resolution.

Procedural layouts use a seeded PRNG, bounded placement attempts, reserved entrance and exit zones,
overlap rejection, a grid path check, and a known-safe fallback. Solid obstacle height and logical
collision checks prevent the foundation player controller from crossing them.

## Assets

See [ASSETS.md](./ASSETS.md). Media files committed in this milestone are deliberately zero bytes.
`AssetResolver` checks their size before Babylon receives them; code-generated primitives and
materials remain active until valid replacement files are supplied at the same paths.
