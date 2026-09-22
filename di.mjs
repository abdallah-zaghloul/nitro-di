import { Lifetime } from "awilix";
export { Lifetime, RESOLVER } from "awilix";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

export default {
  name: "nitroDI",
  setup(nitro) {
    const config = readConfig(nitro.options.di);
    configureImports(nitro, config.dirs);
    registerPlugin(nitro);
    configureRuntime(nitro, config);
    registerViteTypes(nitro);
  },
};

function readConfig(options) {
  const config = options ?? {};
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError("nitroDI: di must be an object with dirs and optional resolverOptions.");
  }
  const debug = config.debug ?? false;
  if (typeof debug !== "boolean") {
    throw new TypeError("nitroDI: debug must be a boolean.");
  }
  const patterns = config.dirs ?? [];
  const resolverOptions = config.resolverOptions ?? {};
  if (typeof resolverOptions !== "object" || Array.isArray(resolverOptions)) {
    throw new TypeError("nitroDI: resolverOptions must be an object.");
  }
  const lifetime = resolverOptions.lifetime ?? Lifetime.SINGLETON;
  if (!Object.values(Lifetime).includes(lifetime)) {
    throw new TypeError("nitroDI: lifetime must be SINGLETON, SCOPED, or TRANSIENT.");
  }
  if (!Array.isArray(patterns) || patterns.some((pattern) => typeof pattern !== "string")) {
    throw new TypeError("nitroDI: di.dirs must be an array of glob strings.");
  }
  return { dirs: patterns, debug, resolverOptions: { lifetime } };
}

function configureImports(nitro, patterns) {
  // Keep discovery for type generation without enabling implicit runtime imports.
  const imports = nitro.options.imports ||= { autoImport: false };
  const discoveryDirs = patterns.map((pattern) => pattern.startsWith("!")
      ? "!" + resolve(nitro.options.rootDir, pattern.slice(1))
      : resolve(nitro.options.rootDir, pattern));
  const allDirs = (imports.dirs ?? []).concat(discoveryDirs);
  imports.dirs = Array.from(new Set(allDirs));
  imports.imports = (imports.imports ?? []).concat({ name: "di", from: "nitro-di" });
}

function registerPlugin(nitro) {
  const pluginPath = fileURLToPath(new URL("./plugin.ts", import.meta.url));
  nitro.options.plugins = [pluginPath].concat(nitro.options.plugins ?? []);
}

function configureRuntime(nitro, config) {
  nitro.options.runtimeConfig.nitroDI = config;
}

function registerViteTypes(nitro) {
  // Vite initializes its Nitro instance before this hook in both dev and build.
  // Generate declarations from that instance, including inline plugin config.
  if (nitro.options.builder === "vite") {
    nitro.hooks.hook("build:before", async () => {
      // Resolve at build time so runtime root imports do not bundle Nitro build tools.
      const builderURL = pathToFileURL(createRequire(import.meta.url).resolve("nitro/builder")).href;
      const { writeTypes } = await import(/* @vite-ignore */ builderURL);
      await writeTypes(nitro);
    });
  }
}

// Bundled Nitro code and native Awilix imports must share the same container.
const key = Symbol.for("nitro-di.container");

export function setContainer(container) {
  globalThis[key] = container;
}

function getContainer() {
  const container = globalThis[key];
  if (!container) {
    throw new Error(
      "nitroDI: container is not ready. Register the nitroDI module and resolve dependencies after Nitro startup.",
    );
  }
  return container;
}

function handle(name, overrides) {
  const container = getContainer();
  let registration;
  if (!overrides || !(registration = container.getRegistration(name)))
    return container.resolve(name);

  return container.build(registration.inject(() => overrides));
}

export const di = new Proxy(handle, {
  get(target, property, receiver) {
    const container = globalThis[key];
    if (container?.hasRegistration(property))
      return container.resolve(property);
    return Reflect.get(target, property, receiver);
  },
});
