import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dtsPathFor, generateDts, MdmaSyntaxError } from "../src/index.js";
import mdma from "../src/vite.js";

const SOURCE = `@inputs
title: string
count: number = 3
tags: string[]
meta: object

<body>
{title}
`;

describe("generateDts", () => {
  it("maps mdma types to TypeScript, marking defaulted inputs optional", () => {
    const dts = generateDts(SOURCE);
    expect(dts).toContain('import type { MdmaSource } from "typescript-mdma";');
    expect(dts).toContain("title: string;");
    expect(dts).toContain("count?: number;");
    expect(dts).toContain("tags: string[];");
    expect(dts).toContain("meta: Record<string, unknown>;");
    expect(dts).toContain("export default source;");
  });

  it("types a template without inputs as Record<string, never>", () => {
    const dts = generateDts("@inputs\n\n<body>\nhi\n");
    expect(dts).toContain("MdmaSource<Record<string, never>>");
  });

  it("throws on an invalid template", () => {
    expect(() => generateDts("not a template")).toThrow(MdmaSyntaxError);
  });
});

describe("dtsPathFor", () => {
  it("maps foo.mdma to foo.d.mdma.ts", () => {
    expect(dtsPathFor("/a/b/foo.mdma")).toBe("/a/b/foo.d.mdma.ts");
  });
});

describe("vite plugin", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  function tempDir(): string {
    const dir = mkdtempSync(join(tmpdir(), "mdma-vite-"));
    dirs.push(dir);
    return dir;
  }

  const context = {
    error(message: string): never {
      throw new Error(message);
    },
  };

  it("inlines the raw source and writes the declaration file", () => {
    const dir = tempDir();
    const id = join(dir, "tpl.mdma");
    const plugin = mdma();
    const result = plugin.transform.call(context, SOURCE, `${id}?raw`);
    expect(result?.code).toBe(`export default ${JSON.stringify(SOURCE)};`);
    expect(readFileSync(join(dir, "tpl.d.mdma.ts"), "utf-8")).toBe(generateDts(SOURCE));
  });

  it("leaves an up-to-date declaration file untouched and skips typegen when disabled", () => {
    const dir = tempDir();
    const id = join(dir, "tpl.mdma");
    const stale = "// stale";
    writeFileSync(join(dir, "tpl.d.mdma.ts"), stale, "utf-8");
    mdma({ typegen: false }).transform.call(context, SOURCE, id);
    expect(readFileSync(join(dir, "tpl.d.mdma.ts"), "utf-8")).toBe(stale);
    mdma().transform.call(context, SOURCE, id);
    expect(readFileSync(join(dir, "tpl.d.mdma.ts"), "utf-8")).toBe(generateDts(SOURCE));
  });

  it("ignores non-mdma modules", () => {
    expect(mdma().transform.call(context, "export {}", "/a/mod.ts")).toBeUndefined();
  });

  it("reports invalid templates through the plugin context", () => {
    const id = join(tempDir(), "tpl.mdma");
    expect(() => mdma().transform.call(context, "nope", id)).toThrow(/Invalid \.mdma template/);
  });
});
