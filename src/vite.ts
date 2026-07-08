/**
 * Vite/Rollup plugin for .mdma templates.
 *
 * Importing a `.mdma` file yields its parsed template (a `ParsedTemplate`,
 * for `renderTemplate`) as the default export. Validation happens at build
 * time — a template that fails to parse breaks the build — and the emitted
 * module parses once at load, so consumers never re-parse the source.
 * Unless disabled, the plugin also keeps a `foo.d.mdma.ts` declaration file
 * up to date next to each imported template, so TypeScript (with
 * `allowArbitraryExtensions` enabled) types the import as
 * `ParsedTemplate<{...}>` matching the template's `@inputs`.
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { MdmaError } from "./errors.js";
import { parseFile } from "./fileParser.js";
import { dtsPathFor, generateDts, type TypegenOutput } from "./typegen.js";

export interface MdmaPluginOptions {
  /**
   * Write/refresh `.d.mdma.ts` files next to imported templates. Default: true.
   * Pass `{ outDir, sourceRoot }` to mirror them under `outDir` instead of writing
   * them next to the source — see `TypegenOutput`.
   */
  typegen?: boolean | TypegenOutput;
}

// Structural subset of the Rollup plugin context/shape, so the plugin works
// with both Vite and Rollup without depending on either's types.
interface TransformContext {
  error(message: string): never;
}

export interface MdmaPlugin {
  name: string;
  transform(
    this: TransformContext,
    code: string,
    id: string
  ): { code: string; map: null } | undefined;
}

export default function mdma(options: MdmaPluginOptions = {}): MdmaPlugin {
  const typegen = options.typegen ?? true;
  return {
    name: "mdma",
    transform(code, id) {
      const [filename] = id.split("?");
      if (!filename.endsWith(".mdma")) return undefined;
      try {
        parseFile(code);
      } catch (error) {
        const message = error instanceof MdmaError ? error.message : String(error);
        this.error(`Invalid .mdma template: ${message}`);
      }
      if (typegen) writeDtsIfChanged(filename, code, typeof typegen === "object" ? typegen : undefined);
      return {
        code: `import { parseFile } from "typescript-mdma";\nexport default parseFile(${JSON.stringify(code)});`,
        map: null,
      };
    },
  };
}

function writeDtsIfChanged(mdmaPath: string, source: string, output?: TypegenOutput): void {
  const dtsPath = dtsPathFor(mdmaPath, output);
  const dts = generateDts(source);
  try {
    if (readFileSync(dtsPath, "utf-8") === dts) return;
  } catch {
    // Missing declaration file: write it below.
  }
  mkdirSync(dirname(dtsPath), { recursive: true });
  writeFileSync(dtsPath, dts, "utf-8");
}
