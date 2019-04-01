import * as pl from 'tau-prolog';

export function once(factory: () => pl.type.Module): () => pl.type.Module {
  let registeredModule: pl.type.Module|null = null;

  return () => {
    if (registeredModule == null) {
      registeredModule = factory();
    }

    return registeredModule;
  };
}
