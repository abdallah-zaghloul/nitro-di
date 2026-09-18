/* eslint-disable @typescript-eslint/no-explicit-any */
export type Constructor<T = any> = new (...args: any[]) => T;
export type Method = (...args: any[]) => any;
export type MethodOf<T extends Constructor<any> | InstanceType<any> | object> =
  {
    [K in keyof T]: T[K] extends Method ? K : never;
  }[keyof T];

// Nitro updates this module's exports when its auto-import scan finds new files.
type AutoImports = Omit<typeof import("#imports"), "di">;
type ClassInstances = {
  [K in keyof AutoImports as AutoImports[K] extends Constructor ? K : never]:
    InstanceType<Extract<AutoImports[K], Constructor>>;
};

// Keep unresolved imports from introducing an unrestricted string index.
export type Cradle = {
  [K in keyof ClassInstances as string extends K ? never : K]: ClassInstances[K];
};
type ConstructorArgs<K extends keyof Cradle> =
  ConstructorParameters<Extract<AutoImports[K], Constructor>>[number];

// Match registered dependencies to the selected constructor's argument types.
// TypeScript does not expose constructor parameter names as type-level keys.
type OverrideNames<K extends keyof Cradle> = {
  [P in keyof Cradle]: Cradle[P] extends ConstructorArgs<K> ? P : never;
}[keyof Cradle];
export type Overrides<K extends keyof Cradle> = [OverrideNames<K>] extends [never]
  ? Record<string, never>
  : Partial<Pick<Cradle, OverrideNames<K>>>;

export type DIResolve = <K extends keyof Cradle>(
  name: K,
  overrides?: Overrides<NoInfer<K>>,
) => Cradle[K];

export type DI = DIResolve & Cradle & {
  resolve: DIResolve;
  cradle: Cradle;
};
