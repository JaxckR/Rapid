# Asset replacement register

All media files listed below are intentionally committed as empty, zero-byte placeholders. Do not
load them directly. Runtime access must go through `AssetManifest` and `AssetResolver`; the renderer
uses procedural fallbacks until a non-empty replacement is present.

| Identifier                    | Path                                               | Type         | Purpose                    | Recommended format       | Required size / resolution   | Animation frames | Replacement status |
| ----------------------------- | -------------------------------------------------- | ------------ | -------------------------- | ------------------------ | ---------------------------- | ---------------: | ------------------ |
| `model.environment.door`      | `public/assets/models/environment/door.glb`        | Model        | Entrance and exit door     | Binary glTF 2.0          | 3.6 × 3.2 × 0.35 world units |                0 | Empty placeholder  |
| `model.obstacle.barrier`      | `public/assets/models/obstacles/barrier.glb`       | Model        | Solid industrial barrier   | Binary glTF 2.0          | 3.2 × 2.4 × 0.8 world units  |                0 | Empty placeholder  |
| `model.obstacle.crate`        | `public/assets/models/obstacles/crate.glb`         | Model        | Solid crate obstacle       | Binary glTF 2.0          | 1.8 × 2.2 × 1.8 world units  |                0 | Empty placeholder  |
| `model.obstacle.wire_barrier` | `public/assets/models/obstacles/wire_barrier.glb`  | Model        | Impassable wire obstacle   | Binary glTF 2.0          | 2.6 × 2.2 × 1.1 world units  |                0 | Empty placeholder  |
| `sprite.enemy.flying.idle`    | `public/assets/sprites/enemies/flying/idle.png`    | Sprite sheet | Flying enemy idle          | Transparent PNG          | 2048 × 256, 8 × 1 frames     |                8 | Empty placeholder  |
| `sprite.enemy.flying.attack`  | `public/assets/sprites/enemies/flying/attack.png`  | Sprite sheet | Flying enemy ranged attack | Transparent PNG          | 2048 × 256, 8 × 1 frames     |                8 | Empty placeholder  |
| `sprite.enemy.flying.atlas`   | `public/assets/sprites/enemies/flying/atlas.png`   | Sprite atlas | Flying enemy complete set  | Transparent PNG          | 1024 × 3328, 8 × 26 cells    |              208 | Empty placeholder  |
| `sprite.enemy.toxic.attack`   | `public/assets/sprites/enemies/toxic/attack.png`   | Sprite sheet | Toxic pool attack          | Transparent PNG          | 2048 × 256, 8 × 1 frames     |                8 | Empty placeholder  |
| `sprite.enemy.toxic.atlas`    | `public/assets/sprites/enemies/toxic/atlas.png`    | Sprite atlas | Toxic enemy complete set   | Transparent PNG          | 1024 × 3328, 8 × 26 cells    |              208 | Empty placeholder  |
| `sprite.enemy.jumper.jump`    | `public/assets/sprites/enemies/jumper/jump.png`    | Sprite sheet | Jumper telegraph and leap  | Transparent PNG          | 2560 × 256, 10 × 1 frames    |               10 | Empty placeholder  |
| `sprite.enemy.jumper.atlas`   | `public/assets/sprites/enemies/jumper/atlas.png`   | Sprite atlas | Jumper complete set        | Transparent PNG          | 1024 × 3328, 8 × 26 cells    |              208 | Empty placeholder  |
| `sprite.enemy.shooter.attack` | `public/assets/sprites/enemies/shooter/attack.png` | Sprite sheet | Shooter telegraph and shot | Transparent PNG          | 2048 × 256, 8 × 1 frames     |                8 | Empty placeholder  |
| `sprite.enemy.shooter.atlas`  | `public/assets/sprites/enemies/shooter/atlas.png`  | Sprite atlas | Shooter complete set       | Transparent PNG          | 1024 × 3328, 8 × 26 cells    |              208 | Empty placeholder  |
| `sprite.weapon.default`       | `public/assets/sprites/weapons/default_weapon.png` | Sprite sheet | First-person weapon        | Transparent PNG          | 1536 × 256, 6 × 1 frames     |                6 | Empty placeholder  |
| `texture.environment.wall`    | `public/assets/textures/environment/wall.png`      | Texture      | Tiling wall material       | PNG, sRGB                | 1024 × 1024                  |                0 | Empty placeholder  |
| `texture.environment.floor`   | `public/assets/textures/environment/floor.png`     | Texture      | Tiling floor material      | PNG, sRGB                | 1024 × 1024                  |                0 | Empty placeholder  |
| `audio.weapon.default_shot`   | `public/assets/audio/weapons/default_shot.ogg`     | Audio        | Default weapon shot        | Ogg Vorbis, mono, 48 kHz | Under 1 second               |                0 | Empty placeholder  |
| `audio.enemy.flying_attack`   | `public/assets/audio/enemies/flying_attack.ogg`    | Audio        | Flying enemy attack cue    | Ogg Vorbis, mono, 48 kHz | Under 2 seconds              |                0 | Empty placeholder  |
| `icon.ui.health`              | `public/assets/ui/icons/health.png`                | Icon         | Health HUD icon            | Transparent PNG          | 128 × 128                    |                0 | Empty placeholder  |
