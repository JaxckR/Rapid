export type AssetType = "model" | "sprite" | "texture" | "audio" | "icon";

export interface AssetDefinition {
  readonly path: string;
  readonly type: AssetType;
  readonly purpose: string;
}

export const ASSET_MANIFEST = {
  "model.environment.door": {
    path: "/assets/models/environment/door.glb",
    type: "model",
    purpose: "Room entrance and exit door",
  },
  "model.obstacle.crate": {
    path: "/assets/models/obstacles/crate.glb",
    type: "model",
    purpose: "Solid crate obstacle",
  },
  "model.obstacle.barrier": {
    path: "/assets/models/obstacles/barrier.glb",
    type: "model",
    purpose: "Solid industrial barrier",
  },
  "model.obstacle.wire_barrier": {
    path: "/assets/models/obstacles/wire_barrier.glb",
    type: "model",
    purpose: "Impassable wire obstacle",
  },
  "sprite.enemy.flying.idle": {
    path: "/assets/sprites/enemies/flying/idle.png",
    type: "sprite",
    purpose: "Flying enemy idle animation",
  },
  "sprite.enemy.flying.attack": {
    path: "/assets/sprites/enemies/flying/attack.png",
    type: "sprite",
    purpose: "Flying enemy attack animation",
  },
  "sprite.enemy.toxic.attack": {
    path: "/assets/sprites/enemies/toxic/attack.png",
    type: "sprite",
    purpose: "Toxic enemy attack animation",
  },
  "sprite.enemy.jumper.jump": {
    path: "/assets/sprites/enemies/jumper/jump.png",
    type: "sprite",
    purpose: "Jumping enemy leap animation",
  },
  "sprite.enemy.shooter.attack": {
    path: "/assets/sprites/enemies/shooter/attack.png",
    type: "sprite",
    purpose: "Shooter enemy attack animation",
  },
  "sprite.weapon.default": {
    path: "/assets/sprites/weapons/default_weapon.png",
    type: "sprite",
    purpose: "First-person weapon sprite",
  },
  "texture.environment.wall": {
    path: "/assets/textures/environment/wall.png",
    type: "texture",
    purpose: "Room wall surface",
  },
  "texture.environment.floor": {
    path: "/assets/textures/environment/floor.png",
    type: "texture",
    purpose: "Room floor surface",
  },
  "audio.weapon.default_shot": {
    path: "/assets/audio/weapons/default_shot.ogg",
    type: "audio",
    purpose: "Default weapon shot",
  },
  "audio.enemy.flying_attack": {
    path: "/assets/audio/enemies/flying_attack.ogg",
    type: "audio",
    purpose: "Flying enemy attack cue",
  },
  "icon.ui.health": {
    path: "/assets/ui/icons/health.png",
    type: "icon",
    purpose: "Health HUD icon",
  },
} as const satisfies Record<string, AssetDefinition>;

export type AssetId = keyof typeof ASSET_MANIFEST;
