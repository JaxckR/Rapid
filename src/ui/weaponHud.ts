import type { AssetResolver } from "../assets/assetResolver";
import { requireElement } from "../input/dom";

export class WeaponHud {
  private readonly layer = requireElement<HTMLElement>("weapon-layer");
  private readonly sprite = requireElement<HTMLElement>("weapon-sprite");
  private readonly muzzleFlash = requireElement<HTMLElement>("muzzle-flash");
  private disposed = false;

  public constructor(private readonly assets: AssetResolver) {}

  public async initialize(): Promise<void> {
    const asset = await this.assets.resolve("sprite.weapon.default");
    if (!asset.available || asset.url === undefined || this.disposed) return;
    this.sprite.style.backgroundImage = `url("${asset.url}")`;
    this.sprite.classList.add("has-asset");
  }

  public playFire(): void {
    this.restartAnimation(this.layer, "is-firing");
    this.restartAnimation(this.muzzleFlash, "is-active");
  }

  public dispose(): void {
    this.disposed = true;
    this.layer.classList.remove("is-firing");
    this.muzzleFlash.classList.remove("is-active");
  }

  private restartAnimation(element: HTMLElement, className: string): void {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
  }
}
