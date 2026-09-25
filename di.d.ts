export declare const di: DI;
export type { LifetimeType, ResolverOptions } from "awilix";
import type { LifetimeType } from "awilix";
export { Lifetime, RESOLVER } from "awilix";
import type { NitroModule } from "nitro/types";

export interface DIOptions {
  /** Log container initialization failures. @default false */
  debug?: boolean;
  dirs: string[];
  resolverOptions?: {
    /** @default "SINGLETON" */
    lifetime?: LifetimeType;
  };
}

declare module "nitro/types" {
  interface NitroOptions {
    /** Default-exported classes discovered by Awilix and Nitro auto-imports. */
    di?: DIOptions;
  }
}

declare const module: NitroModule;
export default module;

/* eslint-disable @typescript-eslint/no-explicit-any */

export type Constructor<T = any> = new (...args: any[]) => T;
export type Method = (...args: any[]) => any;

export type MethodOf<T extends Constructor<any> | InstanceType<any> | object> =
  {
    [K in keyof T]: T[K] extends Method ? K : never;
  }[keyof T];

/** Augmented from the configured service and repository files. */
export interface DIRegistry {}

export type Cradle = {
  [K in keyof DIRegistry as DIRegistry[K] extends Constructor ? K : never]:
    InstanceType<Extract<DIRegistry[K], Constructor>>;
};

type ConstructorArgs<K extends keyof Cradle> = ConstructorParameters<
  Extract<DIRegistry[K], Constructor>
>[number];

// Match registered dependencies to the selected constructor's argument types.
// TypeScript does not expose constructor parameter names as type-level keys.
type OverrideNames<K extends keyof Cradle> = {
  [P in keyof Cradle]: Cradle[P] extends ConstructorArgs<K> ? P : never;
}[keyof Cradle];

export type Overrides<K extends keyof Cradle> = [OverrideNames<K>] extends [
  never,
]
  ? Record<string, never>
  : Partial<Pick<Cradle, OverrideNames<K>>>;

export type DIResolve = <K extends keyof Cradle>(
  name: K,
  overrides?: Overrides<NoInfer<K>>,
) => Cradle[K];

export type DI = DIResolve & Cradle;
