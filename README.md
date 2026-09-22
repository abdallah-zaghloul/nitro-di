# nitroDI

[GitHub repository](https://github.com/abdallah-zaghloul/nitro-di) · [Report an issue](https://github.com/abdallah-zaghloul/nitro-di/issues)

Nitro 3 module providing Awilix auto-loading, TypeScript transformation, and a typed callable `di` helper.

## Video tutorial

[![Watch the nitroDI tutorial on YouTube](https://img.youtube.com/vi/xyqIXuJBlyA/0.jpg)](https://youtu.be/xyqIXuJBlyA)

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

`resolverOptions.lifetime` accepts `"SINGLETON"`, `"SCOPED"`, or `"TRANSIENT"`. It defaults to `"SINGLETON"`. The helper uses one root container; `"SCOPED"` does not create a separate scope per request.

## Debug logging

Set `di.debug` to log container initialization failures immediately:

```ts
di: {
  dirs: ["app/services/**/*.ts", "app/repos/**/*.ts"],
  debug: true, // Default: false.
}
```

This controls only the package's startup error log. The request hook still receives initialization failures in either mode; Nitro may also report those errors when requests arrive.

## Vite configuration

DI settings can live directly inside `nitro({})` in `vite.config.ts`, with generated types for editor completion. You do not need to duplicate the module or DI settings in `nitro.config.ts`.

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
import { di } from "nitro-di";

export default defineHandler(() => ({ api: di.userService.show() }));
```

This assumes a default-exported `server/services/user-service.ts` class with a `show()` method. The service and repository examples below also work under `server/` with the configured patterns.

Run `npm run dev` or `npm run build` to generate the declarations. The module uses Nitro's `build:before` hook in Vite to generate types from the actual plugin configuration during both dev startup and builds. Standalone `nitro prepare` does not read inline `vite.config.ts` options; a separate `predev` or `prebuild` command running it is not required for this integration.

### Upgrading an existing Vite project

1. Install the release containing the fix, replacing any local test tarball dependency:

   ```bash
   npm install nitro-di
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
import type UserRepo from "../repos/user-repo.ts";

export default class {
  constructor(private userRepo: UserRepo) {}

  show() {
    return this.userRepo.find();
  }
}
```

Constructor argument names match the camelCase filenames.

`app/api/index.ts`:

```ts
import { defineHandler } from "nitro";
import { di } from "nitro-di";

export default defineHandler(() => di.userService.show());
```

The response is `{"name":"1st user"}`. Property access, destructuring, callable resolution, and overrides are supported inside handlers:

```ts
import { defineHandler } from "nitro";
import { di } from "nitro-di";

export default defineHandler(() => {
  const { userRepo, userService } = di;

  return {
    destructured: userService.show(),
    property: di.userService.show(),
    resolved: di("userService").show(),
    overridden: di("userService", { userRepo }).show(),
    mocked: di("userService", {
      userRepo: { find: () => ({ name: "Mock user" }) },
    }).show(),
  };
});
```

Overrides build a fresh instance without replacing the cached instance. An empty object also requests a fresh instance. Omitting overrides uses normal container resolution. `di.resolve()` and `di.cradle` are not helper methods; use `di(name)` and `di.service` instead.

Run `npm run dev` or `npm run build` after setup to generate dependency types.

## With auto-imports

Use the same installation and `tsconfig.json` extension, then enable auto-imports in `nitro.config.ts` (or set the same `imports` option inside `nitro({})` in Vite):

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
class UserRepo {
  find() {
    return { name: "1st user" };
  }
}

export default UserRepo;
export type { UserRepo };
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

Types remain inferred from discovered classes in both modes. Override completion matches constructor argument types rather than exact parameter names. Other auto-imported classes also appear in the inferred cradle, so keep unrelated classes outside discovery directories. Helper types are available from `nitro-di`.

## Runtime support

| Environment                                     | Supported |
| ----------------------------------------------- | --------- |
| Nitro CLI on Node.js                            | Yes       |
| Nitro server through the Vite plugin on Node.js | Yes       |
| Browser code served by Vite                     | No        |
| Edge runtimes                                   | No        |

Auto-imports insert imports into server code; they do not make Node.js services browser-compatible. Browser code should call server routes with `fetch()`.

Runtime glob loading requires the source files to be deployed and the process started from the project root. A standalone `.output` directory does not contain these source files. This package targets Node.js; it is not an edge-runtime integration.

## Refresh editor types

After adding or renaming a dependency, let `npm run dev` regenerate Nitro's declarations (or run `npm run build`). If VS Code still reports missing types or stale completion:

1. Open the Command Palette with **Ctrl+Shift+P** (macOS: **Cmd+Shift+P**).
2. Run **TypeScript: Restart TS Server**.
3. If the issue persists, run **Developer: Reload Window**.

## Lifetime and resolver metadata

Import the constants from the package root when defining services or configuration:

```ts
import { Lifetime, RESOLVER } from "nitro-di";

export default class {
  static [RESOLVER] = { lifetime: Lifetime.TRANSIENT };

  show() {
    return "hello";
  }
}
```

The exports use Awilix's names: `Lifetime` (capital L) and `RESOLVER`. The root entry can be imported safely in configuration, routes, and auto-loaded classes. A synchronous Nitro startup plugin starts loading the container; an asynchronous request hook waits for loading before handlers run. Resolve dependencies inside request handlers or methods called by them, not at module top level or synchronously in other startup plugins. The container is shared within one Node.js process; running multiple independently configured Nitro apps in the same process is not supported.

The helper supports `di.service` and `di("service", overrides)`. The former `di.resolve()` and `di.cradle` helpers have been removed. Registrations themselves can still be named `resolve` or `cradle`.

## Development checks

From the package directory:

```bash
npm test
npm pack --dry-run
```

Tests cover module configuration, callable/property resolution, overrides, resolver metadata, and explicit and auto-imported types. Runtime tests require Node.js with `node:module.registerHooks` and native type stripping (Node 22.15+ on the Node 22 line). Use a Node version supported by your installed Nitro release.

For integration checks, run `npm run dev` and `npm run build` in the consuming Nitro project and request a route that uses `di`.

## Public imports

```ts
import nitroDI, {
  di,
  Lifetime,
  RESOLVER,
  type DI,
  type Cradle,
  type Overrides,
  type DIOptions,
  type LifetimeType,
  type ResolverOptions,
} from "nitro-di";
```

The default export registers the Nitro module; named exports provide the helper, constants, and types. Import all of these from `nitro-di`. The `nitro-di/tsconfig` subpath is only for your TypeScript configuration.

## Package structure

- `di.mjs`: module setup, configuration helpers, DI proxy, and constants.
- `di.d.ts`: public types and Nitro configuration augmentation. Its basename matches `di.mjs` so Nitro’s generated extensionless global imports resolve the declaration and retain autocomplete.
- `plugin.ts`: container loading and startup initialization.

## Author

[abdallah-zaghloul](https://github.com/abdallah-zaghloul) · [3bdallahzaghloul@gmail.com](mailto:3bdallahzaghloul@gmail.com)

- GitHub: [abdallah-zaghloul](https://github.com/abdallah-zaghloul)
- YouTube: [zaghloul-soft](https://www.youtube.com/@zaghloul-soft) · [Channel](https://www.youtube.com/channel/UCRQxDCZ6O-204s3vxnkS6kw)
- LinkedIn: [abdallah-zaghloul](https://www.linkedin.com/in/abdallah-zaghloul/)
