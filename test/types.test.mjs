import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";

test("DI types expose only callable/property access and retain override checking", () => {
  const root = mkdtempSync(join(tmpdir(), "nitro-di-types-"));
  try {
    writeFileSync(join(root, "imports.ts"), `
      export class repo { find() { return 'value'; } }
      export class service { constructor(private repo: repo) {} show() { return this.repo.find(); } }
      export const di = {};
    `);
    const directEntry = fileURLToPath(new URL("../di", import.meta.url));
    const module = fileURLToPath(new URL("../di.d.ts", import.meta.url));
    const fixture = join(root, "check.ts");
    writeFileSync(fixture, `
      import { di, Lifetime, RESOLVER, type DI, type Cradle, type Overrides, type DIOptions, type LifetimeType, type ResolverOptions } from "nitro-di";
      const typed: DI = di;
      const value: string = di.service.show();
      const called: string = di('service').show();
      di('service', { repo: { find: () => 'mock' } });
      class Example { static [RESOLVER] = { lifetime: Lifetime.TRANSIENT }; }
      // @ts-expect-error removed helper
      di.resolve('service');
      // @ts-expect-error removed helper
      di.cradle.service;
      // @ts-expect-error invalid name
      di('unknown');
      // @ts-expect-error invalid property
      di.unknown;
      // @ts-expect-error repo has no constructor dependencies
      di('repo', { service: di.service });
      // @ts-expect-error wrong override type
      di('service', { repo: { find: () => 42 } });
    `);
    const globalFixture = join(root, "global.ts");
    writeFileSync(globalFixture, `
      export {};
      declare global { const di: typeof import(${JSON.stringify(directEntry)}).di; }
      const result: string = di.service.show();
      const { repo, service } = di;
      const found: string = repo.find();
      di('service', { repo });
      // @ts-expect-error auto-imports must retain property checking
      di.unknown;
      // @ts-expect-error auto-imports must retain return types
      const wrong: number = service.show();
      // @ts-expect-error auto-imports must retain override checking
      di('service', { repo: { find: () => 42 } });
    `);
    const program = ts.createProgram([fixture, globalFixture], {
      noEmit: true, strict: true, skipLibCheck: true,
      target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      allowImportingTsExtensions: true, types: [],
      paths: { "#imports": [join(root, "imports.ts")], "nitro-di": [module] },
    });
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.equal(diagnostics.length, 0, diagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
