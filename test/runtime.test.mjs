import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { Lifetime, RESOLVER } from "../di.mjs";
import * as awilix from "awilix";

test("root exports are the original Awilix constants without initializing DI", () => {
  assert.equal(Lifetime, awilix.Lifetime);
  assert.equal(RESOLVER, awilix.RESOLVER);
});

test("runtime supports callable/property access, overrides, and inline lifetime", () => {
  const root = mkdtempSync(join(tmpdir(), "nitro-di-runtime-"));
  const moduleURL = new URL("../di.mjs", import.meta.url).href;
  const pluginURL = new URL("../plugin.ts", import.meta.url).href;
  const runtimeURL = new URL("../di.mjs", import.meta.url).href;
  try {
    writeFileSync(join(root, "package.json"), '{"type":"module"}');
    mkdirSync(join(root, "services"));
    writeFileSync(join(root, "services/repo.ts"), 'export default class { find() { return "original"; } }');
    writeFileSync(join(root, "services/service.ts"), 'export default class { constructor(private repo: any) {} show() { return this.repo.find(); } }');
    writeFileSync(join(root, "services/transient.ts"), `import { di, Lifetime, RESOLVER } from ${JSON.stringify(moduleURL)}; export default class { static [RESOLVER] = { lifetime: Lifetime.TRANSIENT }; show() { return di.service.show(); } }`);
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      import { registerHooks } from 'node:module';
      // Replace only Nitro's virtual runtime configuration; exercise the real DI module.
      const config = 'data:text/javascript,' + encodeURIComponent('export const useRuntimeConfig = () => ({nitroDI:{dirs:["services/*.ts"],resolverOptions:{lifetime:"SINGLETON"}}});');
      registerHooks({resolve(specifier, context, next) {
        return specifier === 'nitro/runtime-config' ? {url: config, shortCircuit: true} : next(specifier, context);
      }});
      const {di, Lifetime, RESOLVER} = await import(${JSON.stringify(moduleURL)});
      assert.throws(() => di('service'), /container is not ready/);
      const {default: initialize} = await import(${JSON.stringify(pluginURL)});
      let waitForContainer;
      const result = initialize({ hooks: { hook(name, callback) {
        assert.equal(name, 'request');
        waitForContainer = callback;
      } } });
      assert.equal(result, undefined);
      await Promise.all([waitForContainer(), waitForContainer()]);
      assert.equal(di, (await import(${JSON.stringify(runtimeURL)})).di);
      const constants = await import(${JSON.stringify(moduleURL)});
      assert.equal(Lifetime, constants.Lifetime);
      assert.equal(RESOLVER, constants.RESOLVER);
      assert.equal(di.service.show(), 'original');
      assert.equal(di('service'), di.service);
      assert.equal(di.resolve, undefined);
      assert.equal(di.cradle, undefined);
      assert.equal(di('service', {repo: {find: () => 'override'}}).show(), 'override');
      assert.equal(di.service.show(), 'original');
      assert.notEqual(di('service', {}), di.service);
      assert.equal(di('service', {}).show(), 'original');
      assert.notEqual(di.transient, di.transient);
      assert.equal(di.transient.show(), 'original');
      assert.throws(() => di('missing'), /Could not resolve/);
      assert.throws(() => di('missing', {}), /Could not resolve/);
      assert.equal(di.call(null, 'service'), di.service);
    `], { cwd: root, encoding: "utf8", timeout: 20000 });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr + result.stdout);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const debug of [false, true]) {
  test(`initialization failure preserves rejection with debug=${debug}`, () => {
    const pluginURL = new URL("../plugin.ts", import.meta.url).href;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", `
      import assert from 'node:assert/strict';
      import { registerHooks } from 'node:module';
      const config = 'data:text/javascript,' + encodeURIComponent('export const useRuntimeConfig = () => ({nitroDI:{debug:${debug},dirs:[42],resolverOptions:{lifetime:"SINGLETON"}}});');
      registerHooks({resolve(specifier, context, next) {
        return specifier === 'nitro/runtime-config' ? {url: config, shortCircuit: true} : next(specifier, context);
      }});
      const logs = [];
      console.error = (...args) => logs.push(args);
      const {default: initialize} = await import(${JSON.stringify(pluginURL)});
      let request;
      initialize({hooks: {hook(name, callback) { request = callback; }}});
      // Let startup fail before a request arrives; no unhandled rejection is allowed.
      await new Promise(resolve => setTimeout(resolve, 30));
      await assert.rejects(request());
      assert.equal(logs.length, ${debug ? 1 : 0});
      if (${debug}) assert.match(logs[0][0], /Container initialization failed/);
    `], {encoding: "utf8", timeout: 20000});
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, result.stderr + result.stdout);
  });
}
