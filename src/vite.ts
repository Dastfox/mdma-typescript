/**
 * Vite/Rollup plugin for .mdma templates.
 *
 * Importing a `.mdma` file yields its raw source as the default export,
 * after validating that it parses. Unless disabled, the plugin also keeps a
 * `foo.d.mdma.ts` declaration file up to date next to each imported
 * template, so TypeScript (with `allowArbitraryExtensions` enabled) types
 * the import as `MdmaSource<{...}>` matching the template's `@inputs`.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { MdmaError } from "./errors.js";
import { parseFile } from "./fileParser.js";
import { dtsPathFor, generateDts } from "./typegen.js";

export interface MdmaPluginOptions {
  /** Write/refresh `.d.mdma.ts` files next to imported templates. Default: true. */
  typegen?: boolean;
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
      if (typegen) writeDtsIfChanged(filename, code);
      return { code: `export default ${JSON.stringify(code)};`, map: null };
    },
  };
}

function writeDtsIfChanged(mdmaPath: string, source: string): void {
  const dtsPath = dtsPathFor(mdmaPath);
  const dts = generateDts(source);
  try {
    if (readFileSync(dtsPath, "utf-8") === dts) return;
  } catch {
    // Missing declaration file: write it below.
  }
  writeFileSync(dtsPath, dts, "utf-8");
}
