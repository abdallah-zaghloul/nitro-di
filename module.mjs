import { Lifetime } from "awilix";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export default {
  name: "nitroDI",
  setup(nitro) {
    const config = nitro.options.di ?? {};
    if (!config || typeof config !== "object" || Array.isArray(config)) {
      throw new TypeError("nitroDI: di must be an object with dirs and optional resolverOptions.");
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
    // Keep discovery for type generation without enabling implicit runtime imports.
    const imports = nitro.options.imports ||= { autoImport: false };
    imports.dirs = [...new Set([
      ...(imports.dirs ?? []),
      ...patterns.map((pattern) => pattern.startsWith("!")
        ? "!" + resolve(nitro.options.rootDir, pattern.slice(1))
        : resolve(nitro.options.rootDir, pattern)),
    ])];
    imports.imports = [
      ...(imports.imports ?? []),
      { name: "di", from: fileURLToPath(new URL("./runtime.ts", import.meta.url)) },
    ];
    nitro.options.runtimeConfig.nitroDI = { dirs: patterns, resolverOptions: { lifetime } };
    // Vite initializes its Nitro instance before this hook in both dev and build.
    // Generate declarations from that instance, including inline plugin config.
    if (nitro.options.builder === "vite") {
      nitro.hooks.hook("build:before", async () => {
        const { writeTypes } = await import("nitro/builder");
        await writeTypes(nitro);
      });
    }
  },
};
