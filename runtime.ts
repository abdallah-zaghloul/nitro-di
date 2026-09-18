import {
  createContainer,
  InjectionMode,
  type BuildResolver,
  type Resolver,
} from "awilix";
import { useRuntimeConfig } from "nitro/runtime-config";
import { register } from "tsx/esm/api";
import type { DI, Cradle, Overrides } from "./types.ts";

// Transform runtime TypeScript imports, including constructor parameter properties.
register();

const config = useRuntimeConfig().nitroDI;

const container = await createContainer<Cradle>({
  injectionMode: InjectionMode.CLASSIC,
  strict: true,
}).loadModules(config.dirs, {
  cwd: process.cwd(),
  esModules: true,
  formatName: "camelCase",
  resolverOptions: config.resolverOptions,
});

function resolve<K extends keyof Cradle>(
  name: K,
  overrides?: Overrides<NoInfer<K>>,
): Cradle[K] {
  let registration: Resolver<Cradle[K]> | null;
  if (
    overrides === undefined ||
    !(registration = container.getRegistration(name))
  )
    return container.resolve(name);

  // Build a fresh instance with local arguments, preserving the singleton cache.
  return container.build(
    (registration as BuildResolver<Cradle[K]>).inject(() => overrides),
  );
}

export const di = new Proxy(
  Object.assign(resolve, { resolve, cradle: container.cradle }),
  {
    get(target, property, receiver) {
      if (container.hasRegistration(property))
        return container.resolve(property);
      return Reflect.get(target, property, receiver);
    },
  },
) as DI;
