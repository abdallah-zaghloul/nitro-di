import assert from "node:assert/strict";
import { resolve } from "node:path";
import test from "node:test";
import nitroDI from "../module.mjs";

test("shares configured patterns with auto-import discovery and runtime", () => {
  const patterns = ["*/services/**/*.ts", "*/repos/**/*.ts"];
  const options = {
    rootDir: process.cwd(),
    di: { dirs: patterns },
    imports: { dirs: ["*/types"], imports: [{ name: "existing", from: "existing" }] },
    runtimeConfig: {},
  };
  nitroDI.setup({ options });
  assert.deepEqual(options.imports.dirs, ["*/types", ...patterns.map(p => resolve(p))]);
  assert.deepEqual(options.runtimeConfig.nitroDI.dirs, patterns);
  assert.equal(options.imports.imports[0].name, "existing");
  assert.equal(options.imports.imports[1].name, "di");
});

test("supports explicit imports and empty configuration", () => {
  const options = { rootDir: process.cwd(), imports: { autoImport: false }, runtimeConfig: {} };
  nitroDI.setup({ options });
  assert.deepEqual(options.runtimeConfig.nitroDI.dirs, []);
  assert.equal(options.imports.autoImport, false);
});

test("rejects invalid patterns", () => {
  assert.throws(() => nitroDI.setup({ options: { di: { dirs: "services/*.ts" } } }), /array/);
  assert.throws(() => nitroDI.setup({ options: { di: { dirs: [1] } } }), /array/);

});

for (const lifetime of ["SINGLETON", "SCOPED", "TRANSIENT"]) {
  test(`passes ${lifetime} to the runtime`, () => {
    const options = { rootDir: process.cwd(), di: { dirs: [], resolverOptions: { lifetime } }, imports: {}, runtimeConfig: {} };
    nitroDI.setup({ options });
    assert.equal(options.runtimeConfig.nitroDI.resolverOptions.lifetime, lifetime);
  });
}

test("defaults lifetime and rejects invalid lifetime and legacy config", () => {
  const options = { rootDir: process.cwd(), di: { dirs: [] }, imports: {}, runtimeConfig: {} };
  nitroDI.setup({ options });
  assert.equal(options.runtimeConfig.nitroDI.resolverOptions.lifetime, "SINGLETON");
  assert.throws(() => nitroDI.setup({ options: { ...options, di: { dirs: [], resolverOptions: { lifetime: "invalid" } } } }), /lifetime/);
  assert.throws(() => nitroDI.setup({ options: { ...options, di: [] } }), /object/);
});

test("disabled imports retains discovery without implicit imports", () => {
  const options = { rootDir: process.cwd(), imports: false, di: { dirs: ["server/services/*.ts"] }, runtimeConfig: {} };
  nitroDI.setup({ options });
  assert.equal(options.imports.autoImport, false);
  assert.equal(options.imports.imports[0].name, "di");
  assert.deepEqual(options.imports.dirs, [resolve("server/services/*.ts")]);
});

 test("Vite registers type generation on its configured instance", () => {
  const hooks = [];
  const options = { rootDir: process.cwd(), builder: "vite", imports: false, runtimeConfig: {} };
  nitroDI.setup({ options, hooks: { hook: (name, callback) => hooks.push({ name, callback }) } });
  assert.equal(hooks.length, 1);
  assert.equal(hooks[0].name, "build:before");
  assert.equal(typeof hooks[0].callback, "function");
});
