/** Writes a render() result to .md files on disk. */

import { mkdirSync, writeFileSync } from "node:fs";
import { isAbsolute, relative, resolve } from "node:path";
import { MdmaReferenceError } from "./errors.js";
import type { RenderedValue } from "./renderer.js";

/**
 * Write one or all rendered blocks from a `render()` result to `.md` files.
 *
 * `block` omitted writes every top-level block; `block: "name"` writes only
 * that one. A string-valued block is written to `{outputDir}/{block}.md`. A
 * `<multiple:>` block (array or `<name:>`-keyed object) is written to
 * `{outputDir}/{block}/`, one file per item -- `{name}.md` if the block
 * declared `<name:>`, otherwise `{index}.md`.
 *
 * Throws `MdmaReferenceError` if `block` isn't a key in `result`.
 */
export function writeOutput(
  result: Record<string, RenderedValue>,
  outputDir: string,
  block?: string
): string[] {
  mkdirSync(outputDir, { recursive: true });

  if (block !== undefined) {
    if (!Object.prototype.hasOwnProperty.call(result, block)) {
      throw new MdmaReferenceError(`ReferenceError: block '${block}' not found in render result`);
    }
    return writeBlock(block, result[block], outputDir);
  }

  const written: string[] = [];
  for (const [name, value] of Object.entries(result)) {
    written.push(...writeBlock(name, value, outputDir));
  }
  return written;
}

function writeBlock(name: string, value: RenderedValue, outputDir: string): string[] {
  if (typeof value === "string") {
    const path = resolve(outputDir, `${name}.md`);
    writeFileSync(path, value, "utf-8");
    return [path];
  }

  const subdir = resolve(outputDir, name);
  mkdirSync(subdir, { recursive: true });
  if (Array.isArray(value)) {
    return value.map((item, index) => writeItem(subdir, String(index), item));
  }
  return Object.entries(value).map(([itemName, item]) => writeItem(subdir, itemName, item));
}

function writeItem(subdir: string, name: string, value: string): string {
  const path = resolve(subdir, `${name}.md`);
  const rel = relative(subdir, path);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    throw new Error(`unsafe filename derived from block item name: ${JSON.stringify(name)}`);
  }
  writeFileSync(path, value, "utf-8");
  return path;
}
