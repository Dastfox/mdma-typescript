#!/usr/bin/env node
/**
 * mdma-typegen — generate .d.mdma.ts declaration files for .mdma templates.
 *
 * Usage: mdma-typegen [--check] [path ...]
 *
 * Each path is an .mdma file or a directory to scan recursively (default:
 * the current directory). `--check` writes nothing and exits 1 if any
 * declaration file is missing or stale — intended for CI and pre-commit.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { MdmaError } from "./errors.js";
import { dtsPathFor, generateDts } from "./typegen.js";

const SKIP_DIRS = new Set(["node_modules", "dist", ".git"]);

function collectMdmaFiles(path: string, found: string[]): void {
  if (statSync(path).isFile()) {
    if (path.endsWith(".mdma")) found.push(path);
    return;
  }
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) collectMdmaFiles(join(path, entry.name), found);
    } else if (entry.name.endsWith(".mdma")) {
      found.push(join(path, entry.name));
    }
  }
}

function main(argv: string[]): number {
  const args = argv.filter((a) => a !== "--check");
  const check = args.length !== argv.length;
  const roots = args.length > 0 ? args : ["."];

  const files: string[] = [];
  for (const root of roots) collectMdmaFiles(root, files);
  if (files.length === 0) {
    console.error(`No .mdma files found under: ${roots.join(", ")}`);
    return 1;
  }

  let failures = 0;
  let written = 0;
  for (const file of files) {
    const label = relative(process.cwd(), file) || file;
    let dts: string;
    try {
      dts = generateDts(readFileSync(file, "utf-8"));
    } catch (error) {
      const message = error instanceof MdmaError ? error.message : String(error);
      console.error(`${label}: invalid template: ${message}`);
      failures += 1;
      continue;
    }
    const dtsPath = dtsPathFor(file);
    let existing: string | null = null;
    try {
      existing = readFileSync(dtsPath, "utf-8");
    } catch {
      // Missing declaration file: stale by definition.
    }
    if (existing === dts) continue;
    if (check) {
      console.error(`${label}: ${relative(process.cwd(), dtsPath)} is ${existing === null ? "missing" : "stale"}`);
      failures += 1;
    } else {
      writeFileSync(dtsPath, dts, "utf-8");
      written += 1;
    }
  }

  if (!check) {
    console.log(`${files.length} template(s) checked, ${written} declaration file(s) written`);
  } else if (failures === 0) {
    console.log(`${files.length} template(s) checked, all declaration files up to date`);
  }
  return failures > 0 ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
