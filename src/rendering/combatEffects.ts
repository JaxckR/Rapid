import { Material } from "@babylonjs/core/Materials/material.js";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial.js";
import { Color3 } from "@babylonjs/core/Maths/math.color.js";
import { Vector3 } from "@babylonjs/core/Maths/math.vector.js";
import { Mesh } from "@babylonjs/core/Meshes/mesh.js";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder.js";
import type { Scene } from "@babylonjs/core/scene.js";
import type { GraphicsQuality } from "./quality";
import { QUALITY_PROFILES } from "./quality";

interface ImpactParticle {
  readonly mesh: Mesh;
  readonly velocity: Vector3;
  age: number;
  lifetime: number;
}

const POOL_SIZE = QUALITY_PROFILES.high.impactParticleCount * 2;

export class CombatEffects {
  private readonly particles: ImpactParticle[] = [];
  private cursor = 0;
  private quality: GraphicsQuality;

  public constructor(scene: Scene, quality: GraphicsQuality) {
    this.quality = quality;
    const material = new StandardMaterial("impact-particle-material", scene);
    material.diffuseColor = Color3.Black();
    material.emissiveColor = Color3.FromHexString("#ffd36a");
    material.disableLighting = true;
    material.backFaceCulling = false;
    material.alpha = 0.9;
    material.transparencyMode = Material.MATERIAL_ALPHABLEND;
    material.forceDepthWrite = false;
    for (let index = 0; index < POOL_SIZE; index += 1) {
      const mesh = MeshBuilder.CreatePlane(`impact-particle-${index}`, { size: 0.09 }, scene);
      mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
      mesh.isPickable = false;
      mesh.material = material;
      mesh.setEnabled(false);
      this.particles.push({
        mesh,
        velocity: Vector3.Zero(),
        age: 0,
        lifetime: 0,
      });
    }
  }

  public setQuality(quality: GraphicsQuality): void {
    this.quality = quality;
  }

  public emitImpact(position: Vector3): void {
    const count = QUALITY_PROFILES[this.quality].impactParticleCount;
    for (let index = 0; index < count; index += 1) {
      const particle = this.particles[this.cursor];
      this.cursor = (this.cursor + 1) % this.particles.length;
      if (particle === undefined) continue;
      const angle = (index / count) * Math.PI * 2 + (this.cursor % 3) * 0.17;
      const speed = 1.6 + (index % 4) * 0.28;
      particle.mesh.position.copyFrom(position);
      particle.mesh.scaling.setAll(1);
      particle.velocity.set(
        Math.sin(angle) * speed,
        0.8 + (index % 3) * 0.45,
        Math.cos(angle) * speed,
      );
      particle.age = 0;
      particle.lifetime = 0.24 + (index % 3) * 0.04;
      particle.mesh.setEnabled(true);
    }
  }

  public update(deltaSeconds: number): void {
    for (const particle of this.particles) {
      if (!particle.mesh.isEnabled()) continue;
      particle.age += deltaSeconds;
      if (particle.age >= particle.lifetime) {
        particle.mesh.setEnabled(false);
        continue;
      }
      particle.velocity.y -= 5.5 * deltaSeconds;
      particle.mesh.position.addInPlace(particle.velocity.scale(deltaSeconds));
      particle.mesh.scaling.setAll(1 - particle.age / particle.lifetime);
    }
  }
}
