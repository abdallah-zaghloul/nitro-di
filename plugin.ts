import { createContainer, InjectionMode } from "awilix";
import { register } from "tsx/esm/api";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setContainer } from "./di.mjs";
import type { NitroAppPlugin } from "nitro/types";
import type { Cradle } from "./di.d.ts";

const plugin: NitroAppPlugin = (nitroApp) => {
  // Nitro plugins are synchronous. Keep async loading out of module evaluation.
  const config = readConfig();
  const ready = loadContainer(config);
  // Observe startup failures immediately; requests still receive the rejection.
  ready.catch((error) => {
    if (config.debug)
      console.error("[nitro-di] Container initialization failed:", error);
  });

  nitroApp.hooks.hook("request", () => ready);
};

export default plugin;

async function loadContainer(config: ReturnType<typeof readConfig>) {
  register();
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

function readConfig() {
  const path = resolve(process.cwd(), "node_modules/.nitro-di/config.json");
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (cause) {
    throw new Error(`nitroDI: cannot read generated config at ${path}. Restart Nitro after configuring the module.`, { cause });
  }
}
