#!/usr/bin/env node
/**
 * mdma-typegen — generate .d.mdma.ts declaration files for .mdma templates.
 *
 * Usage: mdma-typegen [--check] [--out-dir <dir>] [path ...]
 *
 * Each path is an .mdma file or a directory to scan recursively (default:
 * the current directory). `--check` writes nothing and exits 1 if any
 * declaration file is missing or stale — intended for CI and pre-commit.
 *
 * `--out-dir <dir>` mirrors declarations under `<dir>` instead of writing
 * them next to their source, at the same path relative to whichever `path`
 * argument found them — pair `<dir>` with that root in the consuming
 * project's `rootDirs` so `allowArbitraryExtensions` still resolves them.
 */

import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
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
  let check = false;
  let outDir: string | undefined;
  const roots: string[] = [];
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--check") {
      check = true;
    } else if (arg === "--out-dir") {
      i += 1;
      outDir = argv[i];
      if (outDir === undefined) {
        console.error("--out-dir requires a directory argument");
        return 1;
      }
    } else {
      roots.push(arg);
    }
  }
  if (roots.length === 0) roots.push(".");

  const filesByRoot = roots.map((root) => {
    const files: string[] = [];
    collectMdmaFiles(root, files);
    return { root, files };
  });
  const totalFiles = filesByRoot.reduce((sum, { files }) => sum + files.length, 0);
  if (totalFiles === 0) {
    console.error(`No .mdma files found under: ${roots.join(", ")}`);
    return 1;
  }

  let failures = 0;
  let written = 0;
  for (const { root, files } of filesByRoot) {
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
      const dtsPath = outDir !== undefined ? dtsPathFor(file, { outDir, sourceRoot: root }) : dtsPathFor(file);
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
        mkdirSync(dirname(dtsPath), { recursive: true });
        writeFileSync(dtsPath, dts, "utf-8");
        written += 1;
      }
    }
  }

  if (!check) {
    console.log(`${totalFiles} template(s) checked, ${written} declaration file(s) written`);
  } else if (failures === 0) {
    console.log(`${totalFiles} template(s) checked, all declaration files up to date`);
  }
  return failures > 0 ? 1 : 0;
}

process.exit(main(process.argv.slice(2)));
