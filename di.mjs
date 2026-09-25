import { Lifetime, listModules } from "awilix";
import { camelCase } from "camel-case";
import { mkdirSync, writeFileSync } from "node:fs";
export { Lifetime, RESOLVER } from "awilix";
import { dirname, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

export default {
  name: "nitroDI",
  async setup(nitro) {
    const config = readConfig(nitro.options.di);
    registerPlugin(nitro);
    const rootDir = nitro.options.rootDir ?? process.cwd();
    writeRuntimeConfig(rootDir, config);
    await generateTypes(rootDir, config.dirs);
  },
};

function readConfig(options) {
  const config = options ?? {};
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new TypeError(
      "nitroDI: di must be an object with dirs and optional resolverOptions.",
    );
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
    throw new TypeError(
      "nitroDI: lifetime must be SINGLETON, SCOPED, or TRANSIENT.",
    );
  }
  if (
    !Array.isArray(patterns) ||
    patterns.some((pattern) => typeof pattern !== "string")
  ) {
    throw new TypeError("nitroDI: di.dirs must be an array of glob strings.");
  }
  return { dirs: patterns, debug, resolverOptions: { lifetime } };
}

function registerPlugin(nitro) {
  const pluginPath = fileURLToPath(new URL("./plugin.ts", import.meta.url));
  nitro.options.plugins = [pluginPath].concat(nitro.options.plugins ?? []);
}

function writeRuntimeConfig(rootDir, config) {
  const output = resolve(rootDir, "node_modules/.nitro-di/config.json");
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify(config));
}

export async function generateTypes(rootDir, dirs) {
  const toolingURL = pathToFileURL(
    createRequire(import.meta.url).resolve("ts-morph"),
  ).href;
  const { Project } = await import(/* @vite-ignore */ toolingURL);
  const output = resolve(rootDir, "node_modules/.nitro-di/registry.d.ts");
  const source = new Project({ useInMemoryFileSystem: true }).createSourceFile(
    output,
  );
  source.addImportDeclaration({ moduleSpecifier: "nitro-di" });

  const modules = new Map();
  for (const module of listModules(dirs, { cwd: rootDir })) {
    modules.set(camelCase(module.name), module.path);
  }
  const properties = Array.from(modules.keys())
    .sort()
    .map((name) => {
      let path = relative(dirname(output), modules.get(name)).replaceAll(
        "\\",
        "/",
      );
      if (!path.startsWith(".")) path = "./" + path;
      source.addImportDeclaration({
        isTypeOnly: true,
        namedImports: [{ name: "default", alias: name }],
        moduleSpecifier: path,
      });
      return { name: `"${name}"`, type: `typeof ${name}` };
    });

  source
    .addModule({ name: '"nitro-di"', hasDeclareKeyword: true })
    .addInterface({ name: "DIRegistry", properties });
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, source.getFullText());
  return output;
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
