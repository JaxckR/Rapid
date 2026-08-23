export interface GameConfig {
  readonly simulation: {
    readonly fixedStepSeconds: number;
    readonly maximumFrameSeconds: number;
    readonly maximumSubSteps: number;
  };
  readonly player: {
    readonly maximumHealth: number;
    readonly eyeHeight: number;
    readonly maximumSpeed: number;
    readonly acceleration: number;
    readonly deceleration: number;
    readonly colliderRadius: number;
    readonly colliderHeight: number;
    readonly stepHeight: number;
    readonly maximumSlopeDegrees: number;
    readonly gravity: number;
    readonly lookSensitivity: number;
    readonly minimumPitch: number;
    readonly maximumPitch: number;
    readonly touchLookSmoothing: number;
    readonly aimAssistMaximumAngle: number;
    readonly aimAssistTurnRate: number;
  };
  readonly input: {
    readonly defaultMouseSensitivity: number;
    readonly defaultTouchSensitivity: number;
    readonly joystickRadiusPixels: number;
    readonly maximumLookDeltaPixels: number;
  };
  readonly weapon: {
    readonly damage: number;
    readonly roundsPerSecond: number;
    readonly range: number;
  };
  readonly room: {
    readonly width: number;
    readonly length: number;
    readonly wallHeight: number;
    readonly ordinaryRoomsPerLevel: number;
  };
  readonly generation: {
    readonly maximumAttempts: number;
    readonly obstacleCount: number;
    readonly minimumObstacleSpacing: number;
  };
  readonly rendering: {
    readonly lowPowerHardwareScaling: number;
    readonly enemySpriteSize: number;
  };
  readonly debug: {
    readonly showPhysicsColliders: boolean;
    readonly usePhysicsTestRoom: boolean;
  };
}

export const GAME_CONFIG: GameConfig = Object.freeze({
  simulation: {
    fixedStepSeconds: 1 / 60,
    maximumFrameSeconds: 0.1,
    maximumSubSteps: 6,
  },
  player: {
    maximumHealth: 100,
    eyeHeight: 1.65,
    maximumSpeed: 5.4,
    acceleration: 22,
    deceleration: 28,
    colliderRadius: 0.42,
    colliderHeight: 1.8,
    stepHeight: 0.28,
    maximumSlopeDegrees: 46,
    gravity: 18,
    lookSensitivity: 0.0088,
    minimumPitch: -1.25,
    maximumPitch: 1.25,
    touchLookSmoothing: 0.72,
    aimAssistMaximumAngle: 0.105,
    aimAssistTurnRate: 0.7,
  },
  input: {
    defaultMouseSensitivity: 1,
    defaultTouchSensitivity: 1,
    joystickRadiusPixels: 48,
    maximumLookDeltaPixels: 160,
  },
  weapon: {
    damage: 34,
    roundsPerSecond: 4,
    range: 30,
  },
  room: {
    width: 18,
    length: 28,
    wallHeight: 4,
    ordinaryRoomsPerLevel: 10,
  },
  generation: {
    maximumAttempts: 80,
    obstacleCount: 8,
    minimumObstacleSpacing: 1.4,
  },
  rendering: {
    lowPowerHardwareScaling: 1.5,
    enemySpriteSize: 1.8,
  },
  debug: {
    showPhysicsColliders: false,
    usePhysicsTestRoom: false,
  },
});
