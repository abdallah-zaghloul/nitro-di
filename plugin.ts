import { createContainer, InjectionMode } from "awilix";
import { useRuntimeConfig } from "nitro/runtime-config";
import { register } from "tsx/esm/api";
import { setContainer } from "./di.mjs";
import type { NitroAppPlugin } from "nitro/types";
import type { Cradle } from "./di.d.ts";

const plugin: NitroAppPlugin = (nitroApp) => {
  // Nitro plugins are synchronous. Keep async loading out of module evaluation.
  const ready = loadContainer();
  // Observe startup failures immediately; requests still receive the rejection.
  ready.catch((error) => {
    if (useRuntimeConfig().nitroDI.debug)
      console.error("[nitro-di] Container initialization failed:", error);
  });

  nitroApp.hooks.hook("request", () => ready);
};

export default plugin;

async function loadContainer() {
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
  setContainer(container);
}
