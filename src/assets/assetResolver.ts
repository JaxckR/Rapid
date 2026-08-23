import { ASSET_MANIFEST, type AssetId } from "./assetManifest";

export interface ResolvedAsset {
  readonly available: boolean;
  readonly url?: string;
}

export class AssetResolver {
  private readonly cache = new Map<AssetId, Promise<ResolvedAsset>>();

  public resolve(id: AssetId): Promise<ResolvedAsset> {
    const cached = this.cache.get(id);
    if (cached !== undefined) return cached;
    const result = this.inspect(id);
    this.cache.set(id, result);
    return result;
  }

  private async inspect(id: AssetId): Promise<ResolvedAsset> {
    const url = ASSET_MANIFEST[id].path;
    try {
      const response = await fetch(url);
      if (!response.ok) return { available: false };
      const data = await response.arrayBuffer();
      return data.byteLength > 0 ? { available: true, url } : { available: false };
    } catch {
      return { available: false };
    }
  }
}
