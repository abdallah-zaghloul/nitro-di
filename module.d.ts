import type { LifetimeType } from "awilix";
import type { NitroModule } from "nitro/types";

export interface DIOptions {
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
  interface NitroRuntimeConfig {
    nitroDI: { dirs: string[]; resolverOptions: { lifetime: LifetimeType } };
  }
}

declare const module: NitroModule;
export default module;
