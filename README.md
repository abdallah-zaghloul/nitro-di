# nitroDI

[GitHub repository](https://github.com/abdallah-zaghloul/nitro-di) · [Report an issue](https://github.com/abdallah-zaghloul/nitro-di/issues)

Nitro 3 module providing Awilix auto-loading, TypeScript transformation, and a typed callable `di` helper.

## Video tutorial

[![Watch the nitroDI tutorial on YouTube](https://img.youtube.com/vi/xyqIXuJBlyA/0.jpg)](https://youtu.be/xyqIXuJBlyA)

## Installation

```bash
npm install nitro-di
```

Extend your project-root `tsconfig.json` manually:

```json
{ "extends": "nitro-di/tsconfig" }
```

This includes the generated `node_modules/.nitro-di/registry.d.ts`. You do not need `app/types/container.ts` or a `#imports` mapping for nitroDI types. Preserve the registry file if you override `include`.

## Nitro CLI

```ts
import { defineConfig } from "nitro";
import nitroDI from "nitro-di";

export default defineConfig({
  modules: [nitroDI],
  scanDirs: ["app"],
  di: {
    dirs: ["app/services/**/*.ts", "app/repos/**/*.ts"],
    resolverOptions: { lifetime: "SINGLETON" },
    debug: false,
  },
});
```

## Vite with Nitro

Register the same Nitro module inside `nitro({})`:

```ts
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import nitroDI from "nitro-di";

export default defineConfig({
  plugins: [nitro({
    serverDir: "./server",
    modules: [nitroDI],
    di: { dirs: ["server/services/**/*.ts", "server/repos/**/*.ts"] },
  })],
});
```

Types are generated from `di.dirs` during module setup in both CLI and Vite. Nitro’s auto-import option is not required for discovery or type completion. To omit the explicit `di` import in Vite route files, configure a separate Vite auto-import plugin; keep this Node-only package out of browser code. Services loaded directly by Awilix must use explicit runtime imports for their own dependencies.

Run `npm run dev` or `npm run build` to refresh the generated registry after changing files or patterns. Restart the TypeScript server if editor completion remains stale.

## Service and repository example

`app/repos/user-repo.ts`:

```ts
export default class UserRepo {
  find() { return { name: "1st user" }; }
}
```

`app/services/user-service.ts`:

```ts
import type UserRepo from "../repos/user-repo.ts";

export default class UserService {
  constructor(private userRepo: UserRepo) {}
  show() { return this.userRepo.find(); }
}
```

Registration names use camelCase filenames (`userRepo`, `userService`). Constructor parameter names must match registrations. `tsx` supports TypeScript parameter properties.

`app/api/index.ts`:

```ts
import { defineHandler } from "nitro";
import { di } from "nitro-di";

export default defineHandler(() => ({
  show: di.userService.show(),
  resolved: di("userService").show(),
  mocked: di("userService", {
    userRepo: { find: () => ({ name: "Mock user" }) },
  }).show(),
}));
```

Overrides build a fresh instance without replacing the cached instance. An empty object also builds a fresh instance. `di.resolve()` and `di.cradle` are not helper methods.

## Types

The package discovers default-exported classes only inside `di.dirs`. Awilix `listModules` supplies the paths, and `ts-morph` writes type-only imports using the registration names themselves. For example, the registry refers to `userRepo` and `userService` directly; it creates no `Service0` or `Service1` aliases. Type generation creates no container and does not execute application modules.

Import the helper, constants, and types from the package root:

```ts
import nitroDI, {
  di, Lifetime, RESOLVER,
  type DI, type DIRegistry, type Cradle, type Overrides, type DIOptions,
} from "nitro-di";
```

Set `resolverOptions.lifetime` to `SINGLETON` (default), `SCOPED`, or `TRANSIENT`. The package uses a root container; `SCOPED` does not create per-request scopes. Set `di.debug: true` to log container startup failures.

The package supports Nitro server runtimes on Node.js, through the CLI or Vite. It requires service source files at runtime and is not for browser or edge runtimes. `npm test` runs package tests; `npm pack --dry-run` previews the published contents.

## Author

[abdallah-zaghloul](https://github.com/abdallah-zaghloul) · [3bdallahzaghloul@gmail.com](mailto:3bdallahzaghloul@gmail.com)

- GitHub: [abdallah-zaghloul](https://github.com/abdallah-zaghloul)
- YouTube: [zaghloul-soft](https://www.youtube.com/@zaghloul-soft) · [Channel](https://www.youtube.com/channel/UCRQxDCZ6O-204s3vxnkS6kw)
- LinkedIn: [abdallah-zaghloul](https://www.linkedin.com/in/abdallah-zaghloul/)
