# nitroDI

[GitHub repository](https://github.com/abdallah-zaghloul/nitro-di) · [Report an issue](https://github.com/abdallah-zaghloul/nitro-di/issues)

Nitro 3 module providing Awilix auto-loading, TypeScript transformation, and a typed callable `di` helper.

## Installation

1. Install the package:

   ```bash
   npm install nitro-di
   ```

2. Manually add this extension to your project-root `tsconfig.json` (TypeScript 5.5+):

   ```json
   {
     "extends": "nitro-di/tsconfig"
   }
   ```

   This already extends Nitro's defaults and includes its generated declarations and the `#imports` and `~/*` mappings. The package does not edit your tsconfig. If you override `include` or `compilerOptions.paths`, preserve these entries because TypeScript replaces those settings.

3. Register the module in `nitro.config.ts` for the Nitro CLI, or use the [Vite configuration](#vite-configuration) below instead:

```ts
import { defineConfig } from "nitro";
import nitroDI from "nitro-di";

export default defineConfig({
  modules: [nitroDI],
  scanDirs: ["app"],
  imports: false, // Explicit imports; automatic imports are optional.
  di: {
    dirs: ["*/services/**/*.ts", "*/repos/**/*.ts"],
    resolverOptions: { lifetime: "SINGLETON" }, // Optional; this is the default.
  },
});
```

The module adds these patterns to Nitro's auto-import scan and passes them to Awilix. No separate service/repository `imports.dirs` entries are needed. Default-exported classes are registered with camelCase names and classic constructor injection. Named constructor arguments must match registration names. `tsx` enables constructor parameter properties.

`resolverOptions.lifetime` accepts `"SINGLETON"`, `"SCOPED"`, or `"TRANSIENT"` (Awilix `LifetimeType`). It defaults to `"SINGLETON"`. The helper uses one root container; `"SCOPED"` does not create a separate scope per request.

## Vite configuration

Starting with `0.1.3`, DI settings can live directly inside `nitro({})` in `vite.config.ts`, with generated types for editor completion. You do not need to duplicate the module or DI settings in `nitro.config.ts`.

```ts
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import nitroDI from "nitro-di";

export default defineConfig({
  plugins: [
    nitro({
      serverDir: "./server",
      modules: [nitroDI],
      imports: false, // Use explicit imports; set { autoImport: true } to opt in.
      di: {
        dirs: ["server/services/**/*.ts", "server/repos/**/*.ts"],
        resolverOptions: { lifetime: "SINGLETON" },
      },
    }),
  ],
});
```

Keep this project-root `tsconfig.json`:

```json
{
  "extends": "nitro-di/tsconfig"
}
```

Avoid overriding `compilerOptions.paths` with only your own aliases: that removes the inherited `#imports` mapping used for DI completion. The shared config already provides `~/*`.

For example, `server/api/hello.ts` can explicitly import the helper:

```ts
import { defineHandler } from "nitro";
import { di } from "nitro-di/runtime";

export default defineHandler(() => ({ api: di.userService.show() }));
```

This assumes a default-exported `server/services/user-service.ts` class with a `show()` method. The service and repository examples below also work under `server/` with the configured patterns.

Run `npm run dev` or `npm run build` to generate the declarations. The module uses Nitro's `build:before` hook in Vite to generate types from the actual plugin configuration during both dev startup and builds. Standalone `nitro prepare` does not read inline `vite.config.ts` options; a separate `predev` or `prebuild` command running it is not required for this integration.

### Upgrading an existing Vite project

1. Install the release containing the fix, replacing any local test tarball dependency:

   ```bash
   npm install nitro-di@^0.1.3
   ```

2. Apply the TypeScript config above and keep DI settings in one place: either `nitro.config.ts` or `nitro({})`.
3. Remove `nitro prepare` workaround scripts added solely for this Vite issue.
4. Restart the dev server. In VS Code, run **TypeScript: Restart TS Server** if completion remains stale.

Restart the dev server after changing discovery patterns or adding dependency files. This fix generates types on startup/build; it does not add hot reloading for Awilix's runtime-loaded services.

## Without auto-imports

`app/repos/user-repo.ts`:

```ts
export default class {
  find() {
    return { name: "1st user" };
  }
}
```

`app/services/user-service.ts`:

```ts
import UserRepo from "../repos/user-repo.ts";

export default class {
  constructor(private userRepo: UserRepo) {}

  show() {
    return this.userRepo.find();
  }
}
```

Constructor argument names match the camelCase filenames. Explicit type imports work with Awilix runtime loading.

`app/api/index.ts`:

```ts
import { defineHandler } from "nitro";
import { di } from "nitro-di/runtime";

export default defineHandler(() => di.userService.show());
```

The response is `{"name":"1st user"}`. Other access styles:

```ts
di.userService.show();
di("userService").show();
di("userService", { userRepo: { find: () => ({ name: "Mock user" }) } }).show();
di("userService", { userRepo: di.userRepo }).show();
di.resolve("userService");
di.cradle.userService;
```

Overrides build a fresh instance without replacing the singleton. An empty object also requests a fresh instance.

Run `npm run dev` or `npm run build` after setup to generate dependency types.

## With auto-imports

Use the same installation and `tsconfig.json` extension, then enable auto-imports in `nitro.config.ts`:

```ts
import { defineConfig } from "nitro";
import nitroDI from "nitro-di";

export default defineConfig({
  modules: [nitroDI],
  scanDirs: ["app"],
  imports: { autoImport: true },
  di: {
    dirs: ["app/services/**/*.ts", "app/repos/**/*.ts"],
    resolverOptions: { lifetime: "SINGLETON" },
  },
});
```

`app/repos/user-repo.ts` exports a type for Nitro to discover:

```ts
export default class {
  find() {
    return { name: "1st user" };
  }
}

export type UserRepo = InstanceType<typeof userRepo>;
```

`app/services/user-service.ts` can now use `UserRepo` without a type import:

```ts
export default class {
  constructor(private userRepo: UserRepo) {}

  show() {
    return this.userRepo.find();
  }
}
```

`app/api/index.ts` uses the auto-imported `di`:

```ts
import { defineHandler } from "nitro";

export default defineHandler(() => di.userService.show());
```

Both examples return `{"name":"1st user"}` and support the same callable access and overrides shown above. Start `npm run dev` or run `npm run build` to refresh the generated globals after adding exported types.

With `imports: false`, the module still scans dependencies to generate types, but does not insert runtime imports. Use explicit `di` and dependency type imports as in the first example. With auto-imports enabled, only use globals available at runtime in Nitro-processed files: Awilix loads service/repository files directly, so runtime references inside those files still need explicit imports or constructor injection. The global `UserRepo` above is type-only and is erased before execution.

Types remain inferred from discovered classes in both modes. Override completion matches constructor argument types rather than exact parameter names. Other auto-imported classes also appear in the inferred cradle, so keep unrelated classes outside discovery directories. Helper types are available from `nitro-di/types`.

Runtime glob loading requires the source files to be deployed and the process started from the project root. A standalone `.output` directory does not contain these source files. This package targets Node.js; it is not an edge-runtime integration. `resolve` and `cradle` are reserved helper names.

Add the versioned dependency to your project:

```json
{
  "dependencies": {
    "nitro-di": "^0.1.3"
  }
}
```

Or run `npm install nitro-di@^0.1.3`.

## Refresh editor types

After adding or renaming a dependency, let `npm run dev` regenerate Nitro's declarations (or run `npm run build`). If VS Code still reports missing types or stale completion:

1. Open the Command Palette with **Ctrl+Shift+P** (macOS: **Cmd+Shift+P**).
2. Run **TypeScript: Restart TS Server**.
3. If the issue persists, run **Developer: Reload Window**.

## Author

[abdallah-zaghloul](https://github.com/abdallah-zaghloul) · [3bdallahzaghloul@gmail.com](mailto:3bdallahzaghloul@gmail.com)

- GitHub: [abdallah-zaghloul](https://github.com/abdallah-zaghloul)
- YouTube: [zaghloul-soft](https://www.youtube.com/@zaghloul-soft) · [Channel](https://www.youtube.com/channel/UCRQxDCZ6O-204s3vxnkS6kw)
- LinkedIn: [abdallah-zaghloul](https://www.linkedin.com/in/abdallah-zaghloul/)
