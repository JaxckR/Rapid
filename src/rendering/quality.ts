export type GraphicsQuality = "low" | "medium" | "high";

export interface QualityProfile {
  readonly devicePixelRatioCap: number;
  readonly impactParticleCount: number;
  readonly dynamicMuzzleLight: boolean;
  readonly shadows: boolean;
}

export const QUALITY_PROFILES: Readonly<Record<GraphicsQuality, QualityProfile>> = Object.freeze({
  low: {
    devicePixelRatioCap: 1,
    impactParticleCount: 4,
    dynamicMuzzleLight: false,
    shadows: false,
  },
  medium: {
    devicePixelRatioCap: 1.5,
    impactParticleCount: 10,
    dynamicMuzzleLight: false,
    shadows: false,
  },
  high: {
    devicePixelRatioCap: 2,
    impactParticleCount: 18,
    dynamicMuzzleLight: true,
    shadows: true,
  },
});

export function recommendedQuality(hardwareConcurrency: number, deviceMemory = 8): GraphicsQuality {
  if (hardwareConcurrency <= 4 || deviceMemory <= 4) return "low";
  if (hardwareConcurrency >= 10 && deviceMemory >= 8) return "high";
  return "medium";
}

export function hardwareScalingFor(devicePixelRatio: number, quality: GraphicsQuality): number {
  const safeRatio = Math.max(1, devicePixelRatio);
  return Math.max(1, safeRatio / QUALITY_PROFILES[quality].devicePixelRatioCap);
}
