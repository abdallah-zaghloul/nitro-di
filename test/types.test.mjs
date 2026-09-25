import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import ts from "typescript";
import { generateTypes } from "../di.mjs";

test("registry uses registration names and provides typed DI access and overrides", async () => {
  const root = mkdtempSync(join(tmpdir(), "nitro-di-types-"));
  try {
    writeFileSync(join(root, "user-repo.ts"), "export default class { find() { return 'value'; } }");
    writeFileSync(join(root, "user-service.ts"), "import type UserRepo from './user-repo.ts'; throw new Error('generation must not execute services'); export default class { constructor(private userRepo: UserRepo) {} show() { return this.userRepo.find(); } }");
    const generated = await generateTypes(root, ["user-*.ts"]);
    const text = readFileSync(generated, "utf8");
    assert.match(text, /default as userRepo/);
    assert.match(text, /default as userService/);
    assert.doesNotMatch(text, /Service\d+/);
    const dts = join(root, "di.d.ts");
    writeFileSync(dts, readFileSync(new URL("../di.d.ts", import.meta.url)));
    const fixture = join(root, "check.ts");
    writeFileSync(fixture, `
      import type { DI, Overrides } from "nitro-di";
      declare const di: DI;
      const value: string = di.userService.show();
      const repo = di("userRepo");
      const mock: Overrides<"userService"> = { userRepo: { find: () => "mock" } };
      di("userService", mock);
      // @ts-expect-error invalid registration
      di.unknown;
      // @ts-expect-error wrong override type
      di("userService", { userRepo: { find: () => 42 } });
    `);
    const program = ts.createProgram([fixture, generated, dts], {
      noEmit: true, strict: true, skipLibCheck: true,
      target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowImportingTsExtensions: true, types: [],
      paths: { "nitro-di": [dts] },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, "\n")).join("\n"));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
