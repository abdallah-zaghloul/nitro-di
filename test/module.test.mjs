import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import nitroDI from "../di.mjs";

test("setup creates the registry without depending on Nitro auto-imports", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "nitro-di-module-"));
  try {
    const options = { rootDir, di: { dirs: [] }, imports: false, runtimeConfig: {} };
    await nitroDI.setup({ options });
    assert.equal(options.imports, false);
    const config = JSON.parse(readFileSync(join(rootDir, "node_modules/.nitro-di/config.json"), "utf8"));
    assert.deepEqual(config.dirs, []);
    assert.equal(config.debug, false);
    assert.ok(options.plugins[0].endsWith("/plugin.ts"));
    const registry = join(rootDir, "node_modules/.nitro-di/registry.d.ts");
    assert.ok(existsSync(registry));
    assert.match(readFileSync(registry, "utf8"), /interface DIRegistry/);
  } finally { rmSync(rootDir, { recursive: true, force: true }); }
});

test("validates lifetime, directories, and debug config", async () => {
  for (const di of [
    { dirs: "services" }, { dirs: [1] }, { debug: "yes" },
    { dirs: [], resolverOptions: { lifetime: "invalid" } },
  ]) {
    await assert.rejects(nitroDI.setup({ options: { di, runtimeConfig: {} } }), TypeError);
  }
});
