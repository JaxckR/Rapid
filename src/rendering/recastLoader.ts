import Recast from "recast-detour";

/**
 * recast-detour 1.6.4 writes its initialized module to `this.Recast`.
 * ES modules call plain functions with an undefined `this`, so provide an
 * isolated receiver rather than leaking that compatibility value globally.
 */
export function invokeFactoryWithContext<T>(factory: () => Promise<T>): Promise<T> {
  return factory.call({});
}

export function loadRecast(): Promise<unknown> {
  // The package declaration models the factory return as a Promise constructor,
  // although the runtime value is a promise for the initialized module.
  const factory = Recast as unknown as () => Promise<unknown>;
  return invokeFactoryWithContext(factory);
}
